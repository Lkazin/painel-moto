# Deriva os ícones das imagens oficiais; não redesenha a marca.
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    node (Join-Path $PSScriptRoot 'generate-brand-assets.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível gerar os ícones oficiais.' }
} finally { Pop-Location }
