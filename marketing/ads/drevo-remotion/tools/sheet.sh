#!/bin/bash
# tools/sheet.sh <Comp> <lang> <out.jpg> <cols> <label=sec>...   labelled contact sheet from tools/stills.cjs output
comp=$1; lang=$2; out=$3; cols=$4; shift 4
secs=(); labels=(); for a in "$@"; do labels+=("${a%%=*}"); secs+=("${a##*=}"); done
node tools/stills.cjs $comp $lang out/sheet "${secs[@]}" >/dev/null || exit 1
F=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf; args=(); fc=""; n=${#secs[@]}
for i in "${!secs[@]}"; do args+=(-i "out/sheet/$comp-$lang-${secs[$i]}.jpg"); fc+="[$i]scale=432:-1,pad=432:808:0:40:white,drawtext=fontfile=$F:text='${secs[$i]}s  ${labels[$i]}':x=12:y=10:fontsize=20:fontcolor=black[v$i];"; done
rows=$(( (n + cols - 1) / cols )); total=$((rows*cols))
for ((i=n;i<total;i++)); do fc+="color=white:s=432x808[v$i];"; done
for ((r=0;r<rows;r++)); do for ((c=0;c<cols;c++)); do fc+="[v$((r*cols+c))]"; done; fc+="hstack=$cols[r$r];"; done
for ((r=0;r<rows;r++)); do fc+="[r$r]"; done; fc+="vstack=$rows"
ffmpeg -loglevel error -y "${args[@]}" -filter_complex "$fc" -frames:v 1 "$out"
