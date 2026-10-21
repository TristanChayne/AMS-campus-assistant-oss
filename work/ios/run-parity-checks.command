#!/bin/zsh
set -eu
cd "$(dirname "$0")/../.."
parity_tmp=$(mktemp -d /tmp/ams-ios-parity.XXXXXX)
trap 'rm -f "$parity_tmp/parity" "$parity_tmp/qr" "$parity_tmp/config" "$parity_tmp/AppServiceModel.swift"; rmdir "$parity_tmp"' EXIT
xcrun swiftc -swift-version 5 -parse-as-library outputs/ams-ios/Sources/ActivationCadence.swift outputs/ams-ios/Sources/HhtService.swift work/ios/ParityChecks.swift -o "$parity_tmp/parity"
"$parity_tmp/parity"
xcrun swiftc -swift-version 5 -parse-as-library outputs/ams-ios/Sources/QRCodeDecoder.swift work/ios/QRCodeDecoderChecks.swift -o "$parity_tmp/qr"
"$parity_tmp/qr"
sed '/^final class AnnouncementController:/,$d; /^import UIKit/d' outputs/ams-ios/Sources/AppService.swift > "$parity_tmp/AppServiceModel.swift"
xcrun swiftc -swift-version 5 -parse-as-library "$parity_tmp/AppServiceModel.swift" work/ios/PublicConfigChecks.swift -o "$parity_tmp/config"
"$parity_tmp/config"
