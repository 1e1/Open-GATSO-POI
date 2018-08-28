#!/bin/bash

__() { echo $1 >> config.ini; }



if [ -f ./config.ini ]
then
    rm config.ini
    touch config.ini
fi

if [ ! -d ./BUILD_csv_h ]
then
    mkdir ./BUILD_csv_h
fi



echo "Stuffing ./BUILD_csv_h/"

for f in `ls ./BUILD/*.csv`
do
    cat <(echo 'longitude,latitude,name,comment') $f > ${f//\.csv/_h.csv}
done

mv ./BUILD/*_h.csv ./BUILD_csv_h/



echo "Writing config.ini"

__ '[General]'
__ 'OutputDirectory=SD_CARD'
__ 'SkipMIB2HIGH=no'
__ 'SkipMIB2TSD=no'
__ 


while IFS='' read -r line || [[ -n "$line" ]]; do
    IFS='/' read -ra cells <<< "$line"
    FILENAME=${cells[0]}
    DATE=${cells[1]}
    COUNTER=${cells[2]}
    NAME=${cells[3]}

    WARNING='no'
    FIRST_WORD=`echo $FILENAME | cut -d'_' -f 1`
    
    case $FIRST_WORD in 
        GATSO) WARNING="yes" ;;
    esac

    echo "Source=./BUILD_csv_h/${FILENAME}_h.csv"

    __ "[$FILENAME]"
    __ "Name=$NAME"
    __ "Warning=$WARNING"
    __ "Source=./BUILD_csv_h/${FILENAME}_h.csv"
    __ "Icon=./src/assets/icn/${FILENAME}.png"
    __ 'Disabled=no'
    __ 
done < ./BUILD/manifest.txt
