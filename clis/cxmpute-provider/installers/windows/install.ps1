#Requires -RunAsAdministrator

# Function to print status messages
function Write-Status {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "Error: $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "Warning: $Message" -ForegroundColor Yellow
}

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Status "Node.js not found. Installing..."
    
    # Download and install Node.js
    $nodeUrl = "https://nodejs.org/dist/v18.19.1/node-v18.19.1-x64.msi"
    $nodeInstaller = "$env:TEMP\node-installer.msi"
    
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait
    Remove-Item $nodeInstaller
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Verify Node.js installation
$nodeVersion = node -v
Write-Status "Node.js version: $nodeVersion"

# Set installation paths
$installDir = "C:\Program Files\cxmpute-provider"
$binDir = "C:\Program Files\cxmpute-provider\bin"

# Create installation directory
Write-Status "Creating installation directory..."
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# Download and extract the latest release
Write-Status "Downloading latest release..."
$latestRelease = (Invoke-WebRequest -Uri "https://api.github.com/repos/unxversal/cxmpute-core/releases/latest" -UseBasicParsing).Content | ConvertFrom-Json
$releaseUrl = "https://github.com/unxversal/cxmpute-core/archive/refs/tags/$($latestRelease.tag_name).zip"
$zipFile = "$env:TEMP\cxmpute-provider.zip"

Invoke-WebRequest -Uri $releaseUrl -OutFile $zipFile
Expand-Archive -Path $zipFile -DestinationPath $env:TEMP -Force
Copy-Item "$env:TEMP\cxmpute-core-*\clis\cxmpute-provider\*" -Destination $installDir -Recurse -Force

# Install dependencies and build
Write-Status "Installing dependencies and building..."
Set-Location $installDir
npm install
npm run build

# Create shortcut
Write-Status "Creating shortcut..."
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$binDir\cxmpute-provider.lnk")
$Shortcut.TargetPath = "node.exe"
$Shortcut.Arguments = "$installDir\dist\cli.js"
$Shortcut.WorkingDirectory = $installDir
$Shortcut.Save()

# Add to PATH
Write-Status "Adding to PATH..."
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binDir", "Machine")
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")
}

# Cleanup
Write-Status "Cleaning up..."
Remove-Item $zipFile -Force
Remove-Item "$env:TEMP\cxmpute-core-*" -Recurse -Force

Write-Status "Installation complete! You can now run 'cxmpute-provider' from anywhere."
Write-Status "To update in the future, run: cxmpute-provider --update"
