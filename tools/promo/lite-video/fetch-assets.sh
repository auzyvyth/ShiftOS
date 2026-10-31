#!/bin/sh
# Car photos for the promo: the platform's own new-car catalogue photos
# (new_car_model_media, uploaded in console > New car prices). Not committed.
set -e
cd "$(dirname "$0")" && mkdir -p assets && cd assets
B=https://lemdkdizdlcirhbzqlos.supabase.co/storage/v1/object/public/car-images/d34d145d-ccd1-4a07-b14b-43db42a20a56/new-car-models
curl -sfo x50.jpg   $B/stock-proton-x50.jpg
curl -sfo x70.jpg   $B/stock-proton-x70.jpg
curl -sfo saga.jpg  $B/stock-proton-saga.jpg
curl -sfo persona.jpg $B/stock-proton-persona.jpg
curl -sfo myvi.jpg  $B/1792771616180-lsy96p6o13f.jpg
curl -sfo axia.jpg  $B/1792771519483-j9fqwpbassj.jpg
curl -sfo bezza.jpg $B/1792771566933-4yug3zra0ht.jpg
curl -sfo alza.jpg  $B/1792771388143-ido54ng6wu.jpg
