param(
    [string]$BucketName = $env:GCS_BUCKET_NAME
)

$ErrorActionPreference = "Stop"

if (-not $BucketName) {
    throw "Set GCS_BUCKET_NAME or pass -BucketName."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$bucketUrl = "gs://$BucketName"
$publicIndexUrl = "http://$BucketName.storage.googleapis.com/index.html"

Push-Location $projectRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Astro build failed."
    }

    gsutil -m rsync -r -d dist $bucketUrl
    if ($LASTEXITCODE -ne 0) {
        throw "gsutil rsync failed."
    }

    Write-Host "Deployment complete."
    Write-Host "Public page URL: $publicIndexUrl"
    Write-Host "Note: the bucket root URL returns an XML listing, not index.html."
}
finally {
    Pop-Location
}
