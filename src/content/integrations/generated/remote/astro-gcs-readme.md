---
title: "astro-gcs README"
summary: "Remote Markdown fetched directly from the current site repository."
section: "remote"
integration: "github"
sourceLabel: "gvillarroel/astro-gcs"
sourceUrl: "https://github.com/gvillarroel/astro-gcs"
order: 1
generatedAt: "2026-03-28T23:55:00.709Z"
---

> Remote Markdown fetched at Astro build time.
> Repository: [gvillarroel/astro-gcs](https://github.com/gvillarroel/astro-gcs)

# Astro GCS

Static Astro documentation hub for public `gvillarroel` repositories, deployed as plain files to Google Cloud Storage.

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
- Generates per-project HTML pages with README content baked into the build output.
- Uses relative navigation so pages remain browsable from explicit object URLs such as `index.html` and `projects/*.html`.

## Hosting target

- Project: `attguesser`
- Bucket: `gs://astro-gcs-smoke-attguesser-646093577709`
- Public object URL: `http://astro-gcs-smoke-attguesser-646093577709.storage.googleapis.com/index.html`

## Notes

- This project is static-only. It does not use Astro SSR.
- `scripts/deploy-gcs.ps1` rebuilds the site and syncs `dist/` to the bucket.
- The bucket is configured with `index.html` and `404.html` website settings.
- The bucket root URL returns an XML bucket listing, not the rendered homepage, so use `/index.html` or front the bucket with a custom domain/load balancer if you need a clean `/` URL.
