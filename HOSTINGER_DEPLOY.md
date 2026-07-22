# Deploy na Hostinger - FlowFunnel

> Guia para subir o projeto na Hostinger usando GitHub + VPS/Node.js.

---

## 1. Requisitos na Hostinger

Recomendado: **VPS com Node.js** ou plano que suporte Node.js.

- Node.js 20+
- npm 10+
- PostgreSQL (Supabase, Neon, ou Hostinger MySQL convertido)
- Git instalado no servidor

---

## 2. Configurar deploy automático GitHub → Hostinger

### Na Hostinger:

1. Vá em **Websites → Gerenciar** no seu site
2. Procure por **Git** ou **Deploy from GitHub**
3. Conecte sua conta GitHub
4. Selecione o repositório: `Planela26/flowfunnel.app.br`
5. Selecione a branch: `main`
6. Configure o **webhook** para deploy automático (se disponível)

### Se não tiver deploy automático:

Use SSH no terminal da Hostinger e rode:

```bash
cd ~/public_html  # ou pasta do projeto
rm -rf * .[!.]*
git clone https://github.com/Planela26/flowfunnel.app.br.git .
```

---

## 3. Instalar dependências e fazer build

No terminal da Hostinger (ou via SSH):

```bash
cd ~/public_html  # ou pasta do projeto
npm install
npm run build
```

Se der erro de falta de memória na Hostinger, use:

```bash
NODE_OPTIONS="--max-old-space-size=1024" npm run build
```

---

## 4. Iniciar o servidor

### Opção A — PM2 (recomendado)

```bash
npm install -g pm2
pm2 start npm --name "flowfunnel" -- start
pm2 save
pm2 startup
```

### Opção B — node direto

```bash
npm start
```

O `npm start` roda:

```bash
next start -p 5000 -H 0.0.0.0
```

Se a Hostinger exigir porta 3000, altere no `package.json` ou use variável `PORT`:

```bash
PORT=3000 npm start
```

---

## 5. Configurar proxy reverso (Nginx)

Se estiver usando VPS, adicione no Nginx:

```nginx
server {
    listen 80;
    server_name flowfunnel.app.br www.flowfunnel.app.br;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Depois:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. SSL/HTTPS

Use Let's Encrypt via Certbot:

```bash
sudo certbot --nginx -d flowfunnel.app.br -d www.flowfunnel.app.br
```

---

## 7. Variáveis de ambiente

Na Hostinger, configure todas as variáveis do arquivo `.envi`:

- `DATABASE_URL` (Supabase)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `STRIPE_*`
- `MERCADOPAGO_*`
- `GOOGLE_*`
- etc.

Para Supabase, o `DATABASE_URL` deve ter este formato:

```bash
postgresql://postgres:PASSWORD@HOST.supabase.co:5432/postgres?pgbouncer=true&sslmode=require
```

---

## 8. Banco de dados (Supabase)

### 8.1. Criar projeto no Supabase

1. Acesse https://supabase.com
2. Crie um novo projeto
3. Vá em **Settings → Database**
4. Copie a **Connection string** (modo Transaction Pooler ou Session)

### 8.2. Aplicar o schema

No SQL Editor do Supabase, execute o conteúdo do arquivo gerado por:

```bash
npx prisma migrate deploy
```

Ou, se preferir, use `prisma db push` (somente para setup inicial):

```bash
npx prisma db push
```

### 8.3. Ajustar o `schema.prisma` para Supabase (se necessário)

Adicione a diretiva de shadow database no `schema.prisma`:

```prisma
datasource db {
  provider     = "postgresql"
  url          = env("DATABASE_URL")
  directUrl    = env("DIRECT_DATABASE_URL")  // connection string sem pgbouncer
}
```

E configure:

```bash
DATABASE_URL="postgresql://...?pgbouncer=true&sslmode=require"
DIRECT_DATABASE_URL="postgresql://...?sslmode=require"
```

---

## 9. Comandos úteis

```bash
# Ver logs
pm2 logs flowfunnel

# Reiniciar
pm2 restart flowfunnel

# Atualizar após push no GitHub
cd ~/public_html
git pull origin main
npm install
npm run build
pm2 restart flowfunnel
```

---

## 10. Fluxo de trabalho recomendado

1. Edite no Replit
2. Teste localmente: `npm run dev`
3. Faça push: `git push origin main`
4. Hostinger faz deploy automático (ou rode `git pull` manualmente)
5. Rode `npm run build` e `pm2 restart flowfunnel` se necessário

---

## 11. Problemas comuns

| Problema | Solução |
|---|---|
| Porta 5000 já em uso | Mude `PORT=3000` ou mate o processo antigo |
| Build falha por memória | Use `NODE_OPTIONS=--max-old-space-size=1024` |
| Cannot find module | Rode `npm install` novamente |
| Banco não conecta | Verifique SSL e `pgbouncer=true` no Supabase |
| Middleware deprecated | Apenas warning, não impede o build |

---

Gerado em: 22/07/2026
