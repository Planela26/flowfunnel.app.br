'use client'

import { useCallback, useEffect, useRef } from 'react'

/* ──────────────────────────────────────────────────────────────────────────
   Máquina de etapas do vídeo.

   O vídeo NÃO acompanha o scroll pixel a pixel. Ele fica parado num
   timestamp enquanto o usuário lê o bloco daquela etapa e, quando o scroll
   cruza o gatilho da etapa seguinte, faz UMA transição curta até o próximo
   timestamp e para de novo.

   Quem chama passa o progresso (0–1) do herói a cada frame — o mesmo valor
   que já anima os textos. Assim não há segundo listener de scroll nem
   dependência de estado React (nenhum re-render durante o scroll).
   ────────────────────────────────────────────────────────────────────────── */

export type VideoStage = {
  /** Onde o vídeo para, em segundos. */
  time: number
  /** Progresso do herói (0–1) que dispara a chegada nesta etapa. */
  enter: number
}

/** Estado real da cena — quem desenha o texto consulta isto, não o scroll. */
export type StageState = {
  /** Etapa em que o vídeo está (ou para onde está indo). */
  stage: number
  /** true enquanto a imagem se move. */
  transitioning: boolean
  /** performance.now() do instante em que a cena parou. */
  settledAt: number
}

type Options = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  stages: VideoStage[]
  debug?: boolean
}

/** Duração da transição conforme a distância entre timestamps.
 *  O trecho longo usa 1,4s de propósito: o salto de abertura (0→16s) exigiria
 *  ~14,5x em 1,1s, acima do teto de MAX_RATE, e o fim da transição cairia no
 *  seek de emergência. Com 1,4s a taxa fica em ~11,4x e o movimento é real. */
function transitionDuration(distance: number): number {
  const d = Math.abs(distance)
  if (d <= 3) return 0.45
  if (d <= 7) return 0.7
  if (d <= 12) return 0.9
  return 1.4
}

/** Deadband do gatilho: evita bater e voltar em cima do limite. */
const HYSTERESIS = 0.02
/** Tolerância para considerar que chegou no timestamp. */
const EPSILON = 0.05
/** Teto de velocidade que os navegadores aceitam com segurança. */
const MAX_RATE = 12
/** Tempo máximo do seek que fecha uma transição que ficou para trás. */
const TAIL = 0.28
/**
 * Acima desta distância a transição deixa de ser reprodução acelerada e passa
 * a ser varredura por seek. Motivo medido: o decodificador entrega ~6x tempo
 * real; pedir 11x num salto de 16s faz o vídeo andar até a metade e o resto
 * fechar de golpe. A varredura mantém passo constante do começo ao fim, e o
 * arquivo foi codificado com keyframe a cada 1s justamente para isso.
 */
const LONG_JUMP = 12

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

export function useVideoStages({ videoRef, stages, debug = false }: Options) {
  const stagesRef = useRef<VideoStage[]>(stages)
  const currentRef = useRef(0)
  const busyRef = useRef(false)
  const pendingRef = useRef<number | null>(null)
  const tokenRef = useRef(0)
  const rafRef = useRef(0)
  const readyRef = useRef(false)
  const runRef = useRef<(index: number) => void>(() => {})
  const stateRef = useRef<StageState>({
    stage: 0,
    transitioning: false,
    settledAt: 0,
  })

  const log = useCallback(
    (msg: string) => {
      if (debug) console.log(`[VIDEO STAGE] ${msg}`)
    },
    [debug],
  )

  /* ── Valida os timestamps contra a duração REAL do vídeo ─────────────── */
  const validate = useCallback(() => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      stagesRef.current = stages
      return
    }
    // Margem: parar exatamente em duration dispara `ended` e alguns
    // navegadores rebobinam sozinhos.
    const max = Math.max(0, video.duration - 0.08)
    stagesRef.current = stages.map((s, i) => {
      const time = Math.min(Math.max(0, s.time), max)
      if (debug && time !== s.time) {
        console.warn(
          `[VIDEO STAGE] etapa ${i}: ${s.time}s excede a duração real ` +
            `(${video.duration.toFixed(2)}s) — ajustado para ${time.toFixed(2)}s`,
        )
      }
      return { ...s, time }
    })
  }, [videoRef, stages, debug])

  /* ── Encerra a transição corrente e assenta o vídeo no ponto ─────────── */
  const settle = useCallback(
    (target: number, index: number) => {
      const video = videoRef.current
      if (!video) return
      video.pause()
      video.playbackRate = 1
      if (Math.abs(video.currentTime - target) > EPSILON) {
        video.currentTime = target
      }
      currentRef.current = index
      busyRef.current = false
      // A cena parou: só a partir daqui o texto da etapa pode entrar.
      stateRef.current = {
        stage: index,
        transitioning: false,
        settledAt: performance.now(),
      }
      log(`parado em ${target.toFixed(2)}s (etapa ${index})`)

      // Se o usuário passou por outras etapas durante a transição, resolve
      // agora — uma única vez, direto para a etapa realmente relevante.
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending !== null && pending !== index) {
        // Via ref: `run` só existe depois deste callback, e usá-lo por closure
        // deixaria uma versão presa ao primeiro render.
        runRef.current(pending)
      }
    },
    [videoRef, log],
  )

  /* ── Executa a transição até a etapa `index` ─────────────────────────── */
  const run = useCallback(
    (index: number) => {
      const video = videoRef.current
      const list = stagesRef.current
      if (!video || index < 0 || index >= list.length) return
      if (busyRef.current) {
        pendingRef.current = index
        return
      }

      const to = list[index].time
      const from = video.currentTime
      const dist = to - from

      if (Math.abs(dist) < EPSILON) {
        currentRef.current = index
        return
      }

      busyRef.current = true
      // A imagem vai se mexer — o texto tem de sair de cena AGORA.
      stateRef.current = {
        stage: index,
        transitioning: true,
        settledAt: 0,
      }
      const token = ++tokenRef.current
      const dur = transitionDuration(dist)
      log(
        `${currentRef.current} → ${index} · ${from.toFixed(2)}s → ${to.toFixed(2)}s · ${(dur * 1000) | 0}ms`,
      )

      cancelAnimationFrame(rafRef.current)

      if (dist > 0 && dist <= LONG_JUMP) {
        /* Avanço: deixa o vídeo REPRODUZIR acelerado. Decodificação linear é
           muito mais suave (e mais leve) do que reescrever currentTime a cada
           frame, que faz o navegador re-buscar o arquivo sem parar. */
        const rate = Math.min(MAX_RATE, Math.max(1, dist / dur))
        video.playbackRate = rate
        const t0 = performance.now()

        const watch = () => {
          if (token !== tokenRef.current) return
          const v = videoRef.current
          if (!v) return
          if (v.currentTime >= to - EPSILON) {
            settle(to, index)
            return
          }
          // Se o decodificador não acompanhou o playbackRate (arquivo pesado,
          // aparelho fraco), a transição NÃO pode se arrastar: cumprido o
          // tempo previsto, o trecho que falta é fechado por seek curto.
          if (performance.now() - t0 >= dur * 1000) {
            v.pause()
            v.playbackRate = 1
            scrub(v.currentTime, to, TAIL, token, index)
            return
          }
          rafRef.current = requestAnimationFrame(watch)
        }

        const started = video.play()
        if (started && typeof started.catch === 'function') {
          started.catch(() => {
            // Autoplay bloqueado (iOS com economia de bateria, etc.):
            // cai para o seek suave, que não exige permissão de reprodução.
            if (token !== tokenRef.current) return
            log('play() bloqueado — usando seek suave')
            scrub(from, to, dur, token, index)
          })
        }
        rafRef.current = requestAnimationFrame(watch)
      } else {
        /* Retorno (playbackRate não aceita valor negativo) e saltos longos:
           interpola currentTime com easing, o que dá passo constante em vez de
           acelerar e travar no fim. */
        video.pause()
        scrub(from, to, dur, token, index)
      }

      function scrub(
        a: number,
        b: number,
        seconds: number,
        tk: number,
        idx: number,
      ) {
        const t0 = performance.now()
        const step = () => {
          if (tk !== tokenRef.current) return
          const v = videoRef.current
          if (!v) return
          const t = Math.min(1, (performance.now() - t0) / (seconds * 1000))
          v.currentTime = a + (b - a) * easeInOut(t)
          if (t >= 1) {
            settle(b, idx)
            return
          }
          rafRef.current = requestAnimationFrame(step)
        }
        rafRef.current = requestAnimationFrame(step)
      }
    },
    [videoRef, log, settle],
  )

  runRef.current = run

  /* ── Inicialização: posiciona na primeira etapa ──────────────────────── */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const init = () => {
      validate()
      const first = stagesRef.current[0]
      if (!first) return
      readyRef.current = true
      video.pause()
      if (Math.abs(video.currentTime - first.time) > EPSILON) {
        video.currentTime = first.time
      }
      currentRef.current = 0
      stateRef.current = {
        stage: 0,
        transitioning: false,
        settledAt: performance.now(),
      }
      log(`pronto · duração real ${video.duration.toFixed(2)}s`)
    }

    // `loadedmetadata` pode ter disparado antes deste efeito rodar — por isso
    // checamos readyState em vez de confiar só no evento.
    if (video.readyState >= 1) init()
    video.addEventListener('loadedmetadata', init)

    return () => {
      video.removeEventListener('loadedmetadata', init)
      cancelAnimationFrame(rafRef.current)
      tokenRef.current++
    }
  }, [videoRef, validate, log])

  /* ── Chamado a cada frame pelo rAF do herói ──────────────────────────── */
  const onProgress = useCallback((p: number) => {
    if (!readyRef.current) return
    const list = stagesRef.current
    const cur = currentRef.current

    // Maior etapa cujo gatilho já foi cruzado. Descendo exige apenas cruzar o
    // gatilho; subindo exige folga extra, para não oscilar no limite.
    let desired = 0
    for (let i = 0; i < list.length; i++) {
      const enter = list[i].enter
      // A folga nunca pode engolir o gatilho inteiro: a etapa 1 entra logo no
      // primeiro toque do scroll (enter baixo), e uma histerese fixa levaria o
      // limiar de saída a zero — a etapa jamais seria liberada e voltar ao topo
      // deixaria o vídeo preso no primeiro texto.
      const slack = Math.min(HYSTERESIS, enter * 0.5)
      const threshold = i <= cur ? enter - slack : enter
      if (p >= threshold) desired = i
    }

    if (desired === cur) return
    if (busyRef.current) {
      pendingRef.current = desired
      return
    }
    runRef.current(desired)
  }, [])

  return { onProgress, stateRef }
}
