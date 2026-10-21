#!/bin/bash
set -eu
cd /Users/linlan/Developer/AMS-iOS
exec > >(tee release/build3/local-release.log) 2>&1
trap 'result=$?; printf "%s\n" "$result" > release/build3/exit-code.txt' EXIT
printf 'archive\n' > release/build3/stage.txt
xcodebuild -project AMS.xcodeproj -scheme AMS -configuration Release -destination 'generic/platform=iOS' -archivePath release/AMS-0.1.0-3.xcarchive archive
printf 'export\n' > release/build3/stage.txt
xcodebuild -exportArchive -archivePath release/AMS-0.1.0-3.xcarchive -exportOptionsPlist release/build3/ExportOptions.plist -exportPath release/build3/export
printf 'upload\n' > release/build3/stage.txt
xcodebuild -exportArchive -archivePath release/AMS-0.1.0-3.xcarchive -exportOptionsPlist release/build2/UploadOptions.plist -exportPath release/build3/upload -allowProvisioningUpdates
printf 'uploaded\n' > release/build3/stage.txt
