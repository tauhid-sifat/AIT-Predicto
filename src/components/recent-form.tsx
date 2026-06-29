'use client'

type FormResult = 'exact' | 'correct' | 'incorrect' | 'pending'

const FORM_COLORS: Record<FormResult, string> = {
  exact: 'bg-[#D4AF37]',
  correct: 'bg-green-500',
  incorrect: 'bg-red-400',
  pending: 'bg-gray-200',
}

const FORM_TOOLTIPS: Record<FormResult, string> = {
  exact: 'Exact score + winner correct',
  correct: 'Correct prediction',
  incorrect: 'Incorrect prediction',
  pending: 'Not yet scored',
}

const FORM_BORDER: Record<FormResult, string> = {
  exact: 'ring-1 ring-[#D4AF37]/50',
  correct: '',
  incorrect: '',
  pending: '',
}

const FORM_SIZE: Record<FormResult, string> = {
  exact: 'w-4 h-4',
  correct: 'w-3 h-3',
  incorrect: 'w-3 h-3',
  pending: 'w-3 h-3',
}

const FORM_SHAPE: Record<FormResult, string> = {
  exact: '[clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]',
  correct: 'rounded-sm',
  incorrect: 'rounded-sm',
  pending: 'rounded-sm',
}

export default function RecentForm({ results }: { results: FormResult[] }) {
  if (results.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 font-medium mr-0.5">Form:</span>
      {results.map((r, i) => (
        <div
          key={i}
          className={`${FORM_SIZE[r]} ${FORM_COLORS[r]} ${FORM_BORDER[r]} ${FORM_SHAPE[r]}`}
          title={FORM_TOOLTIPS[r]}
        />
      ))}
    </div>
  )
}
