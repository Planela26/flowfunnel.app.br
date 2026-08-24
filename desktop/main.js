'use strict'

/**
 * FlowSara para Windows.
 *
 * É uma JANELA para o app que já roda em flowsara.com.br — não uma cópia dele.
 *
 * Por que não embutir o servidor aqui: os webhooks de venda são ENTREGUES pela
 * Hotmart, Kiwify e Meta num endereço público. Um programa instalado na máquina
 * de alguém não tem endereço público e não tem como receber entrega nenhuma.
 * O servidor continua sendo a fonte de verdade; isto aqui é o cliente dele.
 *
 * O que o programa acrescenta sobre abrir no navegador: janela própria sem
 * barra de endereço, ícone na barra de tarefas, e o app continua aberto quando
 * a pessoa fecha o navegador.
 */

const { app, BrowserWindow, shell, Menu, dialog } = require('electron')
const path = require('node:path')

const ENDERECO = 'https://flowsara.com.br'
const HOST_PERMITIDO = 'flowsara.com.br'

/** Guardado para o `activate` do macOS e para o segundo-processo do Windows. */
let janela = null

/**
 * Só o próprio domínio abre DENTRO da janela.
 *
 * Sem esta regra, clicar num link para a Hotmart, o Meta ou o suporte
 * navegaria a janela do app para fora, e a pessoa ficaria presa num site de
 * terceiro sem barra de endereço nem botão de voltar visível. Pior: uma tela
 * de login de outro serviço apareceria dentro de algo que parece ser o
 * FlowSara, que é exatamente o formato de um golpe.
 */
function ehDoApp(url) {
  try {
    return new URL(url).hostname === HOST_PERMITIDO
  } catch {
    return false
  }
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false, // evita o flash branco; aparece em 'ready-to-show'
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'icone.ico'),
    title: 'FlowSara',
    webPreferences: {
      // O conteúdo vem da web, então vale o mesmo isolamento de um navegador.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  janela.once('ready-to-show', () => janela.show())

  // Link externo vai para o navegador padrão, não para dentro da janela.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (!ehDoApp(url)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  janela.webContents.on('will-navigate', (evento, url) => {
    if (!ehDoApp(url)) {
      evento.preventDefault()
      shell.openExternal(url)
    }
  })

  // Sem internet o Electron mostra uma página de erro do Chromium, em inglês e
  // sem contexto. Uma mensagem própria evita que pareça defeito do programa.
  janela.webContents.on('did-fail-load', (_e, codigo, descricao, urlQueFalhou) => {
    // -3 é ABORTED: acontece em redirecionamento normal, não é falha.
    if (codigo === -3) return
    dialog.showMessageBox(janela, {
      type: 'warning',
      title: 'Sem conexão',
      message: 'Não foi possível carregar o FlowSara.',
      detail:
        `Verifique sua conexão com a internet e tente de novo.\n\n` +
        `Detalhe técnico: ${descricao} (${codigo})\n${urlQueFalhou}`,
      buttons: ['Tentar de novo', 'Fechar'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) janela.loadURL(ENDERECO)
    })
  })

  janela.on('closed', () => { janela = null })

  janela.loadURL(ENDERECO)
}

/**
 * Menu enxuto, em português.
 *
 * O menu padrão do Electron vem em inglês e com itens de desenvolvimento
 * expostos ao usuário final. Recarregar e zoom ficam porque resolvem os dois
 * problemas mais comuns de quem usa: tela travada e fonte pequena.
 */
function montarMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: () => janela?.reload() },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { label: 'Aumentar zoom', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Diminuir zoom', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Zoom normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tela cheia', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
  ]))
}

// Uma instância só. Sem isto, clicar no atalho com o app aberto abre uma
// segunda janela, e a pessoa fica com duas cópias e sessões concorrentes.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore()
      janela.focus()
    }
  })

  app.whenReady().then(() => {
    montarMenu()
    criarJanela()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) criarJanela()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
