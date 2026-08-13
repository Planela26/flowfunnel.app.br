'use client'

import { useEffect } from 'react'

/**
 * Revela os elementos marcados com `data-reveal` conforme eles entram na tela.
 *
 * Não renderiza nada: observa o documento e só alterna o atributo
 * `data-visible`. Assim os blocos continuam sendo server components e nenhum
 * wrapper extra entra no meio dos grids — o que quebraria seletores como
 * `lg:[&>*:first-child]:order-2` do tour.
 *
 * O estado inicial (invisível) e a transição vivem no <style> de
 * LandingSections, mesma convenção da marquee de integrações.
 */
export default function RevealOnScroll() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (nodes.length === 0) return

    const showAll = () => nodes.forEach((n) => n.setAttribute('data-visible', ''))

    // Movimento reduzido ou navegador sem suporte: mostra tudo, sem animar.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      showAll()
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-visible', '')
          io.unobserve(entry.target) // anima uma vez só; não repete ao subir
        }
      },
      // threshold 0 + margem inferior: dispara quando o elemento cruza ~12%
      // acima da borda de baixo. Funciona igual para um <li> e para uma
      // captura mais alta que a viewport.
      { threshold: 0, rootMargin: '0px 0px -12% 0px' },
    )

    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  return null
}
