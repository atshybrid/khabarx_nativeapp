param()
# Force this shell to use JDK 17 and run a Gradle or other build command passed after '--'
# Usage examples:
#   powershell -File scripts/use-jdk17.ps1 -- ./android/gradlew.bat assembleDebug
#   powershell -File scripts/use-jdk17.ps1 -- npx expo run:android

$ErrorActionPreference = 'Stop'
$jdkPath = 'C:\Program Files\Java\jdk-17'
if(!(Test-Path $jdkPath)){ Write-Error "JDK 17 not found at $jdkPath"; exit 1 }
$env:JAVA_HOME = $jdkPath
# Rebuild PATH putting JDK17 bin first but preserving everything else
$original = $env:Path -split ';' | Where-Object { $_ -and ($_ -notmatch 'jdk-11') -and ($_ -notmatch 'jdk-24') }
$env:Path = ("$jdkPath\bin;" + ($original -join ';'))
Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
Write-Host "java -version output:" -ForegroundColor Cyan
& java -version

$sepIndex = $args.IndexOf('--')
if($sepIndex -ge 0){
  $toRun = $args[($sepIndex+1)..($args.Length-1)] | Where-Object { $_ -ne '' }
  if($toRun.Length -gt 0){
    $exe = $toRun[0]
    $exeArgs = @()
    if($toRun.Length -gt 1){ $exeArgs = $toRun[1..($toRun.Length-1)] }
    if($exe.StartsWith('./') -or $exe.StartsWith('.\\')){ $exe = $exe.Substring(2) }
    Write-Host "Running: $exe $($exeArgs -join ' ')" -ForegroundColor Yellow
    $resolved = $null
    if(Test-Path $exe){ $resolved = (Resolve-Path $exe).Path }
    else {
      $which = (Get-Command $exe -ErrorAction SilentlyContinue)
      if($which){ $resolved = $which.Path }
    }
    if(-not $resolved){ Write-Error "Executable not found in PATH or locally: $exe"; exit 1 }
    & $resolved @exeArgs
    exit $LASTEXITCODE
  }
}
