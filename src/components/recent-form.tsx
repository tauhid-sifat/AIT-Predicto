'use client'

type FormResult = 'exact' | 'correct' | 'incorrect' | 'pending'

const FORM_COLORS: Record<FormResult, string> = {
  exact: 'bg-yellow-400',
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

const FORM_CLASSES: Record<FormResult, string> = {
  exact: 'w-3 h-3 bg-yellow-400 ring-1 ring-yellow-400/50 [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]',
  correct: 'w-2.5 h-2.5 bg-green-500 rounded-sm',
  incorrect: 'w-2.5 h-2.5 bg-red-400 rounded-sm',
  pending: 'w-2.5 h-2.5 bg-gray-200 rounded-sm',
}

export default function RecentForm({ results }: { results: FormResult[] }) {
  if (results.length === 0) return null

  return (
    <div className="flex items-center gap-px">
      <span className="text-[10px] text-gray-400 font-medium mr-0.5 shrink-0">Form:</span>
      <div className="flex items-center gap-px">
        {results.map((r, i) => (
          <div key={i} className={FORM_CLASSES[r]} title={FORM_TOOLTIPS[r]} />
        ))}
      </div>
    </div>
  )
}
