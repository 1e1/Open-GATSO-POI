#!/bin/bash


CSV_URL='https://raw.githubusercontent.com/AntoineAugusti/radars-france/master/data/radars.csv'
PROJECT_DIR="$( dirname $( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd ) )"
SRC_DIR="${PROJECT_DIR}/src/"
TMP_DIR="${PROJECT_DIR}/_tmp/"
RELEASE_DIR="${PROJECT_DIR}/SD_CARD/FR_SPEED_CAMERA/"
CSV_LINE=2
CSV_INPUT='radars-france.csv'
CSV_OUTPUT='FR_SPEED_CAMERA[speed].csv'

INPUT_PATH="${TMP_DIR}${CSV_INPUT}"
OUTPUT_PATH=`echo "${TMP_DIR}${CSV_OUTPUT}" | sed 's/\[speed\]//g'`

echo "FR SPEED CAMERA file for Garmin POI"
echo 
echo "create TMP_DIR=${TMP_DIR}"

rm -rf $TMP_DIR
mkdir $TMP_DIR

echo "get ${CSV_URL}"
curl $CSV_URL > $INPUT_PATH
fields=`head -1 "${INPUT_PATH}" | sed 's/,/ /g'`

echo "tranform source to POI file"
while IFS="," read $fields
do
    vitesse_vehicules_legers_kmh=`echo $vitesse_vehicules_legers_kmh | sed "s/,//g"`
    if [ ${vitesse_vehicules_legers_kmh} ] 
    then
        if [[ $vitesse_vehicules_legers_kmh =~ ^-?[0-9]+$ ]]
        then
            OUTPUT_PATH=`echo "${TMP_DIR}${CSV_OUTPUT}" | sed "s/\[speed\]/@${vitesse_vehicules_legers_kmh}/g"`
            if [ ! -f $OUTPUT_PATH ]
            then
                echo "touch ${OUTPUT_PATH} (id=${id})"
                touch $OUTPUT_PATH
            fi
            
            echo "${longitude}, ${latitude}, \"${vitesse_vehicules_legers_kmh}km/h\", \"${direction} (${id})\"" \
            >> $OUTPUT_PATH
        fi 
    else 
        OUTPUT_PATH=`echo "${TMP_DIR}${CSV_OUTPUT}" | sed 's/\[speed\]//g'`
        if [ ! -f $OUTPUT_PATH ]
        then
            echo "touch ${OUTPUT_PATH} (id=${id})"
            touch $OUTPUT_PATH
        fi

        echo "${longitude}, ${latitude}, speed, \"${direction} (${id})\"" \
        >> $OUTPUT_PATH
    fi
done < $INPUT_PATH

echo "clean ${RELEASE_DIR}"
rm -rf $RELEASE_DIR
mkdir $RELEASE_DIR

echo "clean ${TMP_DIR}"
rm $INPUT_PATH

cp -r "${TMP_DIR}"* $RELEASE_DIR
cp "${SRC_DIR}assets/"* $RELEASE_DIR
rm -rf $TMP_DIR

echo "done"
echo 
echo "go to ${RELEASE_DIR}"
