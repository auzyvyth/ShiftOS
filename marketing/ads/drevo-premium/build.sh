#!/bin/sh
# Builds both videos: sh build.sh <work-dir>   (frames are big: keep them out of the repo)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=${1:-/tmp/drevo-ad}
mkdir -p "$WORK"
for L in ms en; do
  node "$HERE/render.cjs" $L events "$WORK/events_$L.json"
  python3 "$HERE/score.py" "$WORK/events_$L.json" "$WORK/mix_$L.wav"
  [ -d "$WORK/fr_$L" ] || node "$HERE/render.cjs" $L frames "$WORK/fr_$L" 4 30
  ffmpeg -loglevel error -y -framerate 30 -i "$WORK/fr_$L/%05d.jpg" -i "$WORK/mix_$L.wav" \
    -af "loudnorm=I=-14:TP=-2:LRA=11" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$HERE/drevo-premium-$L.mp4"
done
