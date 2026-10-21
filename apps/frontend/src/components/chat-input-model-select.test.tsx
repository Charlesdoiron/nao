// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ChatInputModelSelect } from './chat-input-model-select';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
	setSelectedModel: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
	Link: ({ children }: { children: ReactNode }) => <>{children}</>,
	useNavigate: () => vi.fn(),
}));

vi.mock('@/components/ui/llm-provider-icon', () => ({
	LlmProviderIcon: ({ provider }: { provider: string }) => <span aria-label={`${provider} model`} />,
}));

vi.mock('@/hooks/use-model-selection', () => ({
	isSameModel: () => false,
	useModelSelection: () => ({
		availableModels: [],
		defaultModel: null,
		selectedModel: null,
		usesDefaultModel: true,
		setSelectedModel: mocks.setSelectedModel,
		isPending: false,
		canCycleModels: false,
		hasProject: false,
	}),
}));

vi.mock('@/hooks/use-permissions', () => ({
	usePermissions: () => ({ isAdmin: true }),
}));

afterEach(cleanup);

it('shows the nao automatic model instead of setup for a project-less user', () => {
	render(<ChatInputModelSelect />);

	expect(screen.getByLabelText('nao model')).toBeTruthy();
	expect(screen.getByText('Auto')).toBeTruthy();
	expect(screen.queryByText('Configure a model')).toBeNull();
});
