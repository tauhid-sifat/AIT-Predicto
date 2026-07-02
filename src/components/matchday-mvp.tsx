'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type MvpEntry = {
  user_id: string
  username: string
  points_gained: number
  correct_count: number
  exact_count: number
}

export default function MatchdayMvp({ mvps, matchday }: { mvps: MvpEntry[]; matchday?: string }) {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const total = mvps.length

  const next = useCallback(() => setCurrent((c) => (c + 1) % total), [total])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + total) % total), [total])

  useEffect(() => {
    if (total <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(next, 1500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [total, isPaused, next])

  const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = startX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev()
  }

  const dateLabel = matchday
    ? new Date(matchday + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : ''

  if (total === 0) return null

  const mvp = mvps[current]

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 sm:p-5 overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center gap-3">
        {/* Trophy */}
        <div className="text-3xl sm:text-4xl shrink-0">{'\u{1F3C6}'}</div>

        {/* Slide area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {mvps.map((m, i) => (
              <div key={m.user_id} className="w-full shrink-0">
                <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  {dateLabel ? `${dateLabel} Matchday MVP` : 'Matchday MVP'}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-bold text-gray-900 truncate">
                    {m.username}
                  </span>
                  <span className="text-sm font-semibold text-amber-600 whitespace-nowrap">
                    +{m.points_gained} pts
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>{m.correct_count} correct prediction{m.correct_count !== 1 ? 's' : ''}</span>
                  {m.exact_count > 0 && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>{m.exact_count} exact score{m.exact_count !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrows & dots - only show when multiple MVPs */}
        {total > 1 && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={prev}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-500 hover:text-gray-800 transition-colors text-xs shadow-sm border border-gray-200"
              aria-label="Previous"
            >
              {'\u276E'}
            </button>
            <div className="flex gap-1">
              {mvps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === current ? 'bg-amber-500 w-3' : 'bg-amber-200 hover:bg-amber-300'
                  }`}
                  aria-label={`Go to MVP ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-gray-500 hover:text-gray-800 transition-colors text-xs shadow-sm border border-gray-200"
              aria-label="Next"
            >
              {'\u276F'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
