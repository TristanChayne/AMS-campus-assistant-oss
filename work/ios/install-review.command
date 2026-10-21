#!/bin/zsh
cd /Users/linlan/Developer/AMS-iOS
exec > >(tee review-device.log) 2>&1
xcodebuild -project AMS.xcodeproj -scheme AMS -configuration Debug -destination 'id=00008132-000105943C45801C' -derivedDataPath review-device build
result=$?
if [ $result -eq 0 ]; then
 xcrun devicectl device install app --device 00008132-000105943C45801C review-device/Build/Products/Debug-iphoneos/AMS.app
 result=$?
fi
if [ $result -eq 0 ]; then
 review_code=$(cat /tmp/ams-review-code.txt)
 xcrun devicectl device process launch --terminate-existing --device 00008132-000105943C45801C cn.local.ams.ios -- --test-activation-code "$review_code"
 result=$?
fi
printf '%s' "$result" > review-device-exit.txt
