# Frames da landing por scroll

Sequência de imagens que o `ScrollVideoHero` desenha no canvas conforme o scroll
da home. São **200 frames** (`frame_0001.jpg` … `frame_0200.jpg`, ~16 MB no total),
extraídos de um vídeo de 48 s em 2560×1440.

## Como regerar (quando o vídeo mudar)

Não usamos ffmpeg — a extração roda no próprio navegador, sem instalar nada:

1. Aponte o caminho do vídeo em `assets-edit/extract-server.js` (rota `/video.mp4`).
2. Ajuste os parâmetros no topo de `assets-edit/extract.html`:
   - `FRAMES` — quantidade de frames (200 é o padrão)
   - `WIDTH` — largura de saída (1440)
   - `QUALITY` — qualidade JPEG (0.72)
   - `START` — corta o início do vídeo em segundos (hoje `1.0`)
3. Rode o servidor e abra a página; ela salva os frames direto nesta pasta:

```bash
node assets-edit/extract-server.js
```

Depois abra <http://localhost:4600/extract.html> e aguarde chegar em 200/200.

## Se mudar a quantidade de frames

Atualize `frameCount` no `<ScrollVideoHero>` em `app/page.tsx`.

## Se mudar o vídeo

As faixas de progresso de cada bloco de texto (`ACTS` em `app/page.tsx`) foram
calculadas a partir da posição do monitor em cada frame — o texto fica sempre no
lado oposto ao monitor. Ao trocar o vídeo, rode a análise de novo:

```bash
node assets-edit/analyze-position.js
```

Ela imprime, a cada 4 frames, o centro horizontal da tela detectada e se o monitor
está à esquerda, à direita ou centralizado. Use isso para redefinir `at` e `side`.

## Peso

~16 MB. O componente pré-carrega com concorrência de 8 e libera a página após os
primeiros 24 frames, então a home é utilizável antes do download terminar. Se
precisar reduzir: menos frames ou converter para WebP.
