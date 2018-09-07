#!/bin/bash


BASE_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )
BUILD_PATH="$BASE_DIR/BUILD"
RELEASE_PATH="$BASE_DIR/RELEASES"
MOUNT_PATH="$BASE_DIR/SD_CARD"
MANIFEST_PATH="$BUILD_PATH/manifest.txt"
VERSIONS_PATH="$BUILD_PATH/versions.txt"


make_zip()
{
    if [ -d $BUILD_PATH ]
    then
      EXT=$1

      mkdir "${BUILD_PATH}_${EXT}"
      cp -R ${BUILD_PATH}/*.{bmp,$EXT} "${BUILD_PATH}_${EXT}/"
      zip -r "${RELEASE_PATH}/${EXT}_files.zip" "${BUILD_PATH}_${EXT}/"
      rm -rf "${BUILD_PATH}_${EXT}"
    fi
}


_init()
{
    [ ! -d $BUILD_PATH   ] && mkdir $BUILD_PATH
    [ ! -d $RELEASE_PATH ] && mkdir $RELEASE_PATH
}


_install()
{
    $BASE_DIR/mypois_ctl.sh install
}


_clean()
{
    [ -d $BUILD_PATH ] && rm -rf $BUILD_PATH

    $BASE_DIR/mypois_ctl.sh clean
}


_build()
{
    node $BASE_DIR/src/build.js
}


_release()
{
    [ -d $BUILD_PATH   ] && zip -r $RELEASE_PATH/all_files.zip $BUILD_PATH
    make_zip csv
    make_zip gpx
    make_zip ov2
    [ -d $MOUNT_PATH   ] && zip -r $RELEASE_PATH/sd_files.zip $MOUNT_PATH
}


_unrelease()
{
    [ -d $RELEASE_PATH ] && rm -rf $RELEASE_PATH
}


_mount()
{
    $BASE_DIR/mypois_ctl.sh make
    
    rc=$?
    if [ $rc != 0 ]
    then
      exit $rc
    fi
}


_image()
{
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
    $BASE_DIR/mypois_ctl.sh update-version
    node $BASE_DIR/src/update_doc.js
}


_run()
{
  _init
  _build
  _release
  _mount
  _update_doc
}


if [ "$#" -gt 0 ]
then
  for opt in "$@"
  do
    case $opt in
    "--init")
      _init
      ;;
    "--install")
      _init
      _install
      ;;
    "--clean")
      _clean
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
      _init
      _build
      _unrelease
      _release
      _mount
      _update_doc
      ;;
    esac
  done

  ls -al
else
  _run
fi
