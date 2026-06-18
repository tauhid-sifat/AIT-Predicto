'use client'

type FormResult = 'correct' | 'incorrect' | 'pending'

const FORM_COLORS: Record<FormResult, string> = {
  correct: 'bg-green-500',
  incorrect: 'bg-red-400',
  pending: 'bg-gray-200',
}

const FORM_TOOLTIPS: Record<FormResult, string> = {
  correct: 'Correct prediction',
  incorrect: 'Incorrect prediction',
  pending: 'Not yet scored',
}

export default function RecentForm({ results }: { results: FormResult[] }) {
  if (results.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 font-medium mr-0.5">Form:</span>
      {results.map((r, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-sm ${FORM_COLORS[r]}`}
          title={FORM_TOOLTIPS[r]}
        />
      ))}
    </div>
  )
}
