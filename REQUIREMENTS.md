# REQUIREMENTS

This file records the exact flow that worked on 2026-03-28 to deploy an Astro 6.1.1 site to Google Cloud Storage from this machine.

## Preconditions that were already true

- `node` was available locally as `v24.14.0`.
- `npm` was available locally as `11.9.0`.
- `gcloud` was authenticated as `villarroel.gj@gmail.com`.
- Active Google Cloud project was `attguesser`.
- `gsutil` was available from the local Google Cloud SDK install.

## Project bootstrap that worked

```powershell
cd $HOME\dev
npx create-astro@latest astro-gcs-smoke --template basics --install --git --yes
cd $HOME\dev\astro-gcs-smoke
npm i -D @astrojs/check typescript
```

Result:

- The generated app resolved to `astro@^6.1.1`.
- The project built successfully as a static Astro site.

## Project changes that were required

- Set `output: 'static'` in `astro.config.mjs`.
- Added `npm run check`.
- Added `npm run deploy:gcs`.
- Added `npm run generate:integrations`.
- Added `src/pages/404.astro`.
- Added `scripts/deploy-gcs.ps1` to build and sync `dist/` to a bucket.
- Added a static integrations section generated from local Markdown, remote Markdown, and cached `.knowledge` sources.
- Updated the homepage content to identify the deployment target, repository index, and integrations section.
- Changed the deploy script invocation to use `powershell -NoProfile` because the user PowerShell profile produced PSReadLine errors in non-interactive execution.

## Google Cloud bucket setup that worked

```powershell
gcloud storage buckets create gs://astro-gcs-smoke-attguesser-646093577709 --project=attguesser --location=us-east1 --uniform-bucket-level-access
gsutil web set -m index.html -e 404.html gs://astro-gcs-smoke-attguesser-646093577709
gsutil iam ch allUsers:objectViewer gs://astro-gcs-smoke-attguesser-646093577709
```

Result:

- Bucket creation succeeded.
- Static website config for `index.html` and `404.html` succeeded.
- Public object access succeeded.

## Build and upload flow that worked

```powershell
cd $HOME\dev\astro-gcs-smoke
$env:GCS_BUCKET_NAME="astro-gcs-smoke-attguesser-646093577709"
npm run check
npm run deploy:gcs
```

What `npm run deploy:gcs` does:

1. Runs `astro build`.
2. Runs `gsutil -m rsync -r -d dist gs://astro-gcs-smoke-attguesser-646093577709`.

Result:

- `astro build` succeeded repeatedly.
- The bucket upload completed successfully.

## Local preview that worked

Verified with:

```powershell
cd $HOME\dev\astro-gcs-smoke
npm run build
npm run preview -- --host 127.0.0.1 --port 4322
```

Observed behavior:

- `http://127.0.0.1:4322/` returned the rendered Astro homepage.
- This local preview matched the expected static site behavior better than the bucket root URL.
- This is the quickest way to confirm the final HTML output before uploading to GCS.

## Runtime verification that worked

Verified with `Invoke-WebRequest`:

```powershell
Invoke-WebRequest -Uri "http://astro-gcs-smoke-attguesser-646093577709.storage.googleapis.com/index.html" -UseBasicParsing
Invoke-WebRequest -Uri "http://astro-gcs-smoke-attguesser-646093577709.storage.googleapis.com/missing" -UseBasicParsing
```

Observed behavior:

- `/index.html` returned HTTP `200` with the Astro HTML document.
- `/missing` returned HTTP `404`.
- `/` returned HTTP `200` with an XML `ListBucketResult`, so it is not the right URL to verify the rendered site.

Working public page URL:

- `http://astro-gcs-smoke-attguesser-646093577709.storage.googleapis.com/index.html`

## Google Cloud repository status

This machine was able to:

```powershell
gcloud services enable securesourcemanager.googleapis.com --project=attguesser
gcloud source-manager instances create astro-gcs-instance --region=us-central1 --project=attguesser --max-wait=30m --quiet
```

Observed status at the time of writing:

- Secure Source Manager service enablement succeeded.
- Instance creation request was accepted.
- Instance state was still `CREATING` when this file was written.

Follow-up command to complete the repository step once the instance is `ACTIVE`:

```powershell
gcloud source-manager repos create astro-gcs-smoke --region=us-central1 --instance=astro-gcs-instance --project=attguesser
```
