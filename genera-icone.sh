#!/bin/sh
# Genera le quattro icone PWA da logo-icona.svg (ImageMagick).
# Una tantum: si rilancia solo se cambia il logo o cambiano le misure.
#
# PERCHÉ QUATTRO FILE E NON UNO.
# Le due `purpose` del manifest esistono apposta per non dover scegliere:
#   any       -> l'icona si vede intera, il sistema NON la ritaglia: fondo trasparente
#                e formaggio grande (92% del lato), che è ciò che si vuole vedere.
#   maskable  -> Android ritaglia un cerchio e tiene solo la parte centrale: serve
#                fondo PIENO (una trasparente diventerebbe un buco con la crosta tagliata)
#                e formaggio piccolo (60%), dentro la safe zone.
# Dichiarare `"any maskable"` sullo stesso file costringe a un compromesso peggiore
# di entrambi: è esattamente ciò che questo script evita.
#
# apple-touch-icon: fondo PIENO anche lui, ed è un'altra trappola dello stesso genere.
# iOS compone i PNG trasparenti su NERO: con un file trasparente si otterrebbe un
# rettangolo nero al posto del marrone del tema.
#
# La sorgente è `logo-icona.svg`, cioè il logo SENZA il cubetto staccato (path 8 e 9).
# Non è solo estetica: il cubetto allarga il riquadro del disegno, quindi a parità di
# tela costringe il formaggio a rimpicciolire. `logo.svg` per l'header resta col cubetto,
# lì il disegno ha il suo spazio.
set -e
cd "$(dirname "$0")"

FONDO='#241708'          # = manifest.background_color
SRC=/tmp/_clan-logo.png

convert -background none logo-icona.svg -resize 2048x2048 -trim +repage "$SRC"

# ── purpose: any — trasparenti, formaggio al 92% (512*0.92 = 471) ──
convert "$SRC" -resize 471x471 -background none -gravity center -extent 512x512 \
        -depth 8 -strip icon-512.png
convert icon-512.png -resize 192x192 -depth 8 -strip icon-192.png

# ── purpose: maskable — fondo pieno, formaggio al 60% (512*0.60 = 307) ──
convert "$SRC" -resize 307x307 -background "$FONDO" -gravity center -extent 512x512 \
        -alpha remove -depth 8 -strip icon-maskable-512.png

# ── apple-touch-icon — fondo pieno, formaggio al 72% (180*0.72 = 130) ──
convert "$SRC" -resize 130x130 -background "$FONDO" -gravity center -extent 180x180 \
        -alpha remove -depth 8 -strip apple-touch-icon.png

rm -f "$SRC"
echo "Fatte: icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png"
