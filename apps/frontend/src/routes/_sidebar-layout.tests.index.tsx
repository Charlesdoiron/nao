import { createFileRoute } from '@tanstack/react-router';

import { TestSuitePage } from '@/components/test-suite/test-suite-page';

export const Route = createFileRoute('/_sidebar-layout/tests/')({
	component: TestSuitePage,
});
