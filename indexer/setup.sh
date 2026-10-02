#!/bin/bash
# One-time setup for wisp-indexer on your Cloudflare account. Run from wisp/indexer.
#   1. opens a browser to log in to Cloudflare (your account, free plan is enough)
#   2. creates the D1 database and writes its id into wrangler.toml
#   3. applies the schema and deploys the worker
set -euo pipefail
cd "$(dirname "$0")"

npm install --no-audit --no-fund
npx wrangler login

if grep -q "REPLACE_WITH_DATABASE_ID" wrangler.toml; then
  OUT=$(npx wrangler d1 create wisp-index 2>&1 || true)
  ID=$(printf '%s' "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  if [ -z "$ID" ]; then
    ID=$(npx wrangler d1 list --json | node -e 'const l=JSON.parse(require("fs").readFileSync(0,"utf8"));const d=l.find(x=>x.name==="wisp-index");if(d)process.stdout.write(d.uuid)')
  fi
  [ -n "$ID" ] || { echo "Could not determine the D1 database id. Output was:"; echo "$OUT"; exit 1; }
  sed -i.bak "s/REPLACE_WITH_DATABASE_ID/$ID/" wrangler.toml && rm -f wrangler.toml.bak
  echo "D1 database id: $ID"
fi

npx wrangler d1 execute wisp-index --remote --file=schema.sql
npx wrangler deploy | tee /tmp/wisp-indexer-deploy.log
URL=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' /tmp/wisp-indexer-deploy.log | head -1)
echo
echo "Deployed: ${URL:-see output above}"
echo "Next: add WISP_INDEXER_URL=${URL:-<worker url>} to the Wisp project's environment variables on Vercel."
