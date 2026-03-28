import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';

const projectRoot = path.resolve(import.meta.dirname, '..');
const generatedRoot = path.join(projectRoot, 'src', 'content', 'integrations', 'generated');
const knowledgeRoot = path.join(homedir(), '.knowledge');
const githubToken = process.env.GITHUB_TOKEN;
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

function extractBody(markdown) {
	return matter(markdown).content.trim();
}

function buildSummary(text) {
	return text.replace(/\s+/g, ' ').trim().slice(0, 160);
}

async function generateKnowledgeMarkdownExamples() {
	const sources = [
		{
			dir: path.join(knowledgeRoot, 'T', 'confluence'),
			pattern: '.md',
			targetDir: 'confluence',
			integration: 'confluence',
			limit: 4,
		},
		{
			dir: path.join(knowledgeRoot, 'tmp', 'jira'),
			pattern: '.md',
			targetDir: 'jira',
			integration: 'jira',
			limit: 3,
		},
	];
	let count = 0;

	for (const source of sources) {
		try {
			const files = await collectFiles(source.dir, source.pattern);
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
await writeStatusPage(remoteCount, knowledgeCount);
console.log(`Generated ${remoteCount} remote examples and ${knowledgeCount} knowledge-backed examples.`);
