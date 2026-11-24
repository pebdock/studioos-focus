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
sdk=$(xcrun --sdk iphonesimulator --show-sdk-version)
runtime=$(xcrun simctl list runtimes -j | python3 -c 'import json,sys; rs=[r for r in json.load(sys.stdin)["runtimes"] if r["isAvailable"] and ".iOS-" in r["identifier"]]; print(next(r["identifier"] for r in rs if r["version"]==sys.argv[1]))' "$sdk")
device=$(xcrun simctl create "Focus CI iPhone 15 Pro" com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro "$runtime")
rec=""
cleanup() {
  if [[ -n "$rec" ]]; then kill -INT "$rec" 2>/dev/null || true; wait "$rec" || true; fi
  mkdir -p "$out/diagnostica"
  find "$HOME/Library/Logs/DiagnosticReports" -type f -name 'StudioFocus*.ips' -exec cp '{}' "$out/diagnostica/" \; || true
  xcrun simctl spawn "$device" log show --last 8m --style compact --predicate 'process == "StudioFocus" OR (process == "SpringBoard" AND eventMessage CONTAINS "studioosfocus")' > "$out/diagnostica/simulatore.log" || true
  xcrun simctl shutdown "$device" || true
  xcrun simctl delete "$device"
}
trap cleanup EXIT
echo "iPhone 15 Pro · $runtime · $device"
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
xcodebuild -scheme Live -destination "id=$device" -derivedDataPath "$TMPDIR/focus-sim" build
app="$TMPDIR/focus-sim/Build/Products/Debug-iphonesimulator/StudioFocus.app"
bash check-upgrade.sh "$device" "$app" "$out"
xcrun simctl install "$device" "$app"
dir="$(xcrun simctl get_app_container "$device" io.github.pebdock.studioosfocus data)/Library/Application Support"
mkdir -p "$dir"
python3 - "$dir/plan-v1.json" <<'PY'
import json,sys
rows = [dict(id=f"R20-{i:04}",date="2026-11-30",mat="Materia sintetica",arg=f"Unità {i}",cons="Verifica finale: esempio",mats="Scheda A",stato="Da iniziare",min=20,fatti=0,**{"from":"09:00","to":"09:20"}) for i in range(1, 41)]
with open(sys.argv[1],"w") as f: json.dump({"blocks":rows},f)
PY
xcrun simctl launch "$device" io.github.pebdock.studioosfocus
sleep 2
xcrun simctl io "$device" screenshot "$out/avvio.png"
xcrun simctl io "$device" recordVideo "$out/percorso.mp4" &
rec=$!

xcodebuild -scheme Live -destination "id=$device" -parallel-testing-enabled NO -derivedDataPath "$TMPDIR/focus-sim" -resultBundlePath "$out/Studio.xcresult" test






