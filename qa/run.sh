#!/usr/bin/env bash
# Uso (na pasta do projeto, depois de "pnpm install"):  bash qa/run.sh
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --no-audit --no-fund
ESB=$(ls -d ../node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild | head -1)
echo "== Cálculo e validações =="
$ESB pricing.test.ts --bundle --platform=node --format=esm --outfile=.pricing.test.mjs --log-level=error
node .pricing.test.mjs
echo; echo "== Fluxo completo do app (jsdom) =="
$ESB smoke.tsx --bundle --platform=node --format=esm --outfile=.smoke.mjs --external:jsdom --jsx=automatic \
  --alias:react=../node_modules/react --alias:react-dom=../node_modules/react-dom --log-level=error \
  --banner:js="import {createRequire} from 'module';const require=createRequire(import.meta.url);"
node .smoke.mjs 2>&1 | grep -E "^(OK|FALHOU|ERRO|Tudo|[0-9]+ FALHA)"
