#!/bin/bash

EXT=$1

mkdir ./BUILD_${EXT}
cp -R ./BUILD/*.{bmp,$EXT} ./BUILD_${EXT}/
ls -alR ./BUILD_${EXT}
zip -r ./RELEASES/${EXT}_files.zip ./BUILD_${EXT}
rm -rf ./BUILD_${EXT}
