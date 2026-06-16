'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Prediction = {
  id?: string
  predicted_home_score: number
  predicted_away_score: number
  points?: number
} | null

const QUICK_PICKS = [0, 1, 2, 3]

export default function PredictionForm({
  matchId,
  currentPrediction,
  onPredictionSaved,
  kickoffTime,
}: {
  matchId: number
  currentPrediction: Prediction
  onPredictionSaved: (p: Prediction) => void
  kickoffTime: string
}) {
  const [scoreA, setScoreA] = useState(
    currentPrediction?.predicted_home_score?.toString() ?? ''
  )
  const [scoreB, setScoreB] = useState(
    currentPrediction?.predicted_away_score?.toString() ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const isLocked = new Date(kickoffTime) <= new Date()

  const handleQuickPick = (side: 'a' | 'b', val: number) => {
    if (side === 'a') setScoreA(val.toString())
    else setScoreB(val.toString())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const a = parseInt(scoreA, 10)
    const b = parseInt(scoreB, 10)

    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      setError('Enter valid scores (0 or more)')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in')
      setSaving(false)
      return
    }

    const predicted_winner = a > b ? 'home' : a < b ? 'away' : 'draw'

    const { error: upsertError } = await supabase.from('predictions').upsert(
      {
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: a,
        predicted_away_score: b,
        predicted_winner,
      },
      { onConflict: 'user_id, match_id', ignoreDuplicates: false }
    )

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    onPredictionSaved({
      id: currentPrediction?.id,
      predicted_home_score: a,
      predicted_away_score: b,
    })
  }

  if (isLocked) {
    return (
      <div className="text-center py-2">
        <span className="inline-block bg-gray-100 text-gray-400 text-xs px-3 py-1.5 rounded-full">
          Predictions closed before kickoff
        </span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <input
            type="number"
            min="0"
            max="99"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className="w-16 text-center border border-gray-300 rounded-lg px-2 py-2 text-base font-bold tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            placeholder="0"
            required
          />
          <div className="flex gap-1">
            {QUICK_PICKS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleQuickPick('a', n)}
                className={`w-7 h-6 text-xs rounded font-medium transition-colors ${
                  scoreA === n.toString()
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <span className="text-gray-400 font-bold text-lg">&ndash;</span>

        <div className="flex flex-col items-center gap-1">
          <input
            type="number"
            min="0"
            max="99"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className="w-16 text-center border border-gray-300 rounded-lg px-2 py-2 text-base font-bold tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
            placeholder="0"
            required
          />
          <div className="flex gap-1">
            {QUICK_PICKS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleQuickPick('b', n)}
                className={`w-7 h-6 text-xs rounded font-medium transition-colors ${
                  scoreB === n.toString()
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className={`text-sm px-5 py-1.5 rounded-lg font-medium transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white'
          }`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : currentPrediction ? 'Update' : 'Predict'}
        </button>
      </div>

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}
    </form>
  )
}
