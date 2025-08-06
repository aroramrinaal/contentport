"use client"

import TweetQueue from '@/components/tweet-queue'
import { AccountAvatar } from '@/hooks/account-ctx'
import { client } from '@/lib/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import DuolingoButton from '@/components/ui/duolingo-button'

export default function ScheduledTweetsPage() {
  const queryClient = useQueryClient()

  const { mutate: cleanupOrphanedTweets, isPending: isCleaning } = useMutation({
    mutationFn: async () => {
      const res = await client.tweet.cleanup_orphaned_tweets.$post()
      return await res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Cleanup completed')
      // Refresh the queue data
      queryClient.invalidateQueries({ queryKey: ['queue-slots'] })
      queryClient.invalidateQueries({ queryKey: ['scheduled-and-published-tweets'] })
    },
    onError: () => {
      toast.error('Failed to cleanup orphaned tweets')
    },
  })

  return (
    <div className="relative z-10 max-w-3xl mx-auto w-full">
      <div className="space-y-6 relative z-10 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AccountAvatar className="size-10" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold text-stone-900">Queued Tweets</h1>
              <p className="text-sm text-stone-600">
                Your queue automatically publishes tweets to peak activity times.
              </p>
            </div>
          </div>
          
          <DuolingoButton
            variant="secondary"
            size="sm"
            onClick={() => cleanupOrphanedTweets()}
            loading={isCleaning}
            className="flex items-center gap-2"
          >
            <RefreshCw className="size-4" />
            <span>Sync with QStash</span>
          </DuolingoButton>
        </div>

        <TweetQueue />
      </div>
    </div>
  )
}
