#!/bin/zsh
cd /Users/linlan/Developer/AMS-iOS
exec > >(tee activation-device.log) 2>&1
xcodebuild -project AMS.xcodeproj -scheme AMS -configuration Debug -destination 'id=00008132-000105943C45801C' -derivedDataPath activation-device build
result=$?
if [ $result -eq 0 ]; then
 xcrun devicectl device install app --device 00008132-000105943C45801C activation-device/Build/Products/Debug-iphoneos/AMS.app
 result=$?
fi
if [ $result -eq 0 ]; then
 xcrun devicectl device process launch --terminate-existing --device 00008132-000105943C45801C cn.local.ams.ios
 result=$?
fi
printf '%s' "$result" > activation-device-exit.txt
