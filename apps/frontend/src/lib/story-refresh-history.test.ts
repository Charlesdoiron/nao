import { describe, expect, it } from 'vitest';

import {
	formatRefreshDuration,
	getLatestRunFailures,
	getSharedErrorMessage,
	getStoryQueryBlocks,
} from './story-refresh-history';
import type { StoryRefreshQueryOutcome, StoryRefreshRun } from './story-refresh-history';

describe('getStoryQueryBlocks', () => {
	it('collects chart, table and grid blocks once per query', () => {
		const code = [
			'<grid cols="2">',
			'<chart query_id="q1" chart_type="kpi_card" series=\'[{"data_key":"revenue"}]\' title="Revenue" />',
			'<chart query_id="q2" chart_type="kpi_card" series=\'[{"data_key":"orders"}]\' title="Orders" />',
			'</grid>',
			'<chart query_id="q1" chart_type="line" x_axis_key="month" series=\'[{"data_key":"revenue"}]\' title="Trend" />',
			'<table query_id="q3" title="Customers" />',
		].join('\n');

		expect(getStoryQueryBlocks(code)).toEqual([
			{ queryId: 'q1', title: 'Revenue', kind: 'chart', chartType: 'kpi_card' },
			{ queryId: 'q2', title: 'Orders', kind: 'chart', chartType: 'kpi_card' },
			{ queryId: 'q3', title: 'Customers', kind: 'table' },
		]);
	});
});

describe('getLatestRunFailures', () => {
	it('maps failed queries of the latest run to the last run where they succeeded', () => {
		const runs = [
			buildRun('run_3', '2026-10-25T09:00:00Z', { q1: 'success', q2: 'failed' }),
			buildRun('run_2', '2026-10-24T09:00:00Z', { q1: 'failed', q2: 'failed' }),
			buildRun('run_1', '2026-10-23T09:00:00Z', { q1: 'success', q2: 'success' }),
		];

		const failures = getLatestRunFailures(runs);

		expect([...failures.keys()]).toEqual(['q2']);
		expect(failures.get('q2')?.run.id).toBe('run_3');
		expect(failures.get('q2')?.lastSucceededAt?.toISOString()).toBe('2026-10-23T09:00:00.000Z');
	});

	it('returns no failures when there is no history', () => {
		expect(getLatestRunFailures([]).size).toBe(0);
	});
});

describe('getSharedErrorMessage', () => {
	it('returns the error only when every query failed with the same message', () => {
		const sameError = buildRun('run_1', '2026-10-25T09:00:00Z', { q1: 'failed', q2: 'failed' });
		const partial = buildRun('run_2', '2026-10-25T09:00:00Z', { q1: 'success', q2: 'failed' });

		expect(getSharedErrorMessage(sameError)).toBe('boom');
		expect(getSharedErrorMessage(partial)).toBeNull();
	});
});

describe('formatRefreshDuration', () => {
	it.each([
		[420, '420 ms'],
		[5_120, '5.1s'],
		[64_000, '1m 04s'],
	])('formats %d ms as %s', (durationMs, expected) => {
		expect(formatRefreshDuration(durationMs)).toBe(expected);
	});
});

function buildRun(
	id: string,
	startedAt: string,
	statuses: Record<string, StoryRefreshQueryOutcome['status']>,
): StoryRefreshRun {
	const queries = Object.entries(statuses).map(
		([queryId, status]): StoryRefreshQueryOutcome => ({
			queryId,
			title: queryId,
			kind: 'chart',
			status,
			durationMs: 100,
			rowCount: status === 'success' ? 1 : null,
			sql: 'SELECT 1',
			errorMessage: status === 'failed' ? 'boom' : undefined,
		}),
	);
	const failedCount = queries.filter((query) => query.status === 'failed').length;
	return {
		id,
		startedAt: new Date(startedAt),
		durationMs: 100,
		trigger: 'schedule',
		triggeredBy: 'Schedule',
		status: failedCount === 0 ? 'success' : failedCount === queries.length ? 'failed' : 'partial',
		queries,
	};
}
