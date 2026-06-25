#!/bin/bash


readonly BASE_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )
readonly ROOT_DIR=$(dirname "$BASE_DIR")
readonly FILES="./index.html ./version.svg ./cnx"



_reset()
{
  file=$1

  echo "reset $file"
  perl -pe 's|(<!-- \[([^\[\]]+)\[ -->).*(<!-- \]\2\] -->)|\1\3|g' -i "$file"
}


# Récursion via glob (et non `ls`): robuste aux chemins contenant des espaces.
_fetch_dir()
{
  directory=$1

  for path in "$directory"/*
  do
    [ -e "$path" ] || continue

    if [ -d "$path" ]
    then
      _fetch_dir "$path"
    else
      _reset "$path"
    fi
  done
}


# $FILES est une liste fixe de cibles relatives au dépôt: le découpage par espaces est voulu.
for rel in $FILES
do
  path="$ROOT_DIR/$rel"

  if [ -d "$path" ]
  then
    _fetch_dir "$path"
  elif [ -e "$path" ]
  then
    _reset "$path"
  fi
done

