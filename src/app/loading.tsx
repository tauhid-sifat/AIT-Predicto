import { MatchCardSkeleton } from '@/components/skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="h-7 w-24 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => <MatchCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
