'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import DuolingoBadge from '@/components/ui/duolingo-badge'
import DuolingoButton from '@/components/ui/duolingo-button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { authClient } from '@/lib/auth-client'
import { client } from '@/lib/client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format, isToday, isTomorrow } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const Page = () => {
  const router = useRouter()
  const { data } = authClient.useSession()

  return (
    <div className="relative w-full max-w-md mx-auto mt-12">
      <div className="relative w-full flex  flex-col gap-6 bg-white/90 shadow-xl rounded-2xl z-10 py-10 px-6 md:px-12">
        <div className="flex flex-col items-center w-full gap-6 bg-light-gray rounded-lg p-5">
          {/* user card */}
          <div className="flex flex-col gap-2 items-center">
            <div className="mb-1 flex flex-col items-center">
              <p className="text-2xl font-semibold text-gray-900">{data?.user.name}</p>
              <p className="text-sm text-gray-500">{data?.user.email}</p>
            </div>
            <DuolingoBadge className="mb-6 px-3">
              Pro Plan
            </DuolingoBadge>
          </div>

          {/* status card */}
          <div className="bg-white shadow-sm rounded-xl p-3 w-full">
            <div className="flex flex-col items-center justify-center gap-2">
              <p className="text-sm opacity-60 text-center">
                You have unlimited access to all Contentport features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Page
