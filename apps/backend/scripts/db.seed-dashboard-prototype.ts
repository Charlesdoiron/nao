import s from '../src/db/abstractSchema';
import { db } from '../src/db/db';

const SEED_USER_EMAIL = 'test@test.test';
const CHAT_TITLE = 'Sales performance review';
const STORY_SLUG = 'sales-performance';
const STORY_TITLE = 'Sales performance';
const FIRST_MONTH = new Date(2025, 0, 1);

const REGIONS = ['emea', 'north_america', 'apac', 'latam'] as const;
const REGION_WEIGHTS = { emea: 0.34, north_america: 0.41, apac: 0.17, latam: 0.08 };
const CHANNELS = [
	{ channel: 'Organic search', share: 0.31, conversion_rate: 3.4 },
	{ channel: 'Paid search', share: 0.24, conversion_rate: 2.8 },
	{ channel: 'Email', share: 0.18, conversion_rate: 4.9 },
	{ channel: 'Partners', share: 0.15, conversion_rate: 2.1 },
	{ channel: 'Social', share: 0.12, conversion_rate: 1.6 },
];
const PRODUCTS = [
	{ product: 'Trail Runner Pro', category: 'Footwear', channel: 'Organic search', price: 149 },
	{ product: 'Summit Shell Jacket', category: 'Outerwear', channel: 'Paid search', price: 289 },
	{ product: 'Ultralight Daypack', category: 'Bags', channel: 'Email', price: 119 },
	{ product: 'Merino Base Layer', category: 'Apparel', channel: 'Organic search', price: 89 },
	{ product: 'Alpine Down Vest', category: 'Outerwear', channel: 'Partners', price: 199 },
	{ product: 'Approach Shoe', category: 'Footwear', channel: 'Social', price: 139 },
	{ product: 'Hydration Belt', category: 'Accessories', channel: 'Email', price: 49 },
	{ product: 'Storm Rain Pants', category: 'Outerwear', channel: 'Paid search', price: 159 },
	{ product: 'Travel Duffel 60L', category: 'Bags', channel: 'Partners', price: 179 },
	{ product: 'Trail Socks 3-pack', category: 'Accessories', channel: 'Organic search', price: 29 },
	{ product: 'Insulated Bottle', category: 'Accessories', channel: 'Social', price: 39 },
	{ product: 'Fleece Hoodie', category: 'Apparel', channel: 'Email', price: 99 },
];

const STORY_CODE = `Revenue, orders and channel mix for the online store. Numbers are refreshed every morning.

<grid widths="1,2">
<chart query_id="query_monthly_kpis" chart_type="kpi_card" x_axis_key="month" x_axis_type="date" comparison_mode="percentage" series='[{"data_key":"revenue","label":"Revenue","value_format":{"d3_format":",.0f","prefix":"$"}},{"data_key":"orders","label":"Orders","value_format":{"d3_format":",.0f"}}]' title="Headline" />

<chart query_id="query_monthly_kpis" chart_type="area" x_axis_key="month" x_axis_type="date" series='[{"data_key":"revenue","label":"Revenue","value_format":{"d3_format":",.0f","prefix":"$"}}]' title="Monthly revenue" />
</grid>

## Where the revenue comes from

<grid cols="2">
<chart query_id="query_revenue_by_region" chart_type="stacked_bar" x_axis_key="month" x_axis_type="date" series='[{"data_key":"north_america","label":"North America"},{"data_key":"emea","label":"EMEA"},{"data_key":"apac","label":"APAC"},{"data_key":"latam","label":"LATAM"}]' title="Revenue by region" />

<chart query_id="query_revenue_by_channel" chart_type="bar" x_axis_key="channel" series='[{"data_key":"revenue","label":"Revenue","value_format":{"d3_format":",.0f","prefix":"$"}}]' title="Revenue by channel" />
</grid>

## Top products

<table query_id="query_top_products" title="Top products this quarter" />
`;

async function seed() {
	const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, SEED_USER_EMAIL) });
	const projectMember = user
		? await db.query.projectMember.findFirst({ where: (m, { eq }) => eq(m.userId, user.id) })
		: null;
	if (!user || !projectMember) {
		throw new Error('Run `npm run db:seed` first to create the test user and project.');
	}

	const [chat] = await db
		.insert(s.chat)
		.values({ userId: user.id, projectId: projectMember.projectId, title: CHAT_TITLE })
		.returning()
		.execute();

	const [story] = await db
		.insert(s.story)
		.values({ chatId: chat.id, slug: STORY_SLUG, title: STORY_TITLE, isLive: true })
		.returning()
		.execute();

	await db
		.insert(s.storyVersion)
		.values({ storyId: story.id, version: 1, code: STORY_CODE, action: 'create', source: 'assistant' })
		.execute();

	await db.insert(s.storyDataCache).values({ storyId: story.id, queryData: buildQueryData() }).execute();

	console.log(`Seeded story "${STORY_TITLE}" → /stories/${story.id}`);
}

function buildQueryData() {
	const months = listMonths();
	const monthly = months.map((month, index) => {
		const isCurrentMonth = index === months.length - 1;
		const seasonality = 1 + 0.18 * Math.sin((index / 12) * Math.PI * 2 - 1.2);
		const growth = 1 + index * 0.025;
		const monthToDateRatio = isCurrentMonth ? new Date().getDate() / 31 : 1;
		const revenue = Math.round(412_000 * seasonality * growth * monthToDateRatio + jitter(index) * 9_000);
		const orders = Math.round(revenue / (118 + (index % 5) * 2.5));
		return { month, revenue, orders, avg_order_value: Math.round((revenue / orders) * 100) / 100 };
	});

	const byRegion = monthly.map(({ month, revenue }, index) =>
		Object.fromEntries([
			['month', month],
			...REGIONS.map((region) => [
				region,
				Math.round(revenue * REGION_WEIGHTS[region] * (1 + jitter(index + region.length) * 0.06)),
			]),
		]),
	);

	const lastQuarterRevenue = monthly.slice(-4, -1).reduce((total, row) => total + row.revenue, 0);
	const byChannel = CHANNELS.map(({ channel, share, conversion_rate }) => {
		const revenue = Math.round(lastQuarterRevenue * share);
		return { channel, revenue, orders: Math.round(revenue / 121), conversion_rate };
	});

	const topProducts = PRODUCTS.map(({ product, category, channel, price }, index) => {
		const units = Math.round(2_400 / (index + 1.6) + 180);
		return {
			product,
			category,
			channel,
			revenue: units * price,
			units,
			last_order_date: months[months.length - 1 - (index % 3)].replace(
				/-01$/,
				`-${String(12 + index).padStart(2, '0')}`,
			),
		};
	}).sort((a, b) => b.revenue - a.revenue);

	return {
		query_monthly_kpis: { data: monthly, columns: ['month', 'revenue', 'orders', 'avg_order_value'] },
		query_revenue_by_region: { data: byRegion, columns: ['month', ...REGIONS] },
		query_revenue_by_channel: { data: byChannel, columns: ['channel', 'revenue', 'orders', 'conversion_rate'] },
		query_top_products: {
			data: topProducts,
			columns: ['product', 'category', 'channel', 'revenue', 'units', 'last_order_date'],
		},
	};
}

function listMonths(): string[] {
	const months: string[] = [];
	const today = new Date();
	const cursor = new Date(FIRST_MONTH);
	while (cursor <= today) {
		months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`);
		cursor.setMonth(cursor.getMonth() + 1);
	}
	return months;
}

function jitter(seed: number): number {
	const value = Math.sin(seed * 12.9898) * 43758.5453;
	return (value - Math.floor(value)) * 2 - 1;
}

seed()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
