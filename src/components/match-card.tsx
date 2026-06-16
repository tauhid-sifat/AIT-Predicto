'use client'

import { useState } from 'react'
import PredictionForm from './prediction-form'
import { getFlagUrl, getFlagSrcset } from '@/lib/team-flags'

type Match = {
  id: number
  kickoff_time: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string
}

type Prediction = {
  id?: string
  predicted_home_score: number | null
  predicted_away_score: number | null
  predicted_winner: string
  points?: number
} | null

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        Live
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="inline-block bg-gray-200 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider">
        Finished
      </span>
    )
  }
  return (
    <span className="inline-block bg-blue-100 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider">
      Scheduled
    </span>
  )
}

function TeamName({ name }: { name: string }) {
  const flag = getFlagUrl(name)
  const srcset = getFlagSrcset(name)
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag && (
        <img
          src={flag}
          srcSet={srcset}
          alt=""
          className="w-4 h-3 inline-block rounded-sm object-cover"
          loading="lazy"
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  )
}

function PredictionSummary({
  prediction,
  match,
}: {
  prediction: NonNullable<Prediction>
  match: Match
}) {
  const points = prediction.points ?? 0
  const isCorrect = points > 0
  const hasScores =
    prediction.predicted_home_score !== null && prediction.predicted_away_score !== null

  const winnerLabel =
    prediction.predicted_winner === 'home'
      ? match.home_team
      : prediction.predicted_winner === 'away'
      ? match.away_team
      : 'Draw'

  if (match.status !== 'finished') {
    return (
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="text-xs text-gray-500 text-center">
          Your pick: {winnerLabel}
          {hasScores && (
            <> &middot; {prediction.predicted_home_score}–{prediction.predicted_away_score}</>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`mt-2 pt-2 border-t text-sm ${
        isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
      } rounded-b -mx-4 -mb-4 px-4 pb-4`}
    >
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs">Your pick:</span>
        <span className="font-medium text-xs">
          {winnerLabel}
          {hasScores && <> ({prediction.predicted_home_score}–{prediction.predicted_away_score})</>}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </span>
        <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
          {isCorrect ? `+${points}` : '0'} pts
        </span>
      </div>
    </div>
  )
}

export default function MatchCard({
  match,
  prediction,
  userId,
  isHot,
}: {
  match: Match
  prediction: Prediction
  userId?: string
  isHot?: boolean
}) {
  const [currentPrediction, setCurrentPrediction] = useState(prediction)
  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'
  const matchDate = new Date(match.kickoff_time)

  const formatBD = (d: Date) =>
    d.toLocaleString('en-BD', {
      timeZone: 'Asia/Dhaka',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

  const now = new Date()
  const isPast = matchDate <= now

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border p-4 transition-shadow hover:shadow-md ${
        isLive
          ? 'border-red-300 ring-1 ring-red-200'
          : isFinished && currentPrediction && (currentPrediction.points ?? 0) > 0
          ? 'border-green-200'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <StatusBadge status={match.status} />
        {isHot && !isFinished && (
          <span className="text-[10px] font-semibold text-orange-600 flex items-center gap-0.5">
            <span>&#x1F525;</span> Hot
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 text-right min-w-0">
          <span className="text-sm sm:text-base font-bold text-gray-900 block truncate">
            <TeamName name={match.home_team} />
          </span>
        </div>

        <div className="flex-shrink-0 text-center min-w-[72px]">
          {isFinished || (isLive && match.home_score !== null) ? (
            <div className="text-xl sm:text-2xl font-extrabold text-gray-900 tabular-nums tracking-tight leading-none">
              {match.home_score ?? '?'} &ndash; {match.away_score ?? '?'}
            </div>
          ) : (
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider">VS</div>
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <span className="text-sm sm:text-base font-bold text-gray-900 block truncate">
            <TeamName name={match.away_team} />
          </span>
        </div>
      </div>

      {!isFinished && (
        <div className="text-xs text-gray-400 text-center mt-1.5">
          {isLive ? (
            <span className="text-red-500 font-medium">In Progress</span>
          ) : (
            <span title={matchDate.toLocaleString('en-US', { timeZoneName: 'short' })}>
              {formatBD(matchDate)} BST
            </span>
          )}
        </div>
      )}

      {!isFinished && !isLive && !isPast && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {userId ? (
            <PredictionForm
              matchId={match.id}
              homeTeam={match.home_team}
              awayTeam={match.away_team}
              currentPrediction={currentPrediction}
              onPredictionSaved={(p) => setCurrentPrediction(p)}
              kickoffTime={match.kickoff_time}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center">
              <a href="/login" className="text-blue-600 hover:underline font-medium">
                Sign in
              </a>{' '}
              to predict
            </p>
          )}
        </div>
      )}

      {!isFinished && !isLive && isPast && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {currentPrediction ? (
            <PredictionSummary prediction={currentPrediction} match={match} />
          ) : (
            <div className="text-xs text-gray-400 text-center italic">
              No prediction made
            </div>
          )}
        </div>
      )}

      {isFinished && currentPrediction && (
        <PredictionSummary prediction={currentPrediction} match={match} />
      )}

      {isFinished && !currentPrediction && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 text-center italic">
          No prediction
        </div>
      )}
    </div>
  )
}
