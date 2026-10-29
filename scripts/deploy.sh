#!/usr/bin/env bash
# Despliegue de Speak English Enzo en el VPS.
# Toda la configuración está en deploy/deploy.conf.
#
#   ./scripts/deploy.sh            compila, sube una versión nueva y la activa
#   ./scripts/deploy.sh rollback   vuelve a la versión anterior
#   ./scripts/deploy.sh status     muestra la versión activa y las guardadas
#   ./scripts/deploy.sh setup      prepara el servidor desde cero (idempotente):
#                                  instala Caddy y la configuración del sitio
#
# Cómo queda el servidor:
#   /etc/caddy/Caddyfile                 bloque global + import /etc/caddy/sites/*.caddy
#   /etc/caddy/sites/$SITE.caddy         copia de deploy/site.caddy (HTTPS automático)
#   $BASE/releases/<fecha>-<commit>/     cada versión desplegada (se guardan $KEEP)
#   $BASE/current -> releases/<...>      la que sirve Caddy (cambio instantáneo)
#   /var/log/caddy/$SITE.log             log de accesos (rotado)
set -euo pipefail
cd "$(dirname "$0")/.."

HOST_OVERRIDE="${HOST:-}"
# shellcheck source=../deploy/deploy.conf
. deploy/deploy.conf
HOST="${HOST_OVERRIDE:-$HOST}"
URL="https://$DOMAIN"

remote() { ssh "$HOST" "$@"; }

check_url() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL/" || true)
  echo "$URL -> HTTP $code"
  [ "$code" = 200 ]
}

cmd_setup() {
  echo "==> Preparando $HOST para $DOMAIN"
  scp -q "$CADDY_SITE_FILE" "$HOST:/tmp/$SITE.caddy"
  remote "set -e
    export DEBIAN_FRONTEND=noninteractive
    if ! command -v caddy >/dev/null; then
      echo '--> Instalando Caddy (repositorio oficial)'
      sudo -n apt-get update -qq
      sudo -n apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
      curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo -n gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo -n tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
      sudo -n apt-get update -qq
      sudo -n apt-get install -y -qq caddy >/dev/null
    fi
    caddy version
    sudo -n mkdir -p /etc/caddy/sites $BASE/releases
    if ! grep -q 'import /etc/caddy/sites/\*.caddy' /etc/caddy/Caddyfile 2>/dev/null; then
      echo '--> Caddyfile principal con import de /etc/caddy/sites'
      [ -f /etc/caddy/Caddyfile ] && sudo -n cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-\$(date +%Y%m%d-%H%M%S)
      printf '%s\n' '# Caddy principal del VPS: cada sitio vive en /etc/caddy/sites/<nombre>.caddy' '{' '	admin localhost:2019' '}' '' 'import /etc/caddy/sites/*.caddy' | sudo -n tee /etc/caddy/Caddyfile >/dev/null
    fi
    sudo -n install -m 644 /tmp/$SITE.caddy /etc/caddy/sites/$SITE.caddy
    rm -f /tmp/$SITE.caddy
    sudo -n caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
      || { sudo -n caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; exit 1; }
    # validate (como root) puede crear los logs a nombre de root y romper el reload
    sudo -n mkdir -p /var/log/caddy && sudo -n chown -R caddy:caddy /var/log/caddy
    sudo -n systemctl enable --now caddy >/dev/null 2>&1
    sudo -n systemctl reload caddy
    echo \"--> Caddy: \$(systemctl is-active caddy)\""
  echo "==> Servidor listo. Si es la primera vez, ejecuta ./scripts/deploy.sh para subir la app."
}

cmd_deploy() {
  echo "==> Validando y compilando"
  npm run validate
  npm run build
  local rel tgz
  rel="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
  [ -z "$(git status --porcelain)" ] || rel="$rel-dirty"
  tgz="$(mktemp -t "$SITE-XXXXXX").tgz"
  tar -czf "$tgz" -C out .
  echo "==> Subiendo $rel a $HOST"
  scp -q "$tgz" "$HOST:/tmp/$SITE-$rel.tgz"
  rm -f "$tgz"
  remote "set -e
    sudo -n mkdir -p $BASE/releases/$rel
    sudo -n tar -xzf /tmp/$SITE-$rel.tgz -C $BASE/releases/$rel
    rm -f /tmp/$SITE-$rel.tgz
    sudo -n chmod -R a+rX $BASE/releases/$rel
    sudo -n ln -sfn $BASE/releases/$rel $BASE/current
    cd $BASE/releases && ls -1 | sort | head -n -$KEEP | xargs -r sudo -n rm -rf
    echo \"Activa: $rel\""
  check_url
}

cmd_rollback() {
  remote "set -e; cd $BASE/releases; cur=\$(basename \$(readlink -f $BASE/current))
    prev=\$(ls -1 | sort | grep -B1 -x \"\$cur\" | head -1)
    [ \"\$prev\" != \"\$cur\" ] || { echo 'No hay versión anterior'; exit 1; }
    sudo -n ln -sfn $BASE/releases/\$prev $BASE/current; echo \"Activa: \$prev\""
  check_url
}

cmd_status() {
  remote "echo \"Activa:    \$(basename \$(readlink -f $BASE/current))\"
    echo 'Guardadas:'; ls -1 $BASE/releases | sort | sed 's/^/  /'
    echo \"Caddy:     \$(systemctl is-active caddy)\""
  check_url
}

case "${1:-deploy}" in
  deploy) cmd_deploy ;;
  rollback) cmd_rollback ;;
  status) cmd_status ;;
  setup) cmd_setup ;;
  *) echo "Uso: $0 [deploy|rollback|status|setup]"; exit 1 ;;
esac
