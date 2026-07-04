#!/bin/bash


# pipefail: un échec dans un pipe (ex: gpsbabel -V | awk) n'est plus masqué par la dernière commande.
# (on évite set -e/-u: incompatibles avec les idiomes `[ test ] && cmd` du script)
set -o pipefail


readonly BIN_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )
readonly BASE_DIR=$( dirname "$BIN_DIR")
readonly GPSLABEL_VERSION_PATH="$BASE_DIR/gpsbabel.version"
readonly BUILD_PATH="$BASE_DIR/BUILD"
readonly SRC_PATH="$BASE_DIR/src"
readonly MANIFEST_PATH="$BUILD_PATH/manifest.txt"
readonly VERSIONS_PATH="$BUILD_PATH/versions.txt"
readonly MOUNT_PATH="$BASE_DIR/SD_CARD/Garmin/POI"

# Version épinglée: on exige >= 1.10.0 pour le correctif GPI #1243
# (couleurs corrompues + faux warning "load_bitmap_from_file" avec des BMP 24 bpp,
# ce qui est précisément le format des icônes de src/assets/icn/*.bmp).
# Les runners ubuntu-latest (24.04) ne fournissent que 1.9.0 via apt: on compile
# alors le binaire CLI depuis le tag GitHub et on le met en cache (cf .github/workflows).
readonly GPSBABEL_MIN_VERSION="1.10.0"
readonly GPSBABEL_LOCAL_DIR="$BASE_DIR/gpsbabel-bin"
readonly GPSBABEL_LOCAL_EXEC="$GPSBABEL_LOCAL_DIR/gpsbabel"

# Tag compilé si aucun gpsbabel système ne satisfait GPSBABEL_MIN_VERSION.
# Surchargeable via `--gpsbabel-ref=...` ou l'environnement GPSBABEL_REF.
GPSBABEL_REF="${GPSBABEL_REF:-gpsbabel_1_10_0}"
for opt in "$@"
do
  case $opt in
    --gpsbabel-ref=*)
      GPSBABEL_REF=${opt#*=}
      ;;
  esac
done

# Binaire à utiliser, résolu AU MOMENT DE L'APPEL (et non au chargement): _install
# peut compiler le binaire local dans la même invocation (dispatch `install` ->
# _install puis _get_version). Le binaire local compilé prime; sinon on retombe sur
# le gpsbabel du PATH (dev macOS via `brew install gpsbabel`, déjà >= 1.10.0).
_gpsbabel_bin()
{
    if [ -x "$GPSBABEL_LOCAL_EXEC" ]
    then
        echo "$GPSBABEL_LOCAL_EXEC"
    else
        echo "gpsbabel"
    fi
}


# _version_ge A B  ->  vrai si A >= B (comparaison de versions, tri -V)
_version_ge()
{
    [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]
}


¶()
{
    echo
    echo '----------------------'
    echo "Garmin   $1"
    echo '----------------------'
}


_install()
{
    ¶ '_install'

    # 1) Binaire local déjà compilé (cache CI restauré) -> rien à faire.
    if [ -x "$GPSBABEL_LOCAL_EXEC" ]
    then
        echo "[gpsbabel] binaire local présent: $("$GPSBABEL_LOCAL_EXEC" -V 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
        return 0
    fi

    # 2) gpsbabel système déjà assez récent (ex: brew sur macOS) -> on l'utilise tel quel.
    if command -v gpsbabel >/dev/null 2>&1
    then
        SYS_VERSION=`gpsbabel -V 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1`
        if [ -n "$SYS_VERSION" ] && _version_ge "$SYS_VERSION" "$GPSBABEL_MIN_VERSION"
        then
            echo "[gpsbabel] version système suffisante ($SYS_VERSION >= $GPSBABEL_MIN_VERSION), pas de compilation"
            return 0
        fi
        echo "[gpsbabel] version système insuffisante (${SYS_VERSION:-absente} < $GPSBABEL_MIN_VERSION) -> compilation de $GPSBABEL_REF"
    fi

    # 3) Compilation du CLI depuis le tag épinglé.
    SRC_DIR="$BASE_DIR/gpsbabel-src"
    TARBALL="$BASE_DIR/gpsbabel-src.tar.gz"
    GH_URL="https://github.com/GPSBabel/gpsbabel/archive/refs/tags/${GPSBABEL_REF}.tar.gz"

    echo "[gpsbabel] téléchargement $GH_URL"
    if ! curl -fsSL --retry 3 --retry-delay 5 --retry-all-errors "$GH_URL" -o "$TARBALL"
    then
        echo "[ERROR] téléchargement source gpsbabel échoué: $GH_URL" >&2
        exit 1
    fi

    rm -rf "$SRC_DIR"
    mkdir -p "$SRC_DIR"
    tar -xzf "$TARBALL" -C "$SRC_DIR" --strip-components 1 || exit 1
    rm -f "$TARBALL"

    # La GUI (gui/) est ajoutée sans condition par le CMakeLists racine et exige
    # Qt6 SerialPort/WebEngine, inutiles pour notre usage CLI et non installés en CI.
    # On neutralise son add_subdirectory pour que `cmake` ne configure que le binaire
    # ligne de commande (Core + Core5Compat suffisent alors).
    perl -pi -e 's/^\s*add_subdirectory\(gui\)/# add_subdirectory(gui) # OpenGATSO: CLI only/' "$SRC_DIR/CMakeLists.txt" || exit 1

    # Cible `gpsbabel` uniquement (pas la GUI gpsbabelfe): seul le CLI nous sert.
    (
        cd "$SRC_DIR" || exit 1
        cmake . -G Ninja -DCMAKE_BUILD_TYPE=Release || exit 1
        cmake --build . --target gpsbabel || exit 1
    ) || { echo "[ERROR] build gpsbabel échoué" >&2; exit 1; }

    if [ ! -x "$SRC_DIR/gpsbabel" ]
    then
        echo "[ERROR] binaire gpsbabel introuvable après build" >&2
        exit 1
    fi

    mkdir -p "$GPSBABEL_LOCAL_DIR"
    cp "$SRC_DIR/gpsbabel" "$GPSBABEL_LOCAL_EXEC" || exit 1
    rm -rf "$SRC_DIR"

    echo "[gpsbabel] installé: $("$GPSBABEL_LOCAL_EXEC" -V 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
}


_uninstall()
{
    ¶ '_uninstall'
    [ -d "$GPSBABEL_LOCAL_DIR" ] && rm -rf "$GPSBABEL_LOCAL_DIR"
    [ -d "$BASE_DIR/gpsbabel-src" ] && rm -rf "$BASE_DIR/gpsbabel-src"
    [ -f "$BASE_DIR/gpsbabel-src.tar.gz" ] && rm -f "$BASE_DIR/gpsbabel-src.tar.gz"
}


_init()
{
    ¶ '_init'
    mkdir -p "$MOUNT_PATH"
}


_get_version()
{
    ¶ '_get_version'

    # gpsbabel -V écrit sa bannière sur stderr -> 2>&1. Extraction tolérante au format
    # (premier jeton X.Y[.Z]) plutôt qu'un champ awk positionnel figé.
    GPSLABEL_EXEC=$(_gpsbabel_bin)
    GPSBABEL_VERSION=`$GPSLABEL_EXEC -V 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1`

    if [ -n "$GPSBABEL_VERSION" ] && ! _version_ge "$GPSBABEL_VERSION" "$GPSBABEL_MIN_VERSION"
    then
        echo "[WARN] gpsbabel $GPSBABEL_VERSION < $GPSBABEL_MIN_VERSION: correctif GPI #1243 absent (couleurs des icônes BMP 24 bpp potentiellement corrompues)" >&2
    fi

    echo "$GPSLABEL_VERSION_PATH < $GPSBABEL_VERSION"

    echo "$GPSBABEL_VERSION" > "$GPSLABEL_VERSION_PATH"
}


_clean()
{
    ¶ '_clean'
    [ -f "$GPSLABEL_VERSION_PATH" ] && rm -f "$GPSLABEL_VERSION_PATH"
}


_unmount()
{
    ¶ '_unmount'
    [ -d "$MOUNT_PATH" ] && rm -rf "$MOUNT_PATH"
}


_erase()
{
    ¶ '_erase'
    _uninstall
    _clean
    _unmount
}


_update_version()
{
    ¶ '_update_version'
    # Avant: test sur $MYPOIS_TS_PATH (variable d'un autre script, vide ici) -> _get_version appelé à tort.
    if [ ! -f "$GPSLABEL_VERSION_PATH" ]
    then
        _get_version
    fi

    GPSLABEL_VERSION=`cat "$GPSLABEL_VERSION_PATH"`

    echo "$GPSLABEL_VERSION < $GPSLABEL_VERSION_PATH"

    cp "$VERSIONS_PATH" "$VERSIONS_PATH.old"
    grep -v '^gpsbabel ' "$VERSIONS_PATH.old" > "$VERSIONS_PATH"
    rm -f "$VERSIONS_PATH.old"

    echo "$VERSIONS_PATH < $GPSLABEL_VERSION"

    echo "gpsbabel $GPSLABEL_VERSION" >> "$VERSIONS_PATH"
}


_run()
{
    ¶ '_run'
    _unmount
    _init

    GPSLABEL_EXEC=$(_gpsbabel_bin)

    while IFS='' read -r line || [[ -n "$line" ]]; do
        IFS='/' read -ra cells <<< "$line"
        FILENAME=${cells[0]}
        DATE=${cells[1]}
        COUNTER=${cells[2]}
        NAME=${cells[3]}

        GPI_NAME=`echo "$FILENAME" | sed -e 's/_\([0-9]\{1,\}$\)/@\1/'`
        BMP_PATH="$SRC_PATH/assets/icn/${FILENAME}.bmp"

        SOURCE="$BUILD_PATH/${FILENAME}.gpx"
        DESTINATION="$BUILD_PATH/${FILENAME}.gpi"

        [ -f "$SOURCE" ] && $GPSLABEL_EXEC -i gpx -f "$SOURCE" -o garmin_gpi,alerts=1,bitmap="$BMP_PATH" -F "$DESTINATION"
    done < "$MANIFEST_PATH"

    cp "$BUILD_PATH"/*.gpi "${MOUNT_PATH}/" 2>/dev/null

    # retire le dossier s'il est resté vide (aucun .gpi généré)
    rmdir "${MOUNT_PATH}" 2>/dev/null
}


_help()
{
read -d '' CONFIG <<- EOM
clean
    _clean
erase
    _erase
help
    _help
install
    _install
    _get_version
make
    _run
    _update_version
make-config
    _make_config
run
    _run
update-version
    _update_version
EOM
echo "$CONFIG"
}


for opt in "$@"
do
  case $opt in
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
    _run
    _update_version
    ;;
  "help")
    _help
    ;;
  esac
done
