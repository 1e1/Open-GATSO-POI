#!/bin/bash

if [ ! -d ./BUILD_csv_h ]
then
    mkdir ./BUILD_csv_h
fi

for f in `ls ./BUILD/*.csv`
do
    cat <(echo 'longitude,latitude,name,comment') $f > ${f//\.csv/_h.csv}
done

mv ./BUILD/*_h.csv ./BUILD_csv_h/


echo '[General]' > config.ini
echo 'OutputDirectory=SD_CARD' >> config.ini
echo 'SkipMIB2HIGH=False' >> config.ini
echo 'SkipMIB2TSD=False' >> config.ini
echo '' >> config.ini


while IFS='' read -r line || [[ -n "$line" ]]; do
    # split filename/counter/name
    IFS='/' read -ra cells <<< "$line"
    FILENAME=${cells[0]}
    COUNTER=${cells[1]}
    NAME=${cells[2]}

    echo "Source=./BUILD_csv_h/${FILENAME}_h.csv"

    echo "[$FILENAME]" >> config.ini
    echo "Name=$NAME" >> config.ini
    echo 'Warning=True' >> config.ini
    echo "Source=./BUILD_csv_h/${FILENAME}_h.csv" >> config.ini
    echo "Icon=./src/assets/icn/${FILENAME}.png" >> config.ini
    echo 'Disabled=False' >> config.ini
    echo '' >> config.ini
done < ./BUILD/manifest.txt
