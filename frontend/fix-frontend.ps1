# PowerShell script to fix frontend dependencies
Write-Host "Installing required premium UI dependencies (with legacy-peer-deps)..." -ForegroundColor Cyan
npm install framer-motion lucide-react --legacy-peer-deps

if ($LASTEXITCODE -eq 0) {
    Write-Host "Success! You can now run 'npm run dev' to see your interface." -ForegroundColor Green
} else {
    Write-Host "Installation failed. Retrying with --force..." -ForegroundColor Yellow
    npm install framer-motion lucide-react --force
}
