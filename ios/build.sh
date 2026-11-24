#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
out="$(pwd)/evidence"
mkdir -p "$out"
exec > >(tee "$out/build.log") 2>&1
xcodebuild -version
xcodegen --version
bash prepare-offline.sh
xcodegen generate
swiftc Shared/Block.swift Tests/main.swift -o "$out/check-model"
"$out/check-model"
rm "$out/check-model"
for variant in Base Live; do
  derived="$TMPDIR/focus-$variant"
  xcodebuild -scheme "$variant" -configuration Release -destination 'generic/platform=iOS' -derivedDataPath "$derived" CODE_SIGNING_ALLOWED=NO build
  stage="$(mktemp -d)"
  mkdir "$stage/Payload"
  cp -R "$derived/Build/Products/Release-iphoneos/StudioFocus.app" "$stage/Payload/"
  app="$stage/Payload/StudioFocus.app"
  if [[ "$variant" == Live ]]; then
    test -d "$app/PlugIns/FocusActivity.appex"
    /usr/libexec/PlistBuddy -c 'Print NSSupportsLiveActivities' "$app/Info.plist" | grep -i true
  else
    test ! -d "$app/PlugIns"
  fi
  (cd "$stage" && /usr/bin/zip -qyr "$out/Focus-$variant.ipa" Payload)
done
(cd "$out" && shasum -a 256 *.ipa > SHA256SUMS)
device=$(xcrun simctl list devices available -j | python3 -c 'import sys,json; ds=[d for devices in json.load(sys.stdin)["devices"].values() for d in devices if d["name"].startswith("iPhone")]; print(next((d for d in ds if d["name"]=="iPhone 15 Pro"),ds[0])["udid"])')
xcrun simctl boot "$device" || true
xcrun simctl bootstatus "$device" -b
xcodebuild -scheme Live -destination "id=$device" -derivedDataPath "$TMPDIR/focus-sim" build
app="$TMPDIR/focus-sim/Build/Products/Debug-iphonesimulator/StudioFocus.app"
xcrun simctl install "$device" "$app"
xcrun simctl launch "$device" io.github.pebdock.studioosfocus
sleep 2
xcrun simctl io "$device" screenshot "$out/avvio.png"
xcrun simctl io "$device" recordVideo "$out/percorso.mp4" &
rec=$!
trap 'kill -INT "$rec" 2>/dev/null || true; wait "$rec" || true' EXIT
xcodebuild -scheme Live -destination "id=$device" -parallel-testing-enabled NO -derivedDataPath "$TMPDIR/focus-sim" -resultBundlePath "$out/Studio.xcresult" test


