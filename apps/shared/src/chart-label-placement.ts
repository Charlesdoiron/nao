export interface PlacementBox {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface PlacementPoint {
	x: number;
	y: number;
}

export interface PlacementSegment {
	from: PlacementPoint;
	to: PlacementPoint;
}

export interface SeriesStroke extends PlacementSegment {
	seriesIndex: number;
}

export interface PlaceableLabel {
	anchor: PlacementPoint;
	natural: PlacementBox;
	width: number;
	height: number;
	seriesIndex: number;
	canMoveOutside: boolean;
	/** Horizontal span of the label's own bar; the label may slide or stack within it without a leader. */
	column?: { left: number; right: number };
}

export interface LabelScene {
	bounds: PlacementBox;
	marks: PlacementBox[];
	strokes: SeriesStroke[];
}

export interface PlacedLabel {
	index: number;
	box: PlacementBox;
	leader?: PlacementSegment;
}

type SpotMode = 'natural' | 'outside';

interface CandidateSpot {
	box: PlacementBox;
	cost: number;
}

const LEADER_ANCHOR_RADIUS = 3;
const RADIAL_DISTANCES = [6, 12, 18, 24, 30, 38, 46, 56, 68, 82, 98];
const RADIAL_DIRECTIONS = [
	{ x: 0, y: -1, penalty: 0 },
	{ x: -1, y: -1, penalty: 6 },
	{ x: 1, y: -1, penalty: 6 },
	{ x: -1, y: 0, penalty: 10 },
	{ x: 1, y: 0, penalty: 10 },
	{ x: -1, y: 1, penalty: 16 },
	{ x: 1, y: 1, penalty: 16 },
	{ x: 0, y: 1, penalty: 18 },
];
const RAIL_ROWS = 6;
const RAIL_ROW_STEP_RATIO = 0.5;
const RAIL_SHIFTS = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];
const RAIL_SHIFT_RATIO = 0.4;
const COLUMN_STACK_STEPS = 6;
const COLUMN_STACK_STEP_RATIO = 1 / 3;
const COLUMN_SHIFT_STEPS = [0, -0.5, 0.5, -1, 1];
const RAIL_VERTICAL_COST_RATIO = 0.5;
const RAIL_PENALTY = 8;

/**
 * Labels are taken in priority order. Labels whose natural spot is clear of marks, other series'
 * strokes and earlier labels stay put. Bar labels that collide then slide or stack within their own
 * column, which still reads as attached to the bar. Everything else moves to the cheapest free spot
 * outside the marks (around the point first, then a rail above the plot) and keeps a leader line back
 * to its point. Labels with no free spot are dropped.
 */
export function placeLabels(labels: PlaceableLabel[], scene: LabelScene): PlacedLabel[] {
	const placed: PlacedLabel[] = [];
	const displaced: number[] = [];

	labels.forEach((label, index) => {
		if (isFreeSpot(label.natural, label, scene, placed, 'natural')) {
			placed.push({ index, box: label.natural });
		} else if (label.canMoveOutside) {
			displaced.push(index);
		}
	});

	const needLeader = displaced.filter((index) => {
		const spot = findColumnSpot(labels[index], scene, placed);
		if (spot) {
			placed.push({ index, ...spot });
		}
		return !spot;
	});

	needLeader.forEach((index) => {
		const spot = findOutsideSpot(labels[index], scene, placed);
		if (spot) {
			placed.push({ index, ...spot });
		}
	});

	return placed.sort((a, b) => a.index - b.index);
}

export function boxesOverlap(a: PlacementBox, b: PlacementBox): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function findColumnSpot(
	label: PlaceableLabel,
	scene: LabelScene,
	placed: PlacedLabel[],
): Omit<PlacedLabel, 'index'> | null {
	const spot = columnSpots(label)
		.sort((a, b) => a.cost - b.cost)
		.find((candidate) => isFreeSpot(candidate.box, label, scene, placed, 'natural'));
	return spot ? { box: spot.box } : null;
}

function findOutsideSpot(
	label: PlaceableLabel,
	scene: LabelScene,
	placed: PlacedLabel[],
): Omit<PlacedLabel, 'index'> | null {
	const spots = [...radialSpots(label), ...railSpots(label, scene.bounds)].sort((a, b) => a.cost - b.cost);
	for (const spot of spots) {
		if (!isFreeSpot(spot.box, label, scene, placed, 'outside')) {
			continue;
		}
		const leader = buildLeader(label.anchor, spot.box);
		if (isLeaderClear(leader, placed)) {
			return { box: spot.box, leader };
		}
	}
	return null;
}

/** Stacks away from the bar (up for positive bars, down for negative) and slides within the bar's span. */
function columnSpots(label: PlaceableLabel): CandidateSpot[] {
	const column = label.column;
	if (!column) {
		return [];
	}
	const direction = label.natural.bottom <= label.anchor.y ? -1 : 1;
	const halfColumn = (column.right - column.left) / 2;
	const stackStep = label.height * COLUMN_STACK_STEP_RATIO;
	return Array.from({ length: COLUMN_STACK_STEPS + 1 }, (_, step) => step * stackStep).flatMap((lift) =>
		COLUMN_SHIFT_STEPS.map((step) => {
			const shift = step * halfColumn;
			return {
				box: offsetBox(label.natural, shift, direction * lift),
				cost: lift + Math.abs(shift),
			};
		}),
	);
}

function radialSpots(label: PlaceableLabel): CandidateSpot[] {
	return RADIAL_DIRECTIONS.flatMap((direction) =>
		RADIAL_DISTANCES.map((distance) => {
			const centerX = label.anchor.x + direction.x * (distance + label.width / 2);
			const centerY = label.anchor.y + direction.y * (distance + label.height / 2);
			return {
				box: boxAround(centerX, centerY, label.width, label.height),
				cost: distance + direction.penalty,
			};
		}),
	);
}

function railSpots(label: PlaceableLabel, bounds: PlacementBox): CandidateSpot[] {
	const rowStep = label.height * RAIL_ROW_STEP_RATIO;
	return Array.from({ length: RAIL_ROWS }, (_, row) => bounds.top + row * rowStep).flatMap((top) =>
		RAIL_SHIFTS.map((shift) => {
			const shiftPx = shift * label.width * RAIL_SHIFT_RATIO;
			const box = boxAround(label.anchor.x + shiftPx, top + label.height / 2, label.width, label.height);
			const verticalDistance = Math.max(0, label.anchor.y - box.bottom);
			return {
				box,
				cost: verticalDistance * RAIL_VERTICAL_COST_RATIO + Math.abs(shiftPx) + RAIL_PENALTY,
			};
		}),
	);
}

function isFreeSpot(
	box: PlacementBox,
	label: PlaceableLabel,
	scene: LabelScene,
	placed: PlacedLabel[],
	mode: SpotMode,
): boolean {
	if (!boxInside(box, scene.bounds)) {
		return false;
	}
	if (
		placed.some((other) => boxesOverlap(other.box, box) || (other.leader && segmentCrossesBox(other.leader, box)))
	) {
		return false;
	}
	if (scene.marks.some((mark) => boxesOverlap(mark, box))) {
		return false;
	}
	return !scene.strokes.some(
		(stroke) => (mode === 'outside' || stroke.seriesIndex !== label.seriesIndex) && segmentCrossesBox(stroke, box),
	);
}

function isLeaderClear(leader: PlacementSegment, placed: PlacedLabel[]): boolean {
	return !placed.some(
		(other) => segmentCrossesBox(leader, other.box) || (other.leader && segmentsIntersect(leader, other.leader)),
	);
}

function buildLeader(anchor: PlacementPoint, box: PlacementBox): PlacementSegment {
	const target = {
		x: clamp(anchor.x, box.left, box.right),
		y: clamp(anchor.y, box.top, box.bottom),
	};
	const length = Math.hypot(target.x - anchor.x, target.y - anchor.y);
	if (length <= LEADER_ANCHOR_RADIUS) {
		return { from: anchor, to: target };
	}
	const ratio = LEADER_ANCHOR_RADIUS / length;
	return {
		from: { x: anchor.x + (target.x - anchor.x) * ratio, y: anchor.y + (target.y - anchor.y) * ratio },
		to: target,
	};
}

function boxAround(centerX: number, centerY: number, width: number, height: number): PlacementBox {
	return {
		left: centerX - width / 2,
		right: centerX + width / 2,
		top: centerY - height / 2,
		bottom: centerY + height / 2,
	};
}

function offsetBox(box: PlacementBox, dx: number, dy: number): PlacementBox {
	return { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
}

function boxInside(box: PlacementBox, bounds: PlacementBox): boolean {
	return box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom;
}

function segmentCrossesBox(segment: PlacementSegment, box: PlacementBox): boolean {
	if (pointInsideBox(segment.from, box) || pointInsideBox(segment.to, box)) {
		return true;
	}
	const topLeft = { x: box.left, y: box.top };
	const topRight = { x: box.right, y: box.top };
	const bottomLeft = { x: box.left, y: box.bottom };
	const bottomRight = { x: box.right, y: box.bottom };
	return [
		{ from: topLeft, to: topRight },
		{ from: topRight, to: bottomRight },
		{ from: bottomRight, to: bottomLeft },
		{ from: bottomLeft, to: topLeft },
	].some((edge) => segmentsIntersect(segment, edge));
}

function pointInsideBox(point: PlacementPoint, box: PlacementBox): boolean {
	return point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom;
}

function segmentsIntersect(a: PlacementSegment, b: PlacementSegment): boolean {
	const d1 = orientation(b.from, b.to, a.from);
	const d2 = orientation(b.from, b.to, a.to);
	const d3 = orientation(a.from, a.to, b.from);
	const d4 = orientation(a.from, a.to, b.to);
	return d1 * d2 < 0 && d3 * d4 < 0;
}

function orientation(origin: PlacementPoint, target: PlacementPoint, point: PlacementPoint): number {
	return Math.sign((target.x - origin.x) * (point.y - origin.y) - (target.y - origin.y) * (point.x - origin.x));
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
