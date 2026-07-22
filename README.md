# FlowFunnel - SaaS de Rastreamento de Funil de Vendas

Plataforma completa para rastrear e otimizar funis de vendas no WhatsApp, do anúncio até o pagamento.

## 🚀 Visão Geral

Uma ferramenta web (SaaS) que mostra, de forma simples e visual, todo o funil de vendas no WhatsApp. Permite que produtores e gestores de tráfego identifiquem gargalos e saibam exatamente onde estão perdendo vendas.

## ✨ Funcionalidades

- 📊 **Funil Visual Completo** - Visualize cada etapa do anúncio até a venda
- 📈 **Dashboard Interativo** - Gráficos e métricas em tempo real
- 🔗 **Integrações Nativas**:
  - Meta/Facebook Ads
  - WhatsApp Cloud API
  - Hotmart
  - Kiwify
  - Eduzz (em breve)
  - Monetizze (em breve)
- 🎯 **Dois Modos de Visualização**:
  - Modo Produtor (foco em resultados)
  - Modo Gestor (foco em otimização)
- ⚠️ **Alertas Inteligentes** - Identifique gargalos automaticamente
- 📱 **Responsivo** - Acesse de qualquer dispositivo

## 🛠️ Stack Tecnológica

- **Frontend**: Next.js 14 + React + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (OAuth + Credenciais)
- **Charts**: Recharts
- **Icons**: Lucide React

## 📦 Instalação

1. **Clone o repositório** (ou você já está nesta pasta)

2. **Instale as dependências**:
```bash
npm install
```

3. **Configure as variáveis de ambiente**:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure:
- `DATABASE_URL` - URL do PostgreSQL
- `NEXTAUTH_SECRET` - Chave secreta (gere com: `openssl rand -base64 32`)
- Credenciais das APIs (Meta, WhatsApp, Hotmart, etc.)

4. **Configure o banco de dados**:
```bash
npm run db:push
```

5. **Inicie o servidor de desenvolvimento**:
```bash
npm run dev
```

Acesse: http://localhost:3000

## 📁 Estrutura do Projeto

```
whatsapp-funnel-saas/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   │   ├── auth/           # Autenticação
│   │   ├── funnel/         # Gerenciamento de funis
│   │   └── integrations/   # Integrações (Meta, WhatsApp, etc.)
│   ├── dashboard/          # Dashboard principal
│   ├── globals.css         # Estilos globais
│   ├── layout.tsx          # Layout principal
│   └── page.tsx            # Landing page
├── lib/                     # Bibliotecas e configurações
│   ├── auth.ts             # Configuração NextAuth
│   └── prisma.ts           # Cliente Prisma
├── prisma/                  # Schema do banco de dados
│   └── schema.prisma
├── .env.example            # Exemplo de variáveis de ambiente
├── package.json
└── README.md
```

## 🔐 Autenticação

O sistema suporta:
- Login com email/senha
- OAuth com Google
- OAuth com Meta (Facebook)

## 🔗 Integrações

### Meta Ads
Conecte via OAuth para rastrear cliques e custos dos anúncios.

### WhatsApp Cloud API
Rastreie mensagens, conversas e qualificação de leads.

### Plataformas de Pagamento
- **Hotmart** - Webhooks para vendas
- **Kiwify** - API de vendas
- **Eduzz** (fase 2)
- **Monetizze** (fase 2)

## 💰 Planos

- **Lançamento**: R$ 97 (30 dias)
- **Profissional**: R$ 97/mês
- **Agência**: R$ 197/mês
- **Fundador**: R$ 297 vitalício (lançamento)

## 🚀 Deploy

### Vercel (Recomendado)

1. Conecte seu repositório no Vercel
2. Configure as variáveis de ambiente
3. Deploy automático!

### Outras Plataformas

- Railway
- Render
- DigitalOcean App Platform

## 📝 Próximos Passos

- [ ] Implementar OAuth completo do Meta
- [ ] Conectar WhatsApp Cloud API
- [ ] Integrar webhooks do Hotmart
- [ ] Adicionar sistema de alertas
- [ ] Criar página de configurações
- [ ] Implementar sistema de assinaturas
- [ ] Adicionar comparação entre lançamentos
- [ ] Criar página de termos e LGPD

## 🛡️ Segurança e Privacidade

- Todas as senhas são hasheadas com bcrypt
- OAuth para integrações (sem armazenar senhas)
- Compliance com LGPD
- Dados criptografados em trânsito

## 📄 Licença

Propriedade privada. Todos os direitos reservados.

## 🤝 Suporte

Para dúvidas e suporte, entre em contato através do sistema.

---

Desenvolvido com 💚 usando Next.js e WhatsApp
