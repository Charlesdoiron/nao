import { useRef, useState } from 'react';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useDefaultLayout } from 'react-resizable-panels';
import type { ReactNode } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';

import { ReplayIconButton } from '@/components/settings/replay-header';
import { ResizablePanel, ResizablePanelGroup, ResizableSeparator } from '@/components/ui/resizable';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

const CHARTS_DEFAULT_SIZE = 368;
const CHARTS_MIN_SIZE = 140;
const REPLAY_MIN_SIZE = 240;
const SIZE_TOLERANCE = 2;

type UsageReplaySplitProps = {
	charts?: ReactNode;
	replayToolbar: ReactNode;
	replay: ReactNode;
};

export function UsageReplaySplit({ charts, replayToolbar, replay }: UsageReplaySplitProps) {
	const isDesktop = useMediaQuery('(min-width: 1280px)');

	if (!charts) {
		return <ReplaySection toolbar={replayToolbar}>{replay}</ReplaySection>;
	}

	if (!isDesktop) {
		return (
			<>
				<div className='px-4 md:px-8 md:pb-8'>{charts}</div>
				<ReplaySection toolbar={replayToolbar} className='min-h-[400px]'>
					{replay}
				</ReplaySection>
			</>
		);
	}

	return <ResizableUsageReplaySplit charts={charts} replayToolbar={replayToolbar} replay={replay} />;
}

function ResizableUsageReplaySplit({ charts, replayToolbar, replay }: Required<UsageReplaySplitProps>) {
	const chartsPanelRef = useRef<PanelImperativeHandle | null>(null);
	const [chartsSize, setChartsSize] = useState(CHARTS_DEFAULT_SIZE);
	const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: 'usage-replay-split', storage: localStorage });

	const isChartsCollapsed = chartsSize <= SIZE_TOLERANCE;
	const isDefaultLayout = Math.abs(chartsSize - CHARTS_DEFAULT_SIZE) <= SIZE_TOLERANCE;

	const maximizeReplay = () => chartsPanelRef.current?.collapse();
	const resetLayout = () => chartsPanelRef.current?.resize(CHARTS_DEFAULT_SIZE);

	const layoutControls = (
		<div className='flex items-center gap-0.5 border-l pl-1.5'>
			{!isDefaultLayout && !isChartsCollapsed && (
				<ReplayIconButton label='Reset layout' onClick={resetLayout}>
					<RotateCcw className='size-3.5' />
				</ReplayIconButton>
			)}
			{isChartsCollapsed ? (
				<ReplayIconButton label='Show charts' onClick={resetLayout}>
					<Minimize2 className='size-3.5' />
				</ReplayIconButton>
			) : (
				<ReplayIconButton label='Maximize replay' onClick={maximizeReplay}>
					<Maximize2 className='size-3.5' />
				</ReplayIconButton>
			)}
		</div>
	);

	return (
		<ResizablePanelGroup
			id='usage-replay-split'
			orientation='vertical'
			className='flex-1 min-h-0'
			defaultLayout={defaultLayout}
			onLayoutChanged={onLayoutChanged}
		>
			<ResizablePanel
				id='charts'
				panelRef={chartsPanelRef}
				defaultSize={CHARTS_DEFAULT_SIZE}
				minSize={CHARTS_MIN_SIZE}
				maxSize={CHARTS_DEFAULT_SIZE}
				collapsible
				groupResizeBehavior='preserve-pixel-size'
				onResize={(size) => setChartsSize(size.inPixels)}
			>
				<div className='h-full overflow-y-auto px-8 pb-4'>{charts}</div>
			</ResizablePanel>

			<ResizableSeparator
				withHandle
				title='Drag to resize the replay, double-click to reset'
				className='transition-colors data-[separator=hover]:bg-primary/50 data-[separator=active]:bg-primary data-[separator=focus]:bg-primary'
			/>

			<ResizablePanel id='replay' minSize={REPLAY_MIN_SIZE}>
				<ReplaySection toolbar={replayToolbar} accessory={layoutControls} className='h-full pt-3'>
					{replay}
				</ReplaySection>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

function ReplaySection({
	toolbar,
	accessory,
	className,
	children,
}: {
	toolbar: ReactNode;
	accessory?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<section className={cn('flex flex-1 flex-col w-full overflow-hidden', className)}>
			<div className='flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pb-2 md:px-8'>
				<h2 className='text-sm font-semibold'>Chats replay</h2>
				<div className='flex flex-wrap items-center gap-2'>
					{toolbar}
					{accessory}
				</div>
			</div>
			{children}
		</section>
	);
}
