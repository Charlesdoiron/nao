import { CHART_FONT_STACK } from './chart-fonts';

/** Server-side fallback (no canvas): matches the 7px-per-character estimate used for 12px axis ticks. */
const FALLBACK_CHARACTER_WIDTH_RATIO = 7 / 12;

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Rendered width of a chart label, measured with the chart font in the browser and estimated elsewhere. */
export function measureChartTextWidth(text: string, fontSize: number): number {
	const context = getMeasureContext();
	if (!context) {
		return text.length * fontSize * FALLBACK_CHARACTER_WIDTH_RATIO;
	}
	context.font = `${fontSize}px ${CHART_FONT_STACK}`;
	return context.measureText(text).width;
}

function getMeasureContext(): CanvasRenderingContext2D | null {
	if (measureContext === undefined) {
		measureContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	}
	return measureContext;
}
