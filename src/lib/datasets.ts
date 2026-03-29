import rawCatalog from '../data/generated-datasets.json';

export type DatasetColumn = {
	name: string;
	kind: 'string' | 'number' | 'date' | 'boolean';
	nullCount: number;
	distinctCount: number;
	sampleValues: string[];
	topValues: Array<{
		label: string;
		count: number;
	}>;
	numericSummary?: {
		min: number;
		max: number;
		avg: number;
	};
	timeSummary?: {
		min: string;
		max: string;
	};
};

export type DatasetChart = {
	id: string;
	title: string;
	description: string;
	traces: Record<string, unknown>[];
	layout: Record<string, unknown>;
};

export type DatasetEntry = {
	id: string;
	slug: string;
	name: string;
	format: string;
	relativePath: string;
	rowCount: number;
	columnCount: number;
	columns: DatasetColumn[];
	previewRows: Record<string, unknown>[];
	charts: DatasetChart[];
	error?: string;
};

export type DatasetCatalog = {
	generatedAt: string;
	sourceRoot: string;
	datasetCount: number;
	datasets: DatasetEntry[];
};

const catalog = rawCatalog as DatasetCatalog;

export function getDatasetCatalog() {
	return catalog;
}

export function getDatasets() {
	return catalog.datasets;
}

export function getDatasetBySlug(slug: string) {
	return catalog.datasets.find((dataset) => dataset.slug === slug);
}

export function datasetPath(dataset: DatasetEntry) {
	return `/datasets/${dataset.slug}.html`;
}
