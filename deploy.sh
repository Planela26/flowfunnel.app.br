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

echo "✅ Pronto! A Hostinger vai fazer o deploy automaticamente."
