import { useEffect, useRef } from 'react'

const SCROLL_KEY = (route: string) => `fin_scroll:${route}`

/**
 * Attach ref to a scroll container (e.g. <main className="page-shell">).
 * Saves scrollTop to sessionStorage on scroll (debounced) and on unmount.
 * Restores scrollTop on mount.
 */
export function useRouteScroll(routeKey: string) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el: HTMLElement | null = ref.current
    if (!el) return
    const scrollEl = el

    const saved = sessionStorage.getItem(SCROLL_KEY(routeKey))
    if (saved) {
      const top = parseInt(saved, 10)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollEl.scrollTo({ top, behavior: 'instant' as ScrollBehavior })
        })
      })
    }

    let timer: ReturnType<typeof setTimeout>
    function onScroll() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        sessionStorage.setItem(SCROLL_KEY(routeKey), String(scrollEl.scrollTop))
      }, 150)
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      scrollEl.removeEventListener('scroll', onScroll)
      sessionStorage.setItem(SCROLL_KEY(routeKey), String(scrollEl.scrollTop))
    }
  }, [routeKey])

  return ref
}
