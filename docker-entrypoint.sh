#!/bin/sh
set -eu

# Genera /usr/share/nginx/html/env.js a partir de las variables del contenedor
# (inyectadas por el host en runtime, p. ej. Render). La app la lee en el navegador
# a traves de window.VERDU_ENV antes de cargar el bundle de Vite.
ENV_FILE=/usr/share/nginx/html/env.js
cat > "$ENV_FILE" <<EOF
window.VERDU_ENV = {
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY:-}"
};
EOF

exec nginx -g "daemon off;"