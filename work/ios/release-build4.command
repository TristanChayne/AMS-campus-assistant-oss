#!/bin/bash
set -eu
cd /Users/linlan/Developer/AMS-iOS
mkdir -p release/build4
exec > >(tee release/build4/local-release.log) 2>&1
trap 'result=$?; printf "%s\n" "$result" > release/build4/exit-code.txt' EXIT
xcodebuild -project AMS.xcodeproj -scheme AMS -configuration Release -destination 'generic/platform=iOS' -archivePath release/AMS-0.1.0-4.xcarchive archive
xcodebuild -exportArchive -archivePath release/AMS-0.1.0-4.xcarchive -exportOptionsPlist release/build4/ExportOptions.plist -exportPath release/build4/export
