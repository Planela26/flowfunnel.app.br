# FlowSara para Windows

Uma janela para o app que roda em `flowsara.com.br`. **Não é uma cópia dele.**

## Por que não roda offline

Os webhooks de venda são **entregues** pela Hotmart, Kiwify e Meta num endereço
público. Um programa instalado na máquina de alguém não tem endereço público e
não tem como receber entrega nenhuma. O servidor continua sendo a fonte de
verdade — isto aqui é o cliente dele, e precisa de internet.

O que ele acrescenta sobre abrir no navegador: janela própria sem barra de
endereço, ícone na barra de tarefas e no menu Iniciar, e o app continua aberto
quando a pessoa fecha o navegador.

## Rodar em desenvolvimento

```bash
cd desktop
npm install
npm run dev
```

## ⚠️ Antes do primeiro build: Modo de Desenvolvedor

O `electron-builder` extrai um pacote de ferramentas de assinatura que contém
**links simbólicos do macOS**. Criar link simbólico no Windows exige privilégio
elevado — sem ele o build para com:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client.
       ...winCodeSign...darwin/10.12/lib/libcrypto.dylib
```

O app compila normalmente e sai em `dist/win-unpacked/FlowSara.exe`; o que falha
é só o empacotamento no instalador. Duas saídas:

**Opção A — Modo de Desenvolvedor** (uma vez só, recomendada):
Configurações do Windows → Sistema → Para desenvolvedores → ligar
**"Modo de Desenvolvedor"**. Ele libera criação de link simbólico sem elevar
cada comando.

**Opção B — terminal como Administrador:** abrir o PowerShell com "Executar
como administrador" e rodar o build a partir dele.

Depois que o cache é extraído uma vez, os builds seguintes não precisam mais
do privilégio.

## Gerar o instalador

```bash
cd desktop
npm install
npm run build
```

O `.exe` sai em `desktop/dist/`. O download fica em torno de 80–90 MB — é o
Chromium que vai embutido, e não tem como ser menor num app Electron.

Para uma versão sem instalação, que roda direto do arquivo:

```bash
npm run build:portable
```

## ⚠️ Assinatura de código

**Sem um certificado, o Windows vai mostrar "O Windows protegeu o computador"
na primeira execução**, com um botão "Mais informações → Executar assim mesmo"
escondido atrás de um clique. Uma parte dos usuários desiste ali.

Isso não é defeito do build: é o SmartScreen tratando todo executável não
assinado como desconhecido. Resolver exige comprar um certificado de assinatura
de código (Code Signing, tipicamente OV ou EV) de uma autoridade certificadora
— custa algumas centenas de dólares por ano.

Com o certificado em mãos, o `electron-builder` assina sozinho lendo estas
variáveis de ambiente:

```
CSC_LINK=caminho/para/certificado.pfx
CSC_KEY_PASSWORD=senha
```

Certificado EV dispensa a reputação inicial; o OV precisa acumular downloads
antes de o aviso sumir.

## O que este projeto NÃO faz ainda

- **Atualização automática.** Uma versão nova exige o usuário baixar de novo.
  O `electron-updater` resolve, mas precisa de um servidor publicando os
  arquivos de release.
- **Notificação nativa.** O `preload.js` está vazio de propósito; é por ali que
  entraria, uma função por vez.
- **macOS e Linux.** O build está configurado só para Windows. Adicionar os
  outros é mudar o `build.win` para incluir `mac` e `linux` — mas o macOS tem
  as próprias exigências de assinatura e notarização.
