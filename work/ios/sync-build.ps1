param(
    [string]$MacAddress = '192.168.6.204',
    [string]$MacUser = 'linlan',
    [string]$KeyPath = "$env:USERPROFILE\.ssh\ams_ios_dev",
    [string]$DeviceId = 'A33AD475-BC90-4A4D-AD1A-F272D77F25E1',
    [switch]$Launch,
    [switch]$Shutdown
)
$ErrorActionPreference = 'Stop'
if ($MacAddress -notmatch '^[A-Za-z0-9.-]+$' -or $MacUser -notmatch '^[A-Za-z0-9_-]+$' -or $DeviceId -notmatch '^[A-Fa-f0-9-]{36}$') { throw 'Invalid Mac connection or simulator identifier.' }
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$destination = "$MacUser@$MacAddress"
function Invoke-Mac([string]$Command) {
    & ssh -i $KeyPath -o BatchMode=yes -o ConnectTimeout=10 $destination $Command
    if ($LASTEXITCODE -ne 0) { throw 'Mac command failed; inspect the output above.' }
}
if ($Shutdown) { Invoke-Mac "xcrun simctl shutdown $DeviceId"; exit }
& python (Join-Path $PSScriptRoot 'prepare.py') --ios-only
if ($LASTEXITCODE -ne 0) { throw 'iOS preparation failed.' }
Invoke-Mac 'mkdir -p ~/Developer/AMS-iOS'
foreach ($item in @('Sources','Assets','AppAssets.xcassets','AMS.xcodeproj','Info.plist','PrivacyInfo.xcprivacy','Simulator.entitlements')) {
    & scp -i $KeyPath -o BatchMode=yes -r (Join-Path $root "outputs/ams-ios/$item") "${destination}:Developer/AMS-iOS/"
    if ($LASTEXITCODE -ne 0) { throw "Transfer failed: $item" }
}
Invoke-Mac 'cd ~/Developer/AMS-iOS && xcodebuild -project AMS.xcodeproj -scheme AMS -configuration Debug -sdk iphonesimulator -derivedDataPath build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGN_ENTITLEMENTS=Simulator.entitlements build > build.log 2>&1; result=$?; tail -12 build.log; exit $result'
if ($Launch) {
    Invoke-Mac "xcrun simctl bootstatus $DeviceId -b && xcrun simctl install $DeviceId ~/Developer/AMS-iOS/build/Build/Products/Debug-iphonesimulator/AMS.app && xcrun simctl launch --terminate-running-process $DeviceId cn.xjtlu.ams.ios && open /Applications/Xcode.app/Contents/Applications/DeviceHub.app"
}
