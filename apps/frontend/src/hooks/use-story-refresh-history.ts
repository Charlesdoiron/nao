import { useMemo } from 'react';

import type { QueryDataMap } from '@/components/story-embeds';
import { useSession } from '@/lib/auth-client';
import { getLatestRunFailures, getStoryQueryBlocks } from '@/lib/story-refresh-history';
import { buildMockStoryRefreshHistory } from '@/lib/story-refresh-history.mock';

interface UseStoryRefreshHistoryOptions {
	code: string;
	queryData: QueryDataMap | null;
	cachedAt?: string | Date | null;
	scheduleDescription?: string | null;
	enabled: boolean;
}

/** Prototype: refresh runs are mocked from the story's query blocks until the backend records them. */
export function useStoryRefreshHistory({
	code,
	queryData,
	cachedAt,
	scheduleDescription,
	enabled,
}: UseStoryRefreshHistoryOptions) {
	const { data: session } = useSession();
	const ownerName = session?.user.name ?? 'You';

	const runs = useMemo(() => {
		if (!enabled) {
			return [];
		}
		const entries = Object.entries(queryData ?? {});
		return buildMockStoryRefreshHistory({
			blocks: getStoryQueryBlocks(code),
			columnsByQueryId: Object.fromEntries(entries.map(([queryId, result]) => [queryId, result.columns])),
			rowCountByQueryId: Object.fromEntries(entries.map(([queryId, result]) => [queryId, result.data.length])),
			latestAt: cachedAt ? new Date(cachedAt) : new Date(),
			ownerName,
			scheduleDescription: scheduleDescription ?? null,
		});
	}, [enabled, code, queryData, cachedAt, ownerName, scheduleDescription]);

	const latestFailures = useMemo(() => getLatestRunFailures(runs), [runs]);

	return { runs, latestRun: runs[0] ?? null, latestFailures };
}
