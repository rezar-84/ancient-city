#!/bin/bash
# usage: commons_tree.sh "Category:X" depth
UA="HierapolisResearch/1.0 (university project)"
walk(){ local c="$1" d="$2" ind="$3"
  local n=$(curl -s -A "$UA" "https://commons.wikimedia.org/w/api.php?action=query&prop=categoryinfo&titles=$(jq -rn --arg x "$c" '$x|@uri')&format=json" | jq -r '.query.pages[]|.categoryinfo.files//0')
  echo "$ind$c [$n files]"
  [ "$d" -le 0 ] && return
  curl -s -A "$UA" "https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=$(jq -rn --arg x "$c" '$x|@uri')&cmtype=subcat&cmlimit=500&format=json" | jq -r '.query.categorymembers[].title' | while read s; do walk "$s" $((d-1)) "$ind  "; done
}
walk "$1" "$2" ""
