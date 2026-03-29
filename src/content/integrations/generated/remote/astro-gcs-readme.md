---
title: "astro-gcs README"
summary: "Remote Markdown fetched directly from the current site repository."
section: "remote"
integration: "github"
sourceLabel: "gvillarroel/astro-gcs"
sourceUrl: "https://github.com/gvillarroel/astro-gcs"
order: 1
generatedAt: "2026-03-29T01:20:48.073Z"
---

> Remote Markdown fetched at Astro build time.
> Repository: [gvillarroel/astro-gcs](https://github.com/gvillarroel/astro-gcs)

# Astro GCS

Static Astro documentation hub for public `gvillarroel` repositories and integration examples, deployed as plain files to Google Cloud Storage.

## Local commands

```powershell
npm install
npm run check
npm run build
npm run preview
$env:GCS_BUCKET_NAME="astro-gcs-smoke-attguesser-646093577709"
npm run deploy:gcs
```

## Local preview

- Use `npm run preview` after `npm run build` to serve the generated `dist/` output locally.
- The local preview serves the site as it should appear when `/` resolves to `index.html`.
- This is useful because the bucket root URL does not render the homepage for this bucket name.

## What the site does

- Builds a static index of public `gvillarroel` repositories.
- Generates uniform per-project HTML pages from repository metadata.
- Generates an `integrations` section from:
  - local nested Markdown under `src/content/integrations`
  - remote Markdown fetched at build time
  - cached `.knowledge` content synced earlier from Confluence, Jira, and Aha
- Uses Astro Markdown rendering plus a shared Mermaid client enhancement.
- Uses object-safe navigation so pages remain browsable from explicit URLs such as `index.html`, `projects/*.html`, and `integrations/**/*.html`.

## Integration generation

- `npm run generate:integrations` rebuilds the generated Markdown examples before `check`, `build`, and `dev`.
- Remote GitHub README examples are normalized into local Markdown files before Astro renders them.
- Confluence, Jira, and Aha examples are generated from the existing `~/.knowledge` store.
- If the current shell does not expose the original GitHub API credentials, repository pages fall back to `src/data/repo-snapshot.json`.

## Hosting target

- Project: `attguesser`
- Bucket: `gs://astro-gcs-smoke-attguesser-646093577709`
- Public object URL: `http://astro-gcs-smoke-attguesser-646093577709.storage.googleapis.com/index.html`

## Notes

- This project is static-only. It does not use Astro SSR.
- `scripts/deploy-gcs.ps1` rebuilds the site and syncs `dist/` to the bucket.
- The bucket is configured with `index.html` and `404.html` website settings.
- Current live credentials for Confluence, Jira, and Aha were not exposed in this shell, so the site renders cached `.knowledge` content instead of re-syncing those services during the build.
- The bucket root URL returns an XML bucket listing, not the rendered homepage, so use `/index.html` or front the bucket with a custom domain/load balancer if you need a clean `/` URL.
