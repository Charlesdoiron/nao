import { useMemo } from 'react';

import type { TestOwner } from '@/lib/context-tests';
import { useSession } from '@/lib/auth-client';

export function useCurrentTestOwner(): TestOwner {
	const { data: session } = useSession();
	const user = session?.user;
	return useMemo(
		() => ({
			id: user?.id ?? 'you',
			name: user?.name || 'You',
			email: user?.email ?? '',
		}),
		[user?.id, user?.name, user?.email],
	);
}
