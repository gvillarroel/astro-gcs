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
