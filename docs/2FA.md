# Verificação em Duas Etapas (2FA / TOTP)

O FlowFunnel suporta autenticação em duas etapas (2FA) usando códigos TOTP
(Time-based One-Time Password, RFC 6238) — o mesmo padrão usado por bancos e
grandes serviços. É compatível com:

- **Google Authenticator** (Android / iOS)
- **Microsoft Authenticator**
- **Authy**
- Qualquer app que leia QR Codes `otpauth://`

## Por que ativar?

Mesmo que alguém descubra sua senha, não conseguirá entrar sem o código
temporário gerado no seu celular. Para contas **administradoras (ADMIN/OWNER)** o
2FA é **obrigatório**.

## Como ativar (passo a passo)

1. Acesse **Minha conta → Segurança e 2FA** (ou vá direto em `/settings/security`).
2. Clique em **Ativar 2FA**.
3. Abra o app autenticador no celular (ex.: Google Authenticator).
4. Toque em **“+” → Ler QR Code** e aponte a câmera para o QR exibido na tela.
   - Não consegue escanear? Use a opção **“Inserir chave de configuração”** e
     digite o código (secret) mostrado abaixo do QR.
5. O app passará a exibir um **código de 6 dígitos** que muda a cada 30 segundos.
6. Digite o código atual no campo **“Código de 6 dígitos”** e clique em
   **Ativar 2FA**.
7. **Guarde os 10 códigos de recuperação** exibidos — baixe o arquivo ou anote em
   local seguro. Eles **não serão mostrados novamente**.

## Login com 2FA

1. Informe email e senha normalmente.
2. Na etapa seguinte, digite o código de 6 dígitos do app autenticador.
3. Pronto — você está dentro.

### Perdi o celular / app autenticador

Na tela do código, clique em **“Usar código de recuperação”** e informe um dos 10
códigos salvos na ativação. **Cada código de recuperação só funciona uma vez.**

Depois de entrar, vá em **Segurança** e gere novos códigos (e/ou reconfigure o
2FA em um novo aparelho).

## Gerenciar 2FA

Na página **Segurança** você pode:

- **Gerar novos códigos de recuperação** — invalida os antigos. Exige senha.
- **Desativar o 2FA** — exige confirmação de senha. *(Indisponível para contas
  administradoras, onde o 2FA é obrigatório.)*

## Segurança / Detalhes técnicos

- O **secret TOTP** é armazenado **criptografado** (AES-256-GCM) e **nunca** é
  reenviado ao frontend após a configuração inicial.
- Os **códigos de recuperação** são guardados apenas como **hash SHA-256**; o
  texto puro só aparece uma vez, no momento da geração.
- **Rate limit + bloqueio temporário**: até 5 tentativas de código por usuário a
  cada 5 minutos no login (evita força bruta).
- **Janela de tolerância** de ±30s para compensar diferença de relógio entre o
  servidor e o celular.
- **Trilha de auditoria**: ativação, desativação, uso de código de recuperação,
  regeneração de códigos e falhas de verificação são registrados em `AuditLog`
  (ações `auth.2fa.*`).
- Parâmetros TOTP: **SHA-1, 6 dígitos, passo de 30s** (padrão compatível com
  todos os apps autenticadores).
