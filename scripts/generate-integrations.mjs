import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { parse as parseCsv } from 'csv-parse/sync';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';

const projectRoot = path.resolve(import.meta.dirname, '..');
const generatedRoot = path.join(projectRoot, 'src', 'content', 'integrations', 'generated');
const generatedDatasetPath = path.join(projectRoot, 'src', 'data', 'generated-datasets.json');
const datasetsRoot = path.join(projectRoot, 'datasets');
const knowledgeRoot = path.join(homedir(), '.knowledge');
const githubToken = process.env.GITHUB_TOKEN;
const previewRowLimit = 8;
const remoteMarkdownSources = [
	{
		title: 'astro-gcs README',
		summary: 'Remote Markdown fetched directly from the current site repository.',
		repoLabel: 'gvillarroel/astro-gcs',
		repoUrl: 'https://github.com/gvillarroel/astro-gcs',
		rawUrl: 'https://raw.githubusercontent.com/gvillarroel/astro-gcs/master/README.md',
	},
	{
		title: 'Astro README',
		summary: 'Remote Markdown fetched from the Astro framework repository.',
		repoLabel: 'withastro/astro',
		repoUrl: 'https://github.com/withastro/astro',
		rawUrl: 'https://raw.githubusercontent.com/withastro/astro/main/README.md',
	},
];

async function ensureDir(target) {
	await mkdir(target, { recursive: true });
}

async function writeMarkdownFile(target, data, body) {
	const frontmatter = Object.entries(data)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([key, value]) => `${key}: ${formatFrontmatterValue(value)}`)
		.join('\n');
	const content = `---\n${frontmatter}\n---\n\n${body.trim()}\n`;
	await ensureDir(path.dirname(target));
	await writeFile(target, content, 'utf8');
}

function formatFrontmatterValue(value) {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => formatFrontmatterValue(entry)).join(', ')}]`;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	const normalized = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `"${normalized}"`;
}

function sanitizeSegment(value) {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-');
}

async function fetchText(url) {
	const headers = {
		accept: 'text/plain, text/markdown;q=0.9, */*;q=0.8',
		'user-agent': 'astro-gcs-smoke',
	};
	if (githubToken) {
		headers.authorization = `Bearer ${githubToken}`;
	}
	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`Request failed for ${url}: ${response.status}`);
	}
	return response.text();
}

function normalizeRelativePath(value) {
	return value.replace(/^\.\//, '').replace(/^\/+/, '');
}

function splitTargetAndSuffix(value) {
	const match = value.match(/^([^\s]+)([\s\S]*)$/);
	if (!match) {
		return { target: value, suffix: '' };
	}
	return { target: match[1], suffix: match[2] ?? '' };
}

function normalizeRemoteMarkdown(markdown, source) {
	const rawParts = source.rawUrl.split('/');
	const branch = rawParts[5];
	const rawBase = `https://raw.githubusercontent.com/${source.repoLabel}/${branch}/`;
	const blobBase = `https://github.com/${source.repoLabel}/blob/${branch}/`;

	return markdown
		.replace(/!\[([^\]]*)\]\((?!https?:|#|mailto:)([^)]+)\)/g, (_match, alt, target) => {
			const parts = splitTargetAndSuffix(target);
			return `![${alt}](${rawBase}${normalizeRelativePath(parts.target)}${parts.suffix})`;
		})
		.replace(/\[([^\]]+)\]\((?!https?:|#|mailto:)([^)]+)\)/g, (_match, label, target) => {
			const parts = splitTargetAndSuffix(target);
			return `[${label}](${blobBase}${normalizeRelativePath(parts.target)}${parts.suffix})`;
		})
		.replace(/src="(?!https?:|#|mailto:)([^"]+)"/g, (_match, target) => {
			return `src="${rawBase}${normalizeRelativePath(target)}"`;
		})
		.replace(/href="(?!https?:|#|mailto:)([^"]+)"/g, (_match, target) => {
			return `href="${blobBase}${normalizeRelativePath(target)}"`;
		});
}

async function generateRemoteGithubReadmes() {
	let count = 0;

	for (const [index, source] of remoteMarkdownSources.entries()) {
		try {
			const markdown = normalizeRemoteMarkdown(await fetchText(source.rawUrl), source);
			const body = [
				'> Remote Markdown fetched at Astro build time.',
				`> Repository: [${source.repoLabel}](${source.repoUrl})`,
				'',
				markdown,
			].join('\n');

			await writeMarkdownFile(
				path.join(generatedRoot, 'remote', `${sanitizeSegment(source.title)}.md`),
				{
					title: source.title,
					summary: source.summary,
					section: 'remote',
					integration: 'github',
					sourceLabel: source.repoLabel,
					sourceUrl: source.repoUrl,
					order: index + 1,
					generatedAt: new Date().toISOString(),
				},
				body,
			);
			count += 1;
		} catch {
			// Skip unavailable remote markdown sources.
		}
	}

	return count;
}

async function collectFiles(root, extension) {
	const entries = await readdir(root, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const target = path.join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(target, extension)));
			continue;
		}
		if (entry.isFile() && target.endsWith(extension)) {
			files.push(target);
		}
	}

	return files;
}

async function collectFilesByExtensions(root, extensions) {
	const entries = await readdir(root, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const target = path.join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFilesByExtensions(target, extensions)));
			continue;
		}
		if (entry.isFile() && extensions.includes(path.extname(target).toLowerCase())) {
			files.push(target);
		}
	}

	return files;
}

function extractBody(markdown) {
	return matter(markdown).content.trim();
}

function buildSummary(text) {
	return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function titleFromSlug(value) {
	return value
		.split(/[-_/]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ');
}

function normalizeDatasetValue(value) {
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value === 'bigint') {
		const asNumber = Number(value);
		return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return JSON.stringify(value.map((entry) => normalizeDatasetValue(entry)));
	}
	if (typeof value === 'object') {
		return JSON.stringify(value);
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed === '' ? null : trimmed;
	}
	return value;
}

function columnValueLabel(value) {
	if (value === null || value === undefined || value === '') {
		return 'Empty';
	}
	if (typeof value === 'string') {
		return value;
	}
	return String(value);
}

function parseBoolean(value) {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		if (value === 1) {
			return true;
		}
		if (value === 0) {
			return false;
		}
		return null;
	}
	if (typeof value !== 'string') {
		return null;
	}
	switch (value.trim().toLowerCase()) {
		case 'true':
		case 'yes':
		case 'y':
		case '1':
			return true;
		case 'false':
		case 'no':
		case 'n':
		case '0':
			return false;
		default:
			return null;
	}
}

function parseNumeric(value) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value !== 'string') {
		return null;
	}
	const compact = value.trim().replace(/,/g, '');
	if (!compact || /[a-z]/i.test(compact.replace(/[eE+-]/g, ''))) {
		return null;
	}
	const parsed = Number(compact);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed || /^\d+(\.\d+)?$/.test(trimmed)) {
		return null;
	}
	const parsed = Date.parse(trimmed);
	return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function inferColumnKind(values) {
	const present = values.filter((value) => value !== null);
	if (present.length === 0) {
		return 'string';
	}

	const booleanMatches = present.filter((value) => parseBoolean(value) !== null).length;
	if (booleanMatches === present.length) {
		return 'boolean';
	}

	const numericMatches = present.filter((value) => parseNumeric(value) !== null).length;
	if (numericMatches / present.length >= 0.85) {
		return 'number';
	}

	const dateMatches = present.filter((value) => parseDateValue(value) !== null).length;
	if (dateMatches / present.length >= 0.85) {
		return 'date';
	}

	return 'string';
}

function buildFrequencyEntries(values, limit = 8) {
	const counts = new Map();
	for (const value of values) {
		const label = columnValueLabel(value);
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.slice(0, limit)
		.map(([label, count]) => ({ label, count }));
}

function buildHistogram(numbers) {
	if (numbers.length === 0) {
		return null;
	}
	const min = Math.min(...numbers);
	const max = Math.max(...numbers);
	if (min === max) {
		return {
			labels: [String(min)],
			counts: [numbers.length],
		};
	}

	const binCount = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(numbers.length))));
	const width = (max - min) / binCount;
	const counts = Array.from({ length: binCount }, () => 0);
	const labels = Array.from({ length: binCount }, (_value, index) => {
		const start = min + index * width;
		const end = index === binCount - 1 ? max : start + width;
		return `${start.toFixed(2)} - ${end.toFixed(2)}`;
	});

	for (const value of numbers) {
		const index = value === max ? binCount - 1 : Math.min(binCount - 1, Math.floor((value - min) / width));
		counts[index] += 1;
	}

	return { labels, counts };
}

function buildPlotLayout(title, extra = {}) {
	return {
		title,
		paper_bgcolor: 'rgba(0,0,0,0)',
		plot_bgcolor: 'rgba(6,12,14,0.86)',
		font: {
			color: '#d7f7e7',
			family: 'Cascadia Code, JetBrains Mono, IBM Plex Mono, monospace',
		},
		margin: { t: 52, r: 24, b: 52, l: 52 },
		xaxis: {
			gridcolor: 'rgba(123,247,199,0.12)',
			zerolinecolor: 'rgba(123,247,199,0.12)',
		},
		yaxis: {
			gridcolor: 'rgba(123,247,199,0.12)',
			zerolinecolor: 'rgba(123,247,199,0.12)',
		},
		...extra,
	};
}

function analyzeColumn(name, rows) {
	const rawValues = rows.map((row) => row[name] ?? null);
	const kind = inferColumnKind(rawValues);
	const present = rawValues.filter((value) => value !== null);
	const distinctValues = new Set(present.map((value) => columnValueLabel(value)));
	const sampleValues = Array.from(distinctValues).slice(0, 5);
	const profile = {
		name,
		kind,
		nullCount: rawValues.length - present.length,
		distinctCount: distinctValues.size,
		sampleValues,
		topValues: buildFrequencyEntries(present),
	};

	if (kind === 'number') {
		const numbers = present.map((value) => parseNumeric(value)).filter((value) => value !== null);
		const total = numbers.reduce((sum, value) => sum + value, 0);
		return {
			...profile,
			numericSummary: {
				min: Math.min(...numbers),
				max: Math.max(...numbers),
				avg: numbers.length ? total / numbers.length : 0,
			},
			typedValues: numbers,
		};
	}

	if (kind === 'date') {
		const values = present.map((value) => parseDateValue(value)).filter((value) => value !== null).sort();
		return {
			...profile,
			timeSummary: {
				min: values[0],
				max: values.at(-1),
			},
			typedValues: values,
		};
	}

	if (kind === 'boolean') {
		return {
			...profile,
			typedValues: present.map((value) => parseBoolean(value)),
		};
	}

	return {
		...profile,
		typedValues: present,
	};
}

function buildDatasetCharts(datasetName, rows, columns) {
	const charts = [];
	const numericColumns = columns.filter((column) => column.kind === 'number');
	const categoricalColumns = columns.filter((column) => column.kind === 'string' || column.kind === 'boolean');
	const dateColumns = columns.filter((column) => column.kind === 'date');

	for (const column of numericColumns.slice(0, 2)) {
		const histogram = buildHistogram(column.typedValues);
		if (!histogram) {
			continue;
		}
		charts.push({
			id: `hist-${sanitizeSegment(column.name)}`,
			title: `${column.name} distribution`,
			description: `Histogram built from numeric values in ${column.name}.`,
			traces: [
				{
					type: 'bar',
					x: histogram.labels,
					y: histogram.counts,
					marker: {
						color: '#7bf7c7',
						line: { color: '#b6ffd9', width: 1 },
					},
				},
			],
			layout: buildPlotLayout(`${datasetName}: ${column.name}`, {
				xaxis: {
					title: column.name,
					tickangle: -24,
					gridcolor: 'rgba(123,247,199,0.08)',
				},
				yaxis: {
					title: 'Rows',
					gridcolor: 'rgba(123,247,199,0.12)',
				},
			}),
		});
	}

	for (const column of categoricalColumns.slice(0, 2)) {
		const entries = buildFrequencyEntries(column.typedValues, 10);
		if (!entries.length) {
			continue;
		}
		charts.push({
			id: `bar-${sanitizeSegment(column.name)}`,
			title: `${column.name} top values`,
			description: `Most frequent values found in ${column.name}.`,
			traces: [
				{
					type: 'bar',
					x: entries.map((entry) => entry.label),
					y: entries.map((entry) => entry.count),
					marker: {
						color: '#8fb7ff',
						line: { color: '#d7f7e7', width: 1 },
					},
				},
			],
			layout: buildPlotLayout(`${datasetName}: ${column.name}`, {
				xaxis: {
					title: column.name,
					tickangle: -24,
					gridcolor: 'rgba(123,247,199,0.08)',
				},
				yaxis: {
					title: 'Rows',
					gridcolor: 'rgba(123,247,199,0.12)',
				},
			}),
		});
	}

	if (numericColumns.length >= 2) {
		const left = numericColumns[0];
		const right = numericColumns[1];
		const points = rows
			.map((row) => ({
				x: parseNumeric(row[left.name]),
				y: parseNumeric(row[right.name]),
			}))
			.filter((point) => point.x !== null && point.y !== null)
			.slice(0, 250);

		if (points.length >= 2) {
			charts.push({
				id: `scatter-${sanitizeSegment(left.name)}-${sanitizeSegment(right.name)}`,
				title: `${left.name} vs ${right.name}`,
				description: `Quick scatter view comparing the first two numeric columns.`,
				traces: [
					{
						type: 'scatter',
						mode: 'markers',
						x: points.map((point) => point.x),
						y: points.map((point) => point.y),
						marker: {
							color: '#7bf7c7',
							size: 10,
							line: { color: '#042d1d', width: 1 },
						},
					},
				],
				layout: buildPlotLayout(`${datasetName}: ${left.name} vs ${right.name}`, {
					xaxis: { title: left.name, gridcolor: 'rgba(123,247,199,0.08)' },
					yaxis: { title: right.name, gridcolor: 'rgba(123,247,199,0.12)' },
				}),
			});
		}
	}

	if (dateColumns.length) {
		const dateColumn = dateColumns[0];
		const counts = new Map();
		for (const value of dateColumn.typedValues) {
			const bucket = value.slice(0, 10);
			counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
		}

		const dates = Array.from(counts.keys()).sort();
		charts.push({
			id: `timeseries-${sanitizeSegment(dateColumn.name)}`,
			title: `${dateColumn.name} row cadence`,
			description: `Rows grouped by calendar day using ${dateColumn.name}.`,
			traces: [
				{
					type: 'scatter',
					mode: 'lines+markers',
					x: dates,
					y: dates.map((date) => counts.get(date) ?? 0),
					line: { color: '#7bf7c7', width: 2 },
					marker: { color: '#b6ffd9', size: 8 },
				},
			],
			layout: buildPlotLayout(`${datasetName}: ${dateColumn.name} over time`, {
				xaxis: { title: dateColumn.name, gridcolor: 'rgba(123,247,199,0.08)' },
				yaxis: { title: 'Rows', gridcolor: 'rgba(123,247,199,0.12)' },
			}),
		});

		const metricColumn = numericColumns[0];
		if (metricColumn) {
			const grouped = new Map();
			for (const row of rows) {
				const dateValue = parseDateValue(row[dateColumn.name]);
				const metricValue = parseNumeric(row[metricColumn.name]);
				if (!dateValue || metricValue === null) {
					continue;
				}
				const bucket = dateValue.slice(0, 10);
				const existing = grouped.get(bucket) ?? { sum: 0, count: 0 };
				existing.sum += metricValue;
				existing.count += 1;
				grouped.set(bucket, existing);
			}

			const datesWithMetric = Array.from(grouped.keys()).sort();
			if (datesWithMetric.length) {
				charts.push({
					id: `metric-${sanitizeSegment(dateColumn.name)}-${sanitizeSegment(metricColumn.name)}`,
					title: `${metricColumn.name} average by ${dateColumn.name}`,
					description: `Average ${metricColumn.name} grouped by day.`,
					traces: [
						{
							type: 'scatter',
							mode: 'lines+markers',
							x: datesWithMetric,
							y: datesWithMetric.map((date) => {
								const entry = grouped.get(date);
								return entry ? Number((entry.sum / entry.count).toFixed(2)) : 0;
							}),
							line: { color: '#8fb7ff', width: 2 },
							marker: { color: '#d7f7e7', size: 8 },
						},
					],
					layout: buildPlotLayout(`${datasetName}: average ${metricColumn.name}`, {
						xaxis: { title: dateColumn.name, gridcolor: 'rgba(123,247,199,0.08)' },
						yaxis: { title: metricColumn.name, gridcolor: 'rgba(123,247,199,0.12)' },
					}),
				});
			}
		}
	}

	return charts.slice(0, 5);
}

function buildDatasetSummary(file, rows) {
	const relativePath = path.relative(projectRoot, file).replace(/\\/g, '/');
	const datasetId = sanitizeSegment(relativePath.replace(/[/.]+/g, '-'));
	const name = titleFromSlug(path.basename(file, path.extname(file)));
	const normalizedRows = rows.map((row) =>
		Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeDatasetValue(value)])),
	);
	const columnNames = Array.from(
		new Set(normalizedRows.flatMap((row) => Object.keys(row))),
	).sort((left, right) => left.localeCompare(right));
	const analyzedColumns = columnNames.map((columnName) => analyzeColumn(columnName, normalizedRows));
	const charts = buildDatasetCharts(name, normalizedRows, analyzedColumns);

	return {
		id: datasetId,
		slug: datasetId,
		name,
		format: path.extname(file).replace('.', '').toUpperCase(),
		relativePath,
		rowCount: normalizedRows.length,
		columnCount: columnNames.length,
		columns: analyzedColumns.map(({ typedValues, ...column }) => column),
		previewRows: normalizedRows.slice(0, previewRowLimit),
		charts,
	};
}

async function readDatasetRows(file) {
	const extension = path.extname(file).toLowerCase();
	if (extension === '.csv') {
		const raw = await readFile(file, 'utf8');
		return parseCsv(raw, {
			columns: true,
			skip_empty_lines: true,
			bom: true,
			relax_column_count: true,
		});
	}
	if (extension === '.parquet') {
		const parquetFile = await asyncBufferFromFile(file);
		return parquetReadObjects({ file: parquetFile });
	}
	throw new Error(`Unsupported dataset format: ${extension}`);
}

async function writeDatasetCatalog(datasets) {
	const payload = {
		generatedAt: new Date().toISOString(),
		sourceRoot: 'datasets',
		datasetCount: datasets.length,
		datasets,
	};
	await ensureDir(path.dirname(generatedDatasetPath));
	await writeFile(generatedDatasetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function generateDatasetSummaries() {
	try {
		const files = await collectFilesByExtensions(datasetsRoot, ['.csv', '.parquet']);
		const datasets = [];

		for (const file of files.sort((left, right) => left.localeCompare(right))) {
			try {
				const rows = await readDatasetRows(file);
				datasets.push(buildDatasetSummary(file, rows));
			} catch (error) {
				datasets.push({
					id: sanitizeSegment(path.relative(projectRoot, file).replace(/[/.]+/g, '-')),
					slug: sanitizeSegment(path.relative(projectRoot, file).replace(/[/.]+/g, '-')),
					name: titleFromSlug(path.basename(file, path.extname(file))),
					format: path.extname(file).replace('.', '').toUpperCase(),
					relativePath: path.relative(projectRoot, file).replace(/\\/g, '/'),
					rowCount: 0,
					columnCount: 0,
					columns: [],
					previewRows: [],
					charts: [],
					error: error instanceof Error ? error.message : 'Unknown dataset error',
				});
			}
		}

		await writeDatasetCatalog(datasets);
		return datasets.length;
	} catch {
		await writeDatasetCatalog([]);
		return 0;
	}
}

async function generateKnowledgeMarkdownExamples() {
	const sources = [
		{
			dirs: [
				path.join(knowledgeRoot, 'tmp', 'confluence'),
				path.join(knowledgeRoot, 'T', 'confluence'),
			],
			pattern: '.md',
			targetDir: 'confluence',
			integration: 'confluence',
			limit: 4,
		},
		{
			dirs: [path.join(knowledgeRoot, 'tmp', 'jira')],
			pattern: '.md',
			targetDir: 'jira',
			integration: 'jira',
			limit: 3,
		},
	];
	let count = 0;

	for (const source of sources) {
		try {
			let files = [];
			for (const dir of source.dirs) {
				try {
					files = await collectFiles(dir, source.pattern);
				} catch {
					files = [];
				}
				if (files.length > 0) {
					break;
				}
			}
			if (files.length === 0) {
				continue;
			}
			const sorted = await Promise.all(
				files.map(async (file) => ({
					file,
					stats: await stat(file),
				})),
			);
			sorted.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs);

			for (const [index, entry] of sorted.slice(0, source.limit).entries()) {
				const raw = await readFile(entry.file, 'utf8');
				const parsed = matter(raw);
				const title = parsed.data.title ?? path.basename(entry.file, path.extname(entry.file));
				const sourceUrl = parsed.data.web_url ?? '';
				const contentBody = extractBody(raw);
				const body = [
					'> Synced from the local `.knowledge` store and rendered by Astro during the static build.',
					sourceUrl ? `> Source: [Open original record](${sourceUrl})` : null,
					'',
					contentBody,
				]
					.filter(Boolean)
					.join('\n');

				await writeMarkdownFile(
					path.join(generatedRoot, 'knowledge', source.targetDir, `${sanitizeSegment(title)}.md`),
					{
						title,
						summary: buildSummary(contentBody),
						section: 'knowledge',
						integration: source.integration,
						sourceLabel: source.integration.toUpperCase(),
						sourceUrl,
						order: index + 1,
						generatedAt: new Date().toISOString(),
					},
					body,
				);
				count += 1;
			}
		} catch {
			// Skip unavailable knowledge segments.
		}
	}

	try {
		const ahaDir = path.join(knowledgeRoot, 'T', 'aha', 'aha-demo', 'features');
		const files = await collectFiles(ahaDir, '.json');
		const picked = files
			.sort((left, right) => left.localeCompare(right))
			.slice(0, 4);

		for (const [index, file] of picked.entries()) {
			const payload = JSON.parse(await readFile(file, 'utf8'));
			const title = payload.name ?? payload.reference_num ?? path.basename(file, '.json');
			const body = [
				'> Synced from the local `.knowledge` store and converted from Aha JSON into Markdown during the Astro build.',
				payload.url ? `> Source: [Open Aha feature](${payload.url})` : null,
				'',
				`# ${title}`,
				'',
				`- Reference: ${payload.reference_num ?? 'Unknown'}`,
				`- Product ID: ${payload.product_id ?? 'Unknown'}`,
				`- Record ID: ${payload.id ?? 'Unknown'}`,
				`- Created: ${payload.created_at ?? 'Unknown'}`,
				'',
				'```json',
				JSON.stringify(payload, null, 2),
				'```',
			]
				.filter(Boolean)
				.join('\n');

			await writeMarkdownFile(
				path.join(generatedRoot, 'knowledge', 'aha', `${sanitizeSegment(title)}.md`),
				{
					title,
					summary: `Aha feature ${payload.reference_num ?? ''}`.trim(),
					section: 'knowledge',
					integration: 'aha',
					sourceLabel: payload.reference_num ?? 'Aha feature',
					sourceUrl: payload.url ?? '',
					order: index + 1,
					generatedAt: new Date().toISOString(),
				},
				body,
			);
			count += 1;
		}
	} catch {
		// Skip unavailable Aha data.
	}

	return count;
}

async function writeStatusPage(remoteCount, knowledgeCount) {
	const body = [
		'# Build-time integration status',
		'',
		'This page is generated locally to document how the integration examples are sourced.',
		'',
		`- Remote GitHub README examples generated: ${remoteCount}`,
		`- Knowledge-backed examples generated: ${knowledgeCount}`,
		`- Knowledge store path: \`${knowledgeRoot}\``,
		'',
		'The site can render cached Confluence, Jira, and Aha content from `.knowledge` even when the current shell does not expose the original credentials.',
	].join('\n');

	await writeMarkdownFile(
		path.join(generatedRoot, 'knowledge', 'build-status.md'),
		{
			title: 'Knowledge pipeline status',
			summary: 'Explains which build-time integrations produced static pages in this build.',
			section: 'knowledge',
			integration: 'markdown',
			sourceLabel: '.knowledge store',
			order: 99,
			generatedAt: new Date().toISOString(),
		},
		body,
	);
}

await rm(generatedRoot, { recursive: true, force: true });
const remoteCount = await generateRemoteGithubReadmes();
const knowledgeCount = await generateKnowledgeMarkdownExamples();
const datasetCount = await generateDatasetSummaries();
await writeStatusPage(remoteCount, knowledgeCount);
console.log(
	`Generated ${remoteCount} remote examples, ${knowledgeCount} knowledge-backed examples, and ${datasetCount} dataset summaries.`,
);
