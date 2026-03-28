# Astro GCS Smoke

Minimal Astro 6.1.1 project deployed as static files to Google Cloud Storage.

## Local commands

```powershell
npm install
npm run check
npm run build
$env:GCS_BUCKET_NAME="astro-gcs-smoke-attguesser-646093577709"
npm run deploy:gcs
```

## Hosting target

- Project: `attguesser`
- Bucket: `gs://astro-gcs-smoke-attguesser-646093577709`
- Website endpoint: `http://astro-gcs-smoke-attguesser-646093577709.storage.googleapis.com/`

## Notes

- This project is static-only. It does not use Astro SSR.
- `scripts/deploy-gcs.ps1` rebuilds the site and syncs `dist/` to the bucket.
- The bucket is configured with `index.html` and `404.html` website settings.
