#!/bin/bash


BASE_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )
BUILD_PATH="$BASE_DIR/BUILD"
CACHE_PATH="$BASE_DIR/CACHE"
RELEASE_PATH="$BASE_DIR/RELEASES"
MOUNT_PATH="$BASE_DIR/SD_CARD"
MANIFEST_PATH="$BUILD_PATH/manifest.txt"
VERSIONS_PATH="$BUILD_PATH/versions.txt"

CACHE_FUEL_FR_URL='https://donnees.roulez-eco.fr/opendata/instantane'
CACHE_FUEL_FR_FILENAME='fuel-FR.zip'

CACHE_GATSO_EU_URL='https://lufop.net/wp-content/plugins/downloads-manager/upload/Lufop-Zones-de-danger-EU-CSV.zip'
CACHE_GATSO_EU_FILENAME='gatso-EU.zip'

NODE_ARGS=()

for opt in "$@"
do
  case $opt in
    -arg=*)
      NODE_ARGS+=(${opt#*=})
      ;;
esac
done


¶() {
    echo
    echo '=========='
    echo $1
    echo '=========='
}

make_zip()
{
    ¶ 'make_zip'
    if [ -d $BUILD_PATH ]
    then
        EXT=$1
        count=`ls -1 *.$EXT 2>/dev/null | wc -l`

        if [ $count != 0 ]
        then
            mkdir "${BUILD_PATH}_${EXT}"
            cp -R ${BUILD_PATH}/*.{bmp,$EXT} "${BUILD_PATH}_${EXT}/"
            zip -r "${RELEASE_PATH}/${EXT}_files.zip" "${BUILD_PATH}_${EXT}/"
            rm -rf "${BUILD_PATH}_${EXT}"
        fi
    fi
}

cache_dl()
{
    ¶ 'cache_dl'
    curl -sSL -H 'User-Agent: Mozilla/5.0' -D - $1 -o "$CACHE_PATH/$2"
}


_cache()
{
    ¶ '_cache'
    [ ! -d $CACHE_PATH ] && mkdir $CACHE_PATH
    [ ! -f $CACHE_FUEL_FR_FILENAME  ] && cache_dl $CACHE_FUEL_FR_URL  $CACHE_FUEL_FR_FILENAME
    [ ! -f $CACHE_GATSO_EU_FILENAME ] && cache_dl $CACHE_GATSO_EU_URL $CACHE_GATSO_EU_FILENAME
}


_uncache()
{
    ¶ '_uncache'
    [ -d $CACHE_PATH ] && rm -rf $CACHE_PATH
}


_init()
{
    ¶ '_init'
    [ ! -d $BUILD_PATH   ] && mkdir $BUILD_PATH
    [ ! -d $RELEASE_PATH ] && mkdir $RELEASE_PATH
}


_install()
{
    ¶ '_install'
    $BASE_DIR/mypois_ctl.sh install
}


_uninstall()
{
    ¶ '_uninstall'
    $BASE_DIR/mypois_ctl.sh erase
}


_clean()
{
    ¶ '_clean'
    $BASE_DIR/mypois_ctl.sh clean
    
    [ -d $BUILD_PATH ] && rm -rf $BUILD_PATH
}


_erase()
{
    ¶ '_erase'
    _uncache
    $BASE_DIR/mypois_ctl.sh erase
    _clean
    _unrelease
}


_build()
{
    ¶ '_build'
    node $BASE_DIR/src/build.js ${NODE_ARGS[*]}
}


_release()
{
    ¶ '_release'
    [ ! -d $RELEASE_PATH ] && mkdir $RELEASE_PATH
    [ -d $BUILD_PATH ] && zip -r $RELEASE_PATH/all_files.zip $BUILD_PATH
    make_zip csv
    make_zip gpx
    make_zip ov2
    [ -d $MOUNT_PATH ] && zip -r $RELEASE_PATH/sd_files.zip $MOUNT_PATH
}


_unrelease()
{
    ¶ '_unrelease'
    [ -d $RELEASE_PATH ] && rm -rf $RELEASE_PATH
}


_mount()
{
    ¶ '_mount'
    $BASE_DIR/mypois_ctl.sh make
    
    rc=$?
    if [ $rc != 0 ]
    then
      exit $rc
    fi
}


_image()
{
    ¶ '_image'
    CMD='genisoimage'

    if [ ! `command -v $CMD` ]
    then
        CMD='mkisofs'
    fi

    $CMD -o $BUILD_PATH/sd_image.iso $MOUNT_PATH
    zip -r $RELEASE_PATH/sd_image.iso.zip $BUILD_PATH/sd_image.iso
    rm -f $BUILD_PATH/sd_image.iso
}


_update_doc()
{
    ¶ '_update_doc'
    $BASE_DIR/mypois_ctl.sh update-version
    node $BASE_DIR/src/update_doc.js
}


_run()
{
    ¶ '_run'
    _init
    _build
    _mount
    _release
    _update_doc
}


_help()
{
read -d '' CONFIG <<- EOM
<nothing>
    _init
    _build
    _mount
    _release
    _update_doc
--init
    _init
--uncache
    _uncache
--cache
    _cache
--uninstall
    _uninstall
--install
    _init
    _install
--clean
    _clean
--erase
    _erase
--unrelease
    _unrelease
--build
    _build
--release
    _release
--mount
    _mount
    _update_doc
--image
    _image
--update-doc
    _update_doc
--run
    _init
    _build
    _mount
    _release
    _update_doc
--standalone
    _unrelease
    _init
    _build
    _mount
    _release
    _update_doc
--help
    _help
EOM
echo "$CONFIG"
}


if [ "$#" -gt 0 ]
then
  for opt in "$@"
  do
    case $opt in
    "--init")
      _init
      ;;
    "--cache")
      _cache
      ;;
    "--uncache")
      _uncache
      ;;
    "--install")
      _init
      _install
      ;;
    "--uninstall")
      _uninstall
      ;;
    "--clean")
      _clean
      ;;
    "--erase")
      _erase
      ;;
    "--unrelease")
      _unrelease
      ;;
    "--build")
      _build
      ;;
    "--release")
      _release
      ;;
    "--mount")
      _mount
      _update_doc
      ;;
    "--image")
      _image
      ;;
    "--update-doc")
      _update_doc
      ;;
    "--run")
      _run
      ;;
    "--standalone")
      _unrelease
      _run
      ;;
    "--help")
      _help
      ;;
    esac
  done
else
  _run
fi

echo 
echo 'done'
