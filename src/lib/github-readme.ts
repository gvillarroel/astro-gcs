import { marked } from 'marked';
import type { Repo } from '../data/repos';

const README_CANDIDATES = ['README.md', 'readme.md'];

const rewriteRelativeLinks = (html: string, repo: Repo) => {
	const blobBase = `https://github.com/${repo.fullName}/blob/${repo.defaultBranch}`;
	const rawBase = `https://raw.githubusercontent.com/${repo.fullName}/${repo.defaultBranch}`;

	return html
		.replace(/href="\/(?!\/)([^"#][^"]*)"/g, `href="${blobBase}/$1"`)
		.replace(/href="(?![a-z]+:|#|\/\/)([^"]+)"/gi, `href="${blobBase}/$1"`)
		.replace(/src="\/(?!\/)([^"]+)"/g, `src="${rawBase}/$1"`)
		.replace(/src="(?![a-z]+:|\/\/)([^"]+)"/gi, `src="${rawBase}/$1"`);
};

export const fetchReadmeMarkdown = async (repo: Repo) => {
	for (const candidate of README_CANDIDATES) {
		const url = `https://raw.githubusercontent.com/${repo.fullName}/${repo.defaultBranch}/${candidate}`;
		const response = await fetch(url);
		if (response.ok) {
			return await response.text();
		}
	}

	return null;
};

export const renderReadmeHtml = (markdown: string, repo: Repo) => {
	const html = marked.parse(markdown, {
		async: false,
		gfm: true,
		breaks: false,
	}) as string;

	return rewriteRelativeLinks(html, repo);
};
