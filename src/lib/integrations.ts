export type IntegrationEntry = {
	id: string;
	data: {
		title: string;
		summary?: string;
		section: 'local' | 'remote' | 'knowledge';
		integration: 'markdown' | 'mermaid' | 'github' | 'confluence' | 'jira' | 'aha' | 'mdx';
		sourceLabel?: string;
		sourceUrl?: string;
		generatedAt?: string;
		order?: number;
	};
	Content: any;
};

export type IntegrationBucket = {
	id: string;
	label: string;
	description: string;
	entries: IntegrationEntry[];
};

export type IntegrationSectionGroup = {
	id: IntegrationEntry['data']['section'];
	label: string;
	description: string;
	count: number;
	buckets: IntegrationBucket[];
};

export async function loadIntegrationEntries(): Promise<IntegrationEntry[]> {
	const modules = {
		...import.meta.glob('../content/integrations/**/*.md'),
		...import.meta.glob('../content/integrations/**/*.mdx'),
	};
	const entries = await Promise.all(
		Object.entries(modules).map(async ([file, loader]) => {
			const module: any = await loader();
			return {
				id: file.replace('../content/integrations/', '').replace(/\.(md|mdx)$/, ''),
				data: module.frontmatter,
				Content: module.default,
			} satisfies IntegrationEntry;
		}),
	);

	return sortIntegrations(entries);
}

export function integrationPath(entry: IntegrationEntry) {
	return `/integrations/${entry.id}.html`;
}

export function integrationSectionLabel(section: IntegrationEntry['data']['section']) {
	switch (section) {
		case 'local':
			return 'Local Markdown';
		case 'remote':
			return 'Remote Markdown';
		case 'knowledge':
			return 'Knowledge Sources';
	}
}

export function integrationSectionDescription(section: IntegrationEntry['data']['section']) {
	switch (section) {
		case 'local':
			return 'Hand-authored examples that show how Astro can structure docs in-repo.';
		case 'remote':
			return 'Markdown fetched externally at build time and normalized before rendering.';
		case 'knowledge':
			return 'Static pages generated from the cached knowledge store for external systems.';
	}
}

export function integrationLabel(kind: IntegrationEntry['data']['integration']) {
	switch (kind) {
		case 'markdown':
			return 'Markdown';
		case 'mermaid':
			return 'Mermaid';
		case 'github':
			return 'GitHub README';
		case 'confluence':
			return 'Confluence';
		case 'jira':
			return 'Jira';
		case 'aha':
			return 'Aha';
		case 'mdx':
			return 'MDX';
	}
}

export function integrationBucketMeta(entry: IntegrationEntry) {
	const segments = entry.id.split('/');

	if (entry.data.section === 'local') {
		if (segments.includes('plugins')) {
			return {
				id: 'plugins',
				label: 'Plugins',
				description: 'Examples powered by Markdown, rehype, and MDX integrations.',
			};
		}
		if (segments.includes('architecture')) {
			return {
				id: 'diagrams',
				label: 'Diagrams',
				description: 'Diagram-oriented content such as Mermaid-driven pages.',
			};
		}
		if (segments.includes('features')) {
			return {
				id: 'features',
				label: 'Markdown features',
				description: 'Core Markdown syntax and formatting capabilities.',
			};
		}
		return {
			id: 'getting-started',
			label: 'Getting started',
			description: 'Baseline examples for local content organization.',
		};
	}

	if (entry.data.section === 'remote') {
		return {
			id: 'github-readmes',
			label: 'GitHub snapshots',
			description: 'Remote README content captured and normalized at build time.',
		};
	}

	if (segments.includes('/knowledge/aha/') || segments.includes('knowledge/aha')) {
		return {
			id: 'aha',
			label: 'Aha',
			description: 'Static pages generated from cached Aha feature records.',
		};
	}
	if (segments.includes('/knowledge/confluence/') || segments.includes('knowledge/confluence')) {
		return {
			id: 'confluence',
			label: 'Confluence',
			description: 'Confluence pages exported into Markdown and rendered locally.',
		};
	}
	if (segments.includes('/knowledge/jira/') || segments.includes('knowledge/jira')) {
		return {
			id: 'jira',
			label: 'Jira',
			description: 'Issue snapshots converted into static documentation pages.',
		};
	}
	return {
		id: 'pipeline',
		label: 'Pipeline status',
		description: 'Build and source status for the generated knowledge content.',
	};
}

export function groupIntegrations(entries: IntegrationEntry[]): IntegrationSectionGroup[] {
	const sections: IntegrationEntry['data']['section'][] = ['local', 'remote', 'knowledge'];

	return sections.map((section) => {
		const sectionEntries = entries.filter((entry) => entry.data.section === section);
		const bucketsById = new Map<string, IntegrationBucket>();

		for (const entry of sectionEntries) {
			const meta = integrationBucketMeta(entry);
			const existing = bucketsById.get(meta.id);
			if (existing) {
				existing.entries.push(entry);
				continue;
			}
			bucketsById.set(meta.id, {
				id: meta.id,
				label: meta.label,
				description: meta.description,
				entries: [entry],
			});
		}

		const buckets = Array.from(bucketsById.values()).map((bucket) => ({
			...bucket,
			entries: sortIntegrations(bucket.entries),
		}));

		return {
			id: section,
			label: integrationSectionLabel(section),
			description: integrationSectionDescription(section),
			count: sectionEntries.length,
			buckets,
		};
	});
}

export function sortIntegrations(entries: IntegrationEntry[]) {
	return [...entries].sort((left, right) => {
		if (left.data.section !== right.data.section) {
			return left.data.section.localeCompare(right.data.section);
		}
		if ((left.data.order ?? 100) !== (right.data.order ?? 100)) {
			return (left.data.order ?? 100) - (right.data.order ?? 100);
		}
		return left.data.title.localeCompare(right.data.title);
	});
}
