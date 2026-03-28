export type PublicRepo = {
	name: string;
	slug: string;
	fullName: string;
	description: string;
	defaultBranch: string;
	repoUrl: string;
	homepage: string | null;
	language: string | null;
	stars: number;
	openIssues: number;
	archived: boolean;
	fork: boolean;
	topics: string[];
	updatedAt: string;
	createdAt: string;
};

const GITHUB_USER = 'gvillarroel';

const slugify = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export const formatDate = (value: string) =>
	new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeZone: 'America/New_York',
	}).format(new Date(value));

export const buildRepoTags = (repo: PublicRepo) => {
	const tags = [...repo.topics];

	if (repo.language && !tags.includes(repo.language)) {
		tags.unshift(repo.language);
	}

	if (repo.fork) {
		tags.push('fork');
	}

	if (repo.archived) {
		tags.push('archived');
	}

	return tags.slice(0, 6);
};

export const fetchPublicRepos = async () => {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'astro-gcs-build',
	};

	const token = import.meta.env.GITHUB_TOKEN;
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(
		`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`,
		{
			headers,
		},
	);

	if (!response.ok) {
		throw new Error(`GitHub repo fetch failed with status ${response.status}`);
	}

	const repos = (await response.json()) as Array<{
		name: string;
		full_name: string;
		description: string | null;
		default_branch: string;
		html_url: string;
		homepage: string | null;
		language: string | null;
		stargazers_count: number;
		open_issues_count: number;
		archived: boolean;
		fork: boolean;
		topics?: string[];
		updated_at: string;
		created_at: string;
		private: boolean;
	}>;

	return repos
		.filter((repo) => !repo.private)
		.map((repo) => ({
			name: repo.name,
			slug: slugify(repo.name),
			fullName: repo.full_name,
			description: repo.description ?? 'No repository description provided.',
			defaultBranch: repo.default_branch,
			repoUrl: repo.html_url,
			homepage: repo.homepage || null,
			language: repo.language,
			stars: repo.stargazers_count,
			openIssues: repo.open_issues_count,
			archived: repo.archived,
			fork: repo.fork,
			topics: repo.topics ?? [],
			updatedAt: repo.updated_at,
			createdAt: repo.created_at,
		}))
		.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};
