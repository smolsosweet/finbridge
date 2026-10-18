'use client'

import { useEffect, useRef, useState } from 'react'

export const FINBRIDGE_REACTIONS = [
  'smile', 'curious', 'income', 'review', 'goal', 'saving', 'reminder', 'approval', 'joy',
] as const
export type FinBridgeReaction = typeof FINBRIDGE_REACTIONS[number]

type Props = {
  directions?: string
  reactions?: string
  size?: number
  label?: string
  className?: string
  /** Optional controlled expression, e.g. after a budgeting event. */
  reaction?: FinBridgeReaction | null
}

const CLOCKWISE = [5, 8, 7, 6, 3, 0, 1, 2]
const SECTOR = Math.PI / 4
const SQUASH: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.035,.965)', offset: .25 },
  { transform: 'scale(.985,1.015)', offset: .6 },
  { transform: 'scale(1)' },
]

/** Local adaptation of the MIT-licensed page-mascot interaction; see LICENSE. */
export function FinBridgeMascot({ directions = '/mascots/finbridge-penguin-directions.webp', reactions = '/mascots/finbridge-penguin-reactions.webp', size = 140,
  label = 'Chim cánh cụt FinBridge (Finn)', className, reaction = null }: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const sprite = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const count = useRef(0)
  const [direction, setDirection] = useState(4)
  const [clicked, setClicked] = useState<FinBridgeReaction | null>(null)
  const active = reaction ?? clicked

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let pointer: { x: number; y: number } | null = null
    let sector = -1
    const aim = () => {
      if (!pointer || !button.current) return
      const box = button.current.getBoundingClientRect()
      const dx = pointer.x - box.left - box.width / 2
      const dy = pointer.y - box.top - box.height / 2
      if (Math.hypot(dx, dy) < Math.max(28, size * .2)) {
        sector = -1; setDirection(4); return
      }
      const angle = Math.atan2(dy, dx)
      if (sector >= 0) {
        const diff = Math.atan2(Math.sin(angle - sector * SECTOR), Math.cos(angle - sector * SECTOR))
        if (Math.abs(diff) < SECTOR / 2 + .12) return
      }
      sector = (Math.round(angle / SECTOR) + 8) % 8
      setDirection(CLOCKWISE[sector])
    }
    const move = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; aim() }
    const reset = () => { pointer = null; sector = -1; setDirection(4) }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', aim, { passive: true })
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', aim)
      window.removeEventListener('blur', reset)
    }
  }, [size])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const boop = () => {
    if (timer.current) clearTimeout(timer.current)
    setClicked(FINBRIDGE_REACTIONS[count.current++ % 9])
    timer.current = setTimeout(() => setClicked(null), 1000)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sprite.current?.getAnimations().forEach(a => a.cancel())
      sprite.current?.animate(SQUASH, { duration: 320 })
    }
  }
  const index = active ? FINBRIDGE_REACTIONS.indexOf(active) : direction
  return (
    <button ref={button} type="button" onClick={boop} className={className}
      aria-label={label}
      style={{ display: 'block', width: size, height: size, padding: 0, border: 0,
        background: 'transparent', cursor: 'pointer', flexShrink: 0 }}>
      <span ref={sprite} aria-hidden="true" style={{ display: 'block', position: 'relative',
        width: '100%', height: '100%', transformOrigin: '50% 90%' }}>
        {[directions, reactions].map((url, n) => <span key={n} style={{ position: 'absolute', inset: 0,
          backgroundImage: `url("${url}")`, backgroundSize: '300% 300%', backgroundRepeat: 'no-repeat',
          backgroundPosition: `${index % 3 * 50}% ${Math.floor(index / 3) * 50}%`,
          opacity: Number(n === (active ? 1 : 0)) }} />)}
      </span>
    </button>
  )
}
