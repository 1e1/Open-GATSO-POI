#!/bin/bash

if [ ! -d ./BUILD_csv_h ]
then
    mkdir ./BUILD_csv_h
fi

for f in `ls ./BUILD/*/*.csv`
do
    cat <(echo 'longitude,latitude,name,comment') $f > ${f//\.csv/_h.csv}
done

mv ./BUILD/*/*_h.csv ./BUILD_csv_h/
