#!/usr/bin/env bash
# Despliega Speak English Enzo en el VPS (https://speak-english-enzo.enzocode.dev).
#
# Compila el export estático en local, lo sube como una versión nueva a
# /var/www/speak-english-enzo/releases/<fecha>-<commit> y mueve el enlace
# `current` (Caddy sirve `current`, así que el cambio es instantáneo).
# Se conservan las 5 últimas versiones para poder volver atrás:
#   ./scripts/deploy.sh rollback      -> vuelve a la versión anterior
#
# Requiere el alias SSH `mi-servidor` (o HOST=otro ./scripts/deploy.sh).
set -euo pipefail
HOST="${HOST:-mi-servidor}"
BASE=/var/www/speak-english-enzo
URL=https://speak-english-enzo.enzocode.dev
cd "$(dirname "$0")/.."

if [ "${1:-}" = "rollback" ]; then
  ssh "$HOST" "set -e; cd $BASE/releases; cur=\$(basename \$(readlink -f $BASE/current));
    prev=\$(ls -1 | sort | grep -B1 -x \"\$cur\" | head -1);
    [ \"\$prev\" != \"\$cur\" ] || { echo 'No hay versión anterior'; exit 1; };
    sudo -n ln -sfn $BASE/releases/\$prev $BASE/current; echo \"Activa: \$prev\""
  exit 0
fi

npm run validate
npm run build
REL="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
TGZ="$(mktemp -t speak-XXXXXX).tgz"
tar -czf "$TGZ" -C out .
scp -q "$TGZ" "$HOST:/tmp/speak-$REL.tgz"
rm -f "$TGZ"
ssh "$HOST" "set -e
  sudo -n mkdir -p $BASE/releases/$REL
  sudo -n tar -xzf /tmp/speak-$REL.tgz -C $BASE/releases/$REL
  rm -f /tmp/speak-$REL.tgz
  sudo -n chmod -R a+rX $BASE/releases/$REL
  sudo -n ln -sfn $BASE/releases/$REL $BASE/current
  cd $BASE/releases && ls -1 | sort | head -n -5 | xargs -r sudo -n rm -rf
  echo \"Activa: $REL\""

code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/")
echo "$URL -> HTTP $code"
[ "$code" = 200 ]
