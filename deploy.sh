#!/bin/bash
# deploy.sh - Envia mudanças para GitHub e Hostinger
# Uso: bash deploy.sh "mensagem do commit"

if [ -z "$1" ]; then
  echo "❌ Você precisa informar uma mensagem de commit."
  echo "Uso: bash deploy.sh \"mensagem do commit\""
  exit 1
fi

echo "📦 Adicionando arquivos..."
git add .

echo "💬 Commitando: $1"
git commit -m "$1"

echo "🚀 Enviando para GitHub..."
git push origin main

# Este script NÃO faz deploy — ele publica o código no GitHub, e só.
#
# A linha que existia aqui antes dizia "A Hostinger vai fazer o deploy
# automaticamente". Não faz: produção é um Next.js sob PM2 num VPS, e push
# nenhum reconstrói o `.next`. Dois commits ficaram 20 horas no GitHub sem
# chegar no ar porque a mensagem deu a entender que o trabalho tinha acabado.
cat <<'AVISO'

✅ Código no GitHub.

⚠️  ISSO AINDA NÃO ESTÁ NO AR. Falta buildar no servidor:

    ssh <seu-usuario>@<seu-host>
    cd ~/public_html && git pull origin main && npm install && npm run build

    (sem memória? prefixe NODE_OPTIONS="--max-old-space-size=1024")

O build encadeia o resto: prisma generate → migrations em PRODUÇÃO →
next build, e o postbuild reinicia o PM2 sozinho.

Confirmar que subiu — o hash tem que MUDAR:

    curl -s "https://flowsara.com.br/login?cb=$RANDOM" | grep -oE 'webpack-[a-f0-9]+\.js'

AVISO
