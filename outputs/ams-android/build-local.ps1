param(
    [string]$JavaRoot = 'E:\RuntimeEnv\Java\jdk-21.0.8+9',
    [string]$SdkRoot = 'E:\DevTools\AndroidTools\SDK',
    [string]$BuildToolsVersion = '36.1.0',
    [string]$PlatformVersion = 'android-36',
    [string]$BuildDirectory = 'E:\DevTools\Cache\AmsPrototype-20261005',
    [string]$SigningConfig = 'E:\DevTools\AndroidTools\Signing\CampusDay\signing.json',
    [string]$VersionName = '0.15.1',
    [int]$VersionCode = 78
)
$ErrorActionPreference = 'Stop'
$signing = Get-Content -LiteralPath $SigningConfig -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath $signing.keyStore)) { throw 'Release signing key is missing; never generate a replacement automatically.' }
$toolDirectory = Join-Path $SdkRoot "build-tools\$BuildToolsVersion"
$androidJar = Join-Path $SdkRoot "platforms\$PlatformVersion\android.jar"
$zxingJar = 'E:\DevTools\AndroidTools\Libraries\zxing-core-3.5.3.jar'
$env:JAVA_HOME = $JavaRoot
$taskBuild = Join-Path $BuildDirectory ('release-' + [guid]::NewGuid().ToString('N'))
$BuildDirectory = $taskBuild
$classDirectory = Join-Path $BuildDirectory 'classes'
$dexDirectory = Join-Path $BuildDirectory 'dex'
New-Item -ItemType Directory -Force -Path $BuildDirectory,$classDirectory,$dexDirectory | Out-Null

function Invoke-BuildTool([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build tool failed: $Executable ($LASTEXITCODE)" }
}

$sources = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'app\src\main\java\cn\local\ams') -Filter '*.java' | ForEach-Object {$_.FullName})
Invoke-BuildTool (Join-Path $JavaRoot 'bin\javac.exe') (@('-encoding','UTF-8','--release','8','-classpath',"$androidJar;$zxingJar",'-d',$classDirectory) + $sources)
$classJar = Join-Path $BuildDirectory 'classes.jar'
Invoke-BuildTool (Join-Path $JavaRoot 'bin\jar.exe') @('cf',$classJar,'-C',$classDirectory,'.')
Invoke-BuildTool (Join-Path $toolDirectory 'd8.bat') @('--lib',$androidJar,'--min-api','26','--output',$dexDirectory,$classJar,$zxingJar)
$resourceDirectory = Join-Path $BuildDirectory 'compiled-res'
New-Item -ItemType Directory -Force -Path $resourceDirectory | Out-Null
Invoke-BuildTool (Join-Path $toolDirectory 'aapt2.exe') @('compile','--dir',(Join-Path $PSScriptRoot 'app\src\main\res'),'-o',$resourceDirectory)
$compiledResources = @(Get-ChildItem -LiteralPath $resourceDirectory -Filter '*.flat' | ForEach-Object {$_.FullName})
$unsigned = Join-Path $BuildDirectory 'unsigned.apk'
$aligned = Join-Path $BuildDirectory 'aligned.apk'
$manifest = Join-Path $BuildDirectory 'AndroidManifest.xml'
[xml]$manifestDocument = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'app\src\main\AndroidManifest.xml') -Raw -Encoding UTF8
$manifestDocument.manifest.SetAttribute('package','cn.local.ams')
$manifestDocument.Save($manifest)
Invoke-BuildTool (Join-Path $toolDirectory 'aapt2.exe') (@('link','-I',$androidJar,'-A',(Join-Path $PSScriptRoot 'app\src\main\assets'),'--manifest',$manifest,'--min-sdk-version','26','--target-sdk-version','35','--version-code',"$VersionCode",'--version-name',$VersionName,'-o',$unsigned) + $compiledResources)
Invoke-BuildTool (Join-Path $JavaRoot 'bin\jar.exe') @('uf',$unsigned,'-C',$dexDirectory,'classes.dex')
Invoke-BuildTool (Join-Path $toolDirectory 'zipalign.exe') @('-f','4',$unsigned,$aligned)
$outputApk = Join-Path $PSScriptRoot "campus-day-$VersionName.apk"
try {
    $env:CAMPUS_SIGN_STORE = $signing.storePassword
    $env:CAMPUS_SIGN_KEY = $signing.keyPassword
    Invoke-BuildTool (Join-Path $toolDirectory 'apksigner.bat') @('sign','--ks',$signing.keyStore,'--ks-key-alias',$signing.alias,'--ks-pass','env:CAMPUS_SIGN_STORE','--key-pass','env:CAMPUS_SIGN_KEY','--out',$outputApk,$aligned)
} finally {
    Remove-Item Env:\CAMPUS_SIGN_STORE -ErrorAction SilentlyContinue
    Remove-Item Env:\CAMPUS_SIGN_KEY -ErrorAction SilentlyContinue
}
Invoke-BuildTool (Join-Path $toolDirectory 'apksigner.bat') @('verify','--verbose',$outputApk)
Invoke-BuildTool (Join-Path $toolDirectory 'zipalign.exe') @('-c','4',$outputApk)
Write-Output "APK: $outputApk"
