'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Prediction = {
  id?: string
  predicted_home_score: number | null
  predicted_away_score: number | null
  predicted_winner: string
  points?: number
} | null

export default function PredictionForm({
  matchId,
  homeTeam,
  awayTeam,
  currentPrediction,
  onPredictionSaved,
  kickoffTime,
}: {
  matchId: number
  homeTeam: string
  awayTeam: string
  currentPrediction: Prediction
  onPredictionSaved: (p: Prediction) => void
  kickoffTime: string
}) {
  const [winner, setWinner] = useState<string>(
    currentPrediction?.predicted_winner ?? ''
  )
  const [scoreA, setScoreA] = useState(
    currentPrediction?.predicted_home_score?.toString() ?? ''
  )
  const [scoreB, setScoreB] = useState(
    currentPrediction?.predicted_away_score?.toString() ?? ''
  )
  const [showScores, setShowScores] = useState(
    currentPrediction?.predicted_home_score !== null &&
    currentPrediction?.predicted_home_score !== undefined
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const isLocked = new Date(kickoffTime) <= new Date()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!winner) {
      setError('Select who will win')
      return
    }

    let a: number | null = null
    let b: number | null = null
    if (showScores) {
      a = parseInt(scoreA, 10)
      b = parseInt(scoreB, 10)
      if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
        setError('Enter valid scores (0 or more)')
        return
      }
      const predictedOutcome = a > b ? 'home' : a < b ? 'away' : 'draw'
      if (predictedOutcome !== winner) {
        setError('Scores must match your winner pick')
        return
      }
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be signed in')
      setSaving(false)
      return
    }

    const { error: upsertError } = await supabase.from('predictions').upsert(
      {
        user_id: user.id,
        match_id: matchId,
        predicted_home_score: a,
        predicted_away_score: b,
        predicted_winner: winner,
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
      predicted_winner: winner,
    })
  }

  if (isLocked) {
    return (
      <div className="text-center py-2">
        <span className="inline-block bg-gray-100 text-gray-400 text-xs px-3 py-1.5 rounded-full">
          Predictions closed
        </span>
      </div>
    )
  }

  const options = [
    { value: 'home', label: homeTeam },
    { value: 'draw', label: 'Draw' },
    { value: 'away', label: awayTeam },
  ]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setWinner(opt.value); setError('') }}
            className={`text-xs font-medium py-2 px-1 rounded-lg border transition-all ${
              winner === opt.value
                ? opt.value === 'draw'
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => setShowScores(!showScores)}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors ${
            showScores
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {showScores ? '– Bonus scores' : '+ Bonus scores'}
        </button>
      </div>

      {showScores && (
        <div className="flex items-center justify-center gap-2 mt-1">
          <input
            type="number"
            min="0"
            max="99"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
            className="w-14 text-center border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-bold tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="0"
          />
          <span className="text-gray-400 font-bold text-sm">–</span>
          <input
            type="number"
            min="0"
            max="99"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
            className="w-14 text-center border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-bold tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="0"
          />
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-1">
        <button
          type="submit"
          disabled={saving || !winner}
          className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white'
          }`}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : currentPrediction ? 'Update' : 'Predict'}
        </button>
      </div>

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}

      <div className="text-[10px] text-gray-400 text-center mt-0.5">
        3 pts correct winner &middot; +2 pts exact score
      </div>
    </form>
  )
}
