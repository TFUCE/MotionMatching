param(
    [Parameter(Mandatory = $true)]
    [string]$Password,

    [string]$User = "root",
    [string]$DbHost = "127.0.0.1",
    [int]$Port = 3306,
    [string]$Database = "motion_match"
)

$ErrorActionPreference = "Stop"
$mysqlBin = "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe"
if (-not (Test-Path $mysqlBin)) {
    $cmd = Get-Command mysql -ErrorAction SilentlyContinue
    if ($cmd) { $mysqlBin = $cmd.Source }
    else { throw "mysql.exe not found. Install MySQL or add it to PATH." }
}

$env:MYSQL_PWD = $Password
& $mysqlBin -u $User -h $DbHost -P $Port -e "CREATE DATABASE IF NOT EXISTS $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if ($LASTEXITCODE -ne 0) { throw "Failed to create database. Check username/password." }

$encodedUser = [uri]::EscapeDataString($User)
$encodedPass = [uri]::EscapeDataString($Password)
$databaseUrl = "mysql+pymysql://${encodedUser}:${encodedPass}@${DbHost}:${Port}/${Database}"

$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot "backend\.env"

$envContent = "DATABASE_URL=$databaseUrl`n"
[System.IO.File]::WriteAllText($envPath, $envContent, [System.Text.UTF8Encoding]::new($false))

Write-Host "Database '$Database' is ready."
Write-Host "Wrote $envPath"
Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
