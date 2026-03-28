param(
    [string]$BucketName = $env:GCS_BUCKET_NAME
)

$ErrorActionPreference = "Stop"

if (-not $BucketName) {
    throw "Set GCS_BUCKET_NAME or pass -BucketName."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$bucketUrl = "gs://$BucketName"

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
}
finally {
    Pop-Location
}
