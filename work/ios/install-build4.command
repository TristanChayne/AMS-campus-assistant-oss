#!/bin/bash
set -eu
cd /Users/linlan/Developer/AMS-iOS
exec > >(tee release/build4/ipad-local.log) 2>&1
trap 'result=$?; printf "%s\n" "$result" > release/build4/ipad-exit-code.txt' EXIT
xcodebuild -project AMS.xcodeproj -scheme AMS -configuration Debug -destination 'id=00008132-000105943C45801C' -derivedDataPath review-device-build4 PRODUCT_BUNDLE_IDENTIFIER=cn.local.ams.ios build
xcrun devicectl device install app --device 00008132-000105943C45801C review-device-build4/Build/Products/Debug-iphoneos/AMS.app
xcrun devicectl device process launch --terminate-existing --device 00008132-000105943C45801C cn.local.ams.ios
