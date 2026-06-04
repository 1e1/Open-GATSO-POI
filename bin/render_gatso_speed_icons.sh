#!/usr/bin/env bash
# Génère src/assets/icn/GATSO_10.* et GATSO_20.* à partir des SVG (même style que GATSO_30).
# Ne requiert pas Node/npm : seulement ImageMagick (commande: convert ou magick).
# Après génération, mets à jour config.js (car10/car20) : remplacer 'GATSO_30' par 'GATSO_10' / 'GATSO_20' dans basenames.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICN="${ROOT}/src/assets/icn"
ORG="${ROOT}/src/assets/org"
BGCOLOR="#e8e437"
CMD=()
if command -v magick &>/dev/null; then
  CMD=(magick)
elif command -v convert &>/dev/null; then
  CMD=(convert)
else
  echo "Installez ImageMagick (ex.: brew install imagemagick) pour utiliser ce script."
  exit 1
fi
for n in 10 20; do
  SVG="${ORG}/GATSO_${n}.svg"
  if [[ ! -f "$SVG" ]]; then
    echo "Fichier manquant: $SVG" >&2
    exit 1
  fi
  PNG="${ICN}/GATSO_${n}.png"
  BMP="${ICN}/GATSO_${n}.bmp"
  "${CMD[@]}" "$SVG" -transparent "$BGCOLOR" "$PNG"
  "${CMD[@]}" "$PNG" "BMP3:$BMP"
  echo "OK: $PNG $BMP"
done
echo
echo "Puis remplace 'GATSO_30' par 'GATSO_10' / 'GATSO_20' dans car10 / car20 (fichier src/modules/config.js)."
