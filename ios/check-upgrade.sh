#!/bin/bash
# Solo contenitore del simulatore appena creato per questa build.
set -euo pipefail
udid="$1"
liveApp="$2"
out="$3"
bundle=io.github.pebdock.studioosfocus
baseDir="$TMPDIR/focus-base-sim"
xcodebuild -scheme Base -destination "id=$udid" -derivedDataPath "$baseDir" build
xcrun simctl install "$udid" "$baseDir/Build/Products/Debug-iphonesimulator/StudioFocus.app"
container=$(xcrun simctl get_app_container "$udid" "$bundle" data)
dir="$container/Library/Application Support"
mkdir -p "$dir"
# Il fixture riproduce l'archivio v1 sintetico con una scadenza di 10 minuti.
python3 - "$dir/focus-v1.json" <<'PY'
import json,sys,time
with open(sys.argv[1], "w") as f:
    json.dump(dict(title="Verifica sintetica",outline="Passo uno\nPasso due",materials="Scheda A",
        criterion="Spiegare il metodo",minutes=10,checked=[0],phase="running",
        deadline=time.time()-978307200+600,pausedSeconds=0),f)
PY
xcrun simctl launch "$udid" "$bundle"
sleep 2
xcrun simctl terminate "$udid" "$bundle"
cp "$dir/focus-v1.json" "$out/fixture-prima.json"
xcrun simctl install "$udid" "$liveApp"
updated=$(xcrun simctl get_app_container "$udid" "$bundle" data)
cmp "$out/fixture-prima.json" "$updated/Library/Application Support/focus-v1.json"
xcrun simctl launch "$udid" "$bundle"
sleep 3
xcrun simctl io "$udid" screenshot "$out/ripresa-dopo-aggiornamento.png"
xcrun simctl terminate "$udid" "$bundle"
xcrun simctl uninstall "$udid" "$bundle"
echo "Aggiornamento Base -> Live sul simulatore: archivio conservato."


