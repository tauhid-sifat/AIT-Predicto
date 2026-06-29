'use client'

export type FormResult = 'exact' | 'correct' | 'incorrect' | null

const TOOLTIPS: Record<string, string> = {
  exact: 'Exact score + winner correct',
  correct: 'Correct prediction',
  incorrect: 'Incorrect prediction',
}

export default function RecentForm({ results }: { results: (FormResult)[] }) {
  if (results.length === 0) return null

  return (
    <div className="flex items-center gap-px flex-wrap">
      <span className="text-[10px] text-gray-400 font-medium mr-0.5 shrink-0">Form:</span>
      <div className="flex items-center gap-px">
        {results.map((r, i) => {
          if (r === null) {
            return <div key={i} className="w-2 h-2 bg-gray-700/20 border border-gray-700/40 rounded-sm" title="No prediction" />
          }
          if (r === 'exact') {
            return (
              <div
                key={i}
                className="w-2.5 h-2.5 bg-yellow-400 ring-1 ring-yellow-400/50 [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]"
                title={TOOLTIPS.exact}
              />
            )
          }
          return (
            <div
              key={i}
              className={`w-2 h-2 rounded-sm ${r === 'correct' ? 'bg-green-500' : 'bg-red-400'}`}
              title={TOOLTIPS[r]}
            />
          )
        })}
      </div>
    </div>
  )
}
