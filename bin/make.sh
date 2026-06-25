#!/bin/bash


# pipefail: un échec dans un pipe (ex: curl | ...) n'est plus masqué par la dernière commande.
# (on évite set -e/-u: incompatibles avec les idiomes `[ test ] && cmd` et les tableaux vides en bash 3.2)
set -o pipefail


readonly BIN_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )
readonly BASE_DIR=$( dirname "$BIN_DIR")
readonly BUILD_PATH="$BASE_DIR/BUILD"
readonly CACHE_PATH="$BASE_DIR/CACHE"
readonly MANIFEST_PATH="$BUILD_PATH/manifest.txt"
readonly VERSIONS_PATH="$BUILD_PATH/versions.txt"

RELEASE_PATH="$BASE_DIR/RELEASES"
RELEASE_PREFIX=''
MOUNT_PATH="$BASE_DIR/SD_CARD"

readonly CACHE_FUEL_FR_URL='https://donnees.roulez-eco.fr/opendata/instantane'
readonly CACHE_FUEL_FR_FILENAME='fuel-FR.zip'

readonly CACHE_GATSO_EU_URL='https://lufop.net/wp-content/plugins/downloads-manager/upload/Lufop-Zones-de-danger-EU-CSV.zip'
readonly CACHE_GATSO_EU_FILENAME='gatso-EU.zip'

BUILD_ARGS=()
INSTALL_ARGS=()

for opt in "$@"
do
  case $opt in
    --build=*)
      BUILD_ARGS+=(${opt#*=})
      ;;
    --install-channel=*)
      INSTALL_ARGS+=("--install-channel=${opt#*=}")
      ;;
    --release=*)
      RELEASE_PATH=${opt#*=}
      ;;
    --release-prefix=*)
      RELEASE_PREFIX=${opt#*=}
      ;;
esac
done


¶()
{
    echo
    echo '=========='
    echo $1
    echo '=========='
}

∂()
{
    #realpath --relative-to=$BASE_DIR $1
    ABSOLUTE_PATH=$1
    RELATIVE_PATH=${ABSOLUTE_PATH#$BASE_DIR}
    echo "./$RELATIVE_PATH"
}


make_flat_zip()
{
    ¶ 'make_flat_zip'
    if [ -d $BUILD_PATH ]
    then
        EXT=$1
        count=`ls -1 $BUILD_PATH/*.$EXT 2>/dev/null | wc -l`

        if [ $count != 0 ]
        then
            mkdir -p "${BUILD_PATH}_${EXT}"
            cp -R ${BUILD_PATH}/*.{bmp,$EXT} "${BUILD_PATH}_${EXT}/"
            zip -qjr "${RELEASE_PATH}/${RELEASE_PREFIX}${EXT}_files.zip" $(∂ "${BUILD_PATH}_${EXT}/")
            rm -rf "${BUILD_PATH}_${EXT}"
        fi
    fi
}

cache_dl()
{
    ¶ 'cache_dl'
    mkdir -p "$CACHE_PATH"
    # --fail: erreur sur statut HTTP >= 400 (évite de stocker une page d'erreur en .zip)
    # --retry: encaisse un aléa réseau transitoire (on garde l'échec net si la source est vraiment morte)
    if ! curl -fsSL --retry 3 --retry-delay 5 --retry-all-errors -H 'User-Agent: Mozilla/5.0' "$1" -o "$CACHE_PATH/$2"
    then
        echo "[ERROR] téléchargement échoué: $1" >&2
        rm -f "$CACHE_PATH/$2"
        return 1
    fi
}


_cache()
{
    ¶ '_cache'
    # On teste/écrit le MÊME chemin absolu (avant: test sur un chemin relatif -> re-téléchargement systématique).
    if [ ! -f "$CACHE_PATH/$CACHE_FUEL_FR_FILENAME" ]
    then
        cache_dl "$CACHE_FUEL_FR_URL" "$CACHE_FUEL_FR_FILENAME" || exit 1
    fi
    if [ ! -f "$CACHE_PATH/$CACHE_GATSO_EU_FILENAME" ]
    then
        cache_dl "$CACHE_GATSO_EU_URL" "$CACHE_GATSO_EU_FILENAME" || exit 1
    fi
}


_uncache_auto()
{
    ¶ '_uncache_auto'
    find "$CACHE_PATH" -type f -mmin +360 -delete
}


_uncache()
{
    ¶ '_uncache'
    [ -d "$CACHE_PATH" ] && rm -rf "$CACHE_PATH"
}


_init()
{
    ¶ '_init'
    [ ! -d "$BUILD_PATH" ] && mkdir -p "$BUILD_PATH"
}


_install()
{
    ¶ '_install'
    "$BIN_DIR/mypois_ctl.sh" install "${INSTALL_ARGS[@]}"
    "$BIN_DIR/gpsbabel_ctl.sh" install "${INSTALL_ARGS[@]}"
}


_uninstall()
{
    ¶ '_uninstall'
    $BIN_DIR/mypois_ctl.sh erase
    $BIN_DIR/gpsbabel_ctl.sh erase
}


_clean()
{
    ¶ '_clean'
    $BIN_DIR/mypois_ctl.sh clean
    $BIN_DIR/gpsbabel_ctl.sh clean

    [ -d "$BUILD_PATH" ] && rm -rf "$BUILD_PATH"
}


_erase()
{
    ¶ '_erase'
    _uncache
    $BIN_DIR/mypois_ctl.sh erase
    $BIN_DIR/gpsbabel_ctl.sh erase
    [ -d "$MOUNT_PATH" ] && rm -rf "$MOUNT_PATH"
    _clean
    _unrelease
}


_build()
{
    ¶ '_build'
    node "$BASE_DIR/src/build.js" "${BUILD_ARGS[@]}" || exit 1
}


_release()
{
    ¶ '_release'
    [ ! -d "$RELEASE_PATH" ] && mkdir -p "$RELEASE_PATH"
    [ -d "$BUILD_PATH" ] && zip -qjr "$RELEASE_PATH/${RELEASE_PREFIX}all_files.zip" "$(∂ "$BUILD_PATH")"
    make_flat_zip csv
    make_flat_zip gpx
    make_flat_zip gpi
    make_flat_zip ov2
    if [ -d "$MOUNT_PATH" ]
    then
        for img_path in "$MOUNT_PATH"/*
        do
            [ -e "$img_path" ] || continue
            img=$(basename "$img_path")
            zip -qr "$RELEASE_PATH/${RELEASE_PREFIX}${img}_files.zip" "$(∂ "$img_path")"
        done
    fi
}


_unrelease()
{
    ¶ '_unrelease'
    [ -d "$RELEASE_PATH" ] && rm -rf "$RELEASE_PATH"
}


_mount()
{
    ¶ '_mount'
    # On vérifie le code retour de CHAQUE générateur. Auparavant seul celui de gpsbabel
    # était testé: un échec de mypois (cible VAG) passait en silence -> release amputée
    # de VAG_files.zip / VAG_image.iso.zip sans que le build n'échoue.
    $BIN_DIR/mypois_ctl.sh make || exit $?
    $BIN_DIR/gpsbabel_ctl.sh make || exit $?
}


_image()
{
    ¶ '_image'
    CMD='genisoimage'

    if ! command -v "$CMD" >/dev/null 2>&1
    then
        CMD='mkisofs'
    fi

    for img_path in "$MOUNT_PATH"/*
    do
        [ -e "$img_path" ] || continue
        img=$(basename "$img_path")

        "$CMD" -iso-level 4 -o "$BUILD_PATH/sd_image.iso" "$(∂ "$img_path")" || exit 1
        [ ! -d "$RELEASE_PATH" ] && mkdir -p "$RELEASE_PATH"
        zip -qr "$RELEASE_PATH/${RELEASE_PREFIX}${img}_image.iso.zip" "$(∂ "$BUILD_PATH/sd_image.iso")" || exit 1
        rm -f "$BUILD_PATH/sd_image.iso"
    done
}


_update_doc()
{
    ¶ '_update_doc'
    $BIN_DIR/mypois_ctl.sh update-version
    $BIN_DIR/gpsbabel_ctl.sh update-version
    node "$BASE_DIR/src/update_doc.js"
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
--cache-force
    _cache
--cache
    _uncache_auto
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
    "--cache-force")
      _cache
      ;;
    "--cache")
      _uncache_auto
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
