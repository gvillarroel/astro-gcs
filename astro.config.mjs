// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkToc from 'remark-toc';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
	integrations: [mdx()],
	output: 'static',
	build: {
		format: 'file',
	},
	markdown: {
		remarkPlugins: [[remarkToc, { heading: 'contents', maxDepth: 3 }]],
		rehypePlugins: [
			rehypeSlug,
			[
				rehypeAutolinkHeadings,
				{
					behavior: 'append',
					properties: {
						className: ['heading-anchor'],
						ariaLabel: 'Jump to heading',
					},
					content: {
						type: 'text',
						value: ' #',
					},
				},
			],
			[
				rehypeExternalLinks,
				{
					target: '_blank',
					rel: ['noopener', 'noreferrer'],
					properties: {
						className: ['external-link'],
					},
					content: {
						type: 'text',
						value: ' [ext]',
					},
				},
			],
		],
	},
});
