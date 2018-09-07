#!/bin/bash


BASE_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )
MYPOIS_PATH="$BASE_DIR/mypois-master"
MYPOIS_EXEC="$MYPOIS_PATH/mypois.py"
MYPOIS_TS_PATH="$BASE_DIR/mypois-master.ts"
MYPOIS_GZ_PATH="$BASE_DIR/mypois-master.tar.gz"
CONFIG_PATH="$BASE_DIR/config.ini"
BUILD_PATH="$BASE_DIR/BUILD"
SRC_PATH="$BASE_DIR/src"
BUILD_CSV_H_PATH="$BASE_DIR/BUILD_csv_h"
MANIFEST_PATH="$BUILD_PATH/manifest.txt"
VERSIONS_PATH="$BUILD_PATH/versions.txt"
MOUNT_PATH="$BASE_DIR/SD_CARD"


__() { echo $1 >> $CONFIG_PATH; }
¶() {
    echo
    echo '----------'
    echo $1
    echo '----------'
}


_install()
{
    ¶ '_install'
    curl -sSL -D - 'https://github.com/jimmyH/mypois/archive/master.tar.gz' -o $MYPOIS_GZ_PATH
    tar -xzf $MYPOIS_GZ_PATH -C $BASE_DIR
    rm $MYPOIS_GZ_PATH
}


_uninstall()
{
    ¶ '_uninstall'
    [ -d $MYPOIS_PATH ] && rm -rf $MYPOIS_PATH
}


_get_version()
{
    ¶ '_get_version'
    CMD='gdate'

    if [ ! `command -v $CMD` ]
    then
        CMD='date'
    fi

    MYPOIS_MODIFICATION_DATETIME=`curl -ssL -X GET 'https://api.github.com/repos/jimmyH/mypois/commits' | grep '"date"' | head -1 | cut -d '"' -f 4`
    MYPOIS_MODIFICATION_TIMESTAMP=`$CMD -d "$MYPOIS_MODIFICATION_DATETIME" +"%s"`

    echo "$MYPOIS_TS_PATH < $MYPOIS_MODIFICATION_TIMESTAMP"

    echo $MYPOIS_MODIFICATION_TIMESTAMP > $MYPOIS_TS_PATH
}


_clean()
{
    ¶ '_clean'
    [ -f $MYPOIS_TS_PATH   ] && rm -f  $MYPOIS_TS_PATH
    [ -f $CONFIG_PATH      ] && rm -f  $CONFIG_PATH
    [ -d $BUILD_CSV_H_PATH ] && rm -fr $BUILD_CSV_H_PATH
}


_unmount()
{
    ¶ '_unmount'
    [ -d $MOUNT_PATH ] && rm -rf $MOUNT_PATH
}


_erase()
{
    ¶ '_erase'
    _uninstall
    _clean
    _unmount
}


_run()
{
    ¶ '_run'
    if [ -d $MOUNT_PATH ]
    then
        rm -rf $MOUNT_PATH
    fi

    python $MYPOIS_EXEC $CONFIG_PATH
}

_update_version()
{
    ¶ '_update_version'
    if [ ! -f $MYPOIS_TS_PATH ]
    then
        _get_version
    fi 

    MYPOIS_MODIFICATION_TIMESTAMP=`cat $MYPOIS_TS_PATH`

    echo "$MYPOIS_MODIFICATION_TIMESTAMP < $MYPOIS_TS_PATH"

    cp $VERSIONS_PATH "$VERSIONS_PATH.old"
    grep -v '^fs ' "$VERSIONS_PATH.old" > $VERSIONS_PATH
    rm -f "$VERSIONS_PATH.old"

    echo "$VERSIONS_PATH < $MYPOIS_MODIFICATION_TIMESTAMP"

    echo "fs $MYPOIS_MODIFICATION_TIMESTAMP" >> $VERSIONS_PATH
}


_make_config()
{
    ¶ '_make_config'
    echo -n > $CONFIG_PATH 

    if [ ! -d $BUILD_CSV_H_PATH ]
    then
        mkdir $BUILD_CSV_H_PATH
    fi


    echo "Stuffing ./BUILD_csv_h/"

    for f in `ls $BUILD_PATH/*.csv`
    do
        cat <(echo 'longitude,latitude,name,comment') $f > ${f//\.csv/_h.csv}
    done

    mv $BUILD_PATH/*_h.csv $BUILD_CSV_H_PATH/


    echo "Writing config.ini"

    __ '[General]'
    __ "OutputDirectory=$MOUNT_PATH"
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
        FIRST_WORD=`echo $FILENAME | cut -d '_' -f 1`
        FIRST_NAME=`echo $NAME     | cut -d '|' -f 2 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'`

        
        case $FIRST_WORD in 
            GATSO) WARNING='yes' ;;
        esac

        echo "Source=./BUILD_csv_h/${FILENAME}_h.csv"

        __ "[$FILENAME]"
        __ "Name=$NAME"
        __ "Warning=$WARNING"
        __ "Source=$BUILD_CSV_H_PATH/${FILENAME}_h.csv"
        __ "Icon=$SRC_PATH/assets/icn/${FILENAME}.png"
        __ 'Disabled=no'
        #if [ $WARNING == 'yes' ]
        #then
        #    __ "WarnMessage=$FIRST_NAME"
        #    __ 'ActivationRadius=150000'
        #fi
        __ 
    done < $MANIFEST_PATH
}


for opt in "$@"
do
  case $opt in
  "make-config")
    _make_config
    ;;
  "update-version")
    _update_version
    ;;
  "run")
    _run
    ;;
  "install")
    _install
    _get_version
    ;;
  "uninstall")
    _uninstall
    ;;
  "clean")
    _clean
    ;;
  "erase")
    _erase
    ;;
  "make")
    _make_config
    _run
    _update_version
    ;;
  esac
done
