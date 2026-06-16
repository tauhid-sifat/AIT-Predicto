export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />
}

export function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-5 flex-1" />
      </div>
      <Skeleton className="h-3 w-32 mx-auto" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-gray-100 py-3 px-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  )
}
