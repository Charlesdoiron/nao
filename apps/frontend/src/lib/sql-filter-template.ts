import { STORY_FILTER_ID_REGEX } from '@nao/shared/sql-template';

export type SqlFilterTokenKind = 'open' | 'close' | 'placeholder' | 'unknown';

export interface SqlFilterToken {
	kind: SqlFilterTokenKind;
	filterId: string | null;
	start: number;
	end: number;
	raw: string;
	issue?: string;
	blockIndex?: number;
}

export interface SqlFilterBlock {
	filterId: string;
	start: number;
	end: number;
	innerStart: number;
	innerEnd: number;
	hasIssue: boolean;
}

export interface SqlFilterTemplateAnalysis {
	tokens: SqlFilterToken[];
	blocks: SqlFilterBlock[];
	issues: SqlFilterToken[];
	referencedFilterIds: string[];
}

const TEMPLATE_EXPRESSION_REGEX = /\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g;
const OPEN_REGEX = /^\{%-?\s*filter\s+([^%}]*?)\s*-?%\}$/;
const CLOSE_REGEX = /^\{%-?\s*endfilter\s*-?%\}$/;
const PLACEHOLDER_REGEX = /^\{\{\s*filters\.([^\s.{}]+)(?:\.([^\s{}]*))?\s*\}\}$/;

/**
 * Locates every Jinja expression in a story SQL template and attaches lint issues to the exact token,
 * so the editor can render valid filters as inline controls and underline invalid ones in place.
 */
export function analyzeSqlFilterTemplate(
	sql: string,
	options?: { knownFilterIds?: Iterable<string> },
): SqlFilterTemplateAnalysis {
	const knownFilterIds = options?.knownFilterIds ? new Set(options.knownFilterIds) : null;
	const tokens = [...sql.matchAll(TEMPLATE_EXPRESSION_REGEX)].map((match) => classifyToken(match[0], match.index));
	const blocks = pairBlocks(tokens);

	for (const token of tokens) {
		validateToken(token, blocks, knownFilterIds);
	}
	for (const [index, block] of blocks.entries()) {
		validateBlock(block, index, tokens);
	}

	return {
		tokens,
		blocks,
		issues: tokens.filter((token) => token.issue),
		referencedFilterIds: uniqueFilterIds(tokens),
	};
}

export function buildFilterBlockSnippet(filterId: string, column: string | undefined, filterType: string): string {
	const target = column ?? filterId;
	const placeholder = `{{ filters.${filterId}.sql }}`;
	const condition =
		filterType === 'multi_select'
			? `${target} IN (${placeholder})`
			: filterType === 'search'
				? `${target} ILIKE ${placeholder}`
				: filterType === 'date_range'
					? `${target} BETWEEN ${placeholder}`
					: `${target} = ${placeholder}`;
	return `{% filter ${filterId} %} AND ${condition} {% endfilter %}`;
}

/** Offset right after the outer query's WHERE conditions, where a new `AND …` filter block can be inserted. */
export function findFilterInsertOffset(sql: string): number {
	const lower = sql.toLowerCase();
	const anchor = Math.max(lower.lastIndexOf('where'), lower.lastIndexOf('from'), 0);
	const trailingClause = /\n[ \t]*(?:group\s+by|order\s+by|having|qualify|limit|window)\b/gi;
	trailingClause.lastIndex = anchor;
	const match = trailingClause.exec(sql);
	if (match) {
		return match.index;
	}
	return sql.replace(/[\s;]+$/, '').length;
}

function classifyToken(raw: string, start: number): SqlFilterToken {
	const base = { raw, start, end: start + raw.length };
	const open = raw.match(OPEN_REGEX);
	if (open) {
		return { ...base, kind: 'open', filterId: open[1] };
	}
	if (CLOSE_REGEX.test(raw)) {
		return { ...base, kind: 'close', filterId: null };
	}
	const placeholder = raw.match(PLACEHOLDER_REGEX);
	if (placeholder) {
		return { ...base, kind: 'placeholder', filterId: placeholder[1], ...describePropertyIssue(placeholder) };
	}
	return {
		...base,
		kind: 'unknown',
		filterId: null,
		issue: 'Unsupported template expression. Use {% filter <id> %} … {% endfilter %} with {{ filters.<id>.sql }}.',
	};
}

function describePropertyIssue(placeholder: RegExpMatchArray): { issue?: string } {
	const [raw, filterId, property] = placeholder;
	if (property === 'sql') {
		return {};
	}
	if (property && ['start', 'end', 'from', 'to'].includes(property)) {
		return {
			issue: `${raw}: date ranges expose a single value that already expands to 'start' AND 'end'. Use BETWEEN {{ filters.${filterId}.sql }}.`,
		};
	}
	return { issue: `${raw}: only {{ filters.${filterId}.sql }} is supported.` };
}

function pairBlocks(tokens: SqlFilterToken[]): SqlFilterBlock[] {
	const blocks: SqlFilterBlock[] = [];
	let opener: SqlFilterToken | null = null;

	for (const token of tokens) {
		if (token.kind === 'open') {
			if (opener) {
				token.issue =
					'Nested filter blocks are not supported. Close the previous block with {% endfilter %} first.';
				continue;
			}
			opener = token;
			continue;
		}
		if (token.kind !== 'close') {
			continue;
		}
		if (!opener) {
			token.issue = 'This {% endfilter %} has no matching {% filter <id> %} opener.';
			continue;
		}
		const blockIndex = blocks.length;
		opener.blockIndex = blockIndex;
		token.blockIndex = blockIndex;
		token.filterId = opener.filterId;
		blocks.push({
			filterId: opener.filterId ?? '',
			start: opener.start,
			end: token.end,
			innerStart: opener.end,
			innerEnd: token.start,
			hasIssue: false,
		});
		opener = null;
	}

	if (opener && !opener.issue) {
		opener.issue = `Filter block "${opener.filterId}" is never closed. Add {% endfilter %} after the condition.`;
	}
	return blocks;
}

function validateToken(token: SqlFilterToken, blocks: SqlFilterBlock[], knownFilterIds: Set<string> | null) {
	if (token.issue || token.kind === 'close' || token.kind === 'unknown') {
		return;
	}

	if (token.kind === 'open') {
		if (!token.filterId || !STORY_FILTER_ID_REGEX.test(token.filterId)) {
			token.issue = `Invalid filter id "${token.filterId ?? ''}". Use letters, numbers and underscores.`;
		} else if (knownFilterIds && !knownFilterIds.has(token.filterId)) {
			token.issue = `Filter "${token.filterId}" is not declared in this story. Add a <filter id="${token.filterId}" /> or fix the id.`;
		}
		return;
	}

	const blockIndex = blocks.findIndex((block) => token.start >= block.innerStart && token.end <= block.innerEnd);
	if (blockIndex === -1) {
		token.issue = `${token.raw} must be wrapped in {% filter ${token.filterId} %} … {% endfilter %}.`;
		return;
	}
	token.blockIndex = blockIndex;
	const blockFilterId = blocks[blockIndex].filterId;
	if (token.filterId !== blockFilterId) {
		token.issue = `This placeholder belongs to "${token.filterId}" but sits inside the "${blockFilterId}" block. Use {{ filters.${blockFilterId}.sql }}.`;
	}
}

function validateBlock(block: SqlFilterBlock, blockIndex: number, tokens: SqlFilterToken[]) {
	const blockTokens = tokens.filter((token) => token.blockIndex === blockIndex);
	const opener = blockTokens.find((token) => token.kind === 'open');
	const hasPlaceholder = blockTokens.some((token) => token.kind === 'placeholder');
	if (opener && !hasPlaceholder && !opener.issue) {
		opener.issue = `Filter block "${block.filterId}" never uses the selected value. Add {{ filters.${block.filterId}.sql }} inside it.`;
	}
	block.hasIssue = blockTokens.some((token) => token.issue);
}

function uniqueFilterIds(tokens: SqlFilterToken[]): string[] {
	const ids = tokens
		.filter((token) => token.kind === 'open' && token.filterId && STORY_FILTER_ID_REGEX.test(token.filterId))
		.map((token) => token.filterId as string);
	return [...new Set(ids)];
}
