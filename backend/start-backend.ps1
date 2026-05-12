# Windows-safe Strapi starter (bypasses pstree.remy spawn issue)
Write-Host "Starting Strapi (Windows-safe mode)..." -ForegroundColor Cyan

$env:NODE_ENV = "development"
$env:STRAPI_TELEMETRY_DISABLED = "true"

# Use node to call strapi directly instead of the npm script
node node_modules/@strapi/strapi/bin/strapi.js develop --no-open
