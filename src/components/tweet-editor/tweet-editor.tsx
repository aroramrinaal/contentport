'use client'

import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'
import Tweet from './tweet'
import { initialConfig } from '@/hooks/use-tweets'
import { LexicalComposer } from '@lexical/react/LexicalComposer'

interface TweetEditorProps extends HTMLAttributes<HTMLDivElement> {
  id?: string | undefined
  initialContent?: string
  editMode?: boolean
  editTweetId?: string | null
}

export default function TweetEditor({
  id,
  initialContent,
  className,
  editMode = false,
  editTweetId,
  ...rest
}: TweetEditorProps) {
  return (
    <div className={cn('relative z-10 w-full rounded-lg font-sans', className)} {...rest}>
      <div className="space-y-4 w-full">
        <LexicalComposer initialConfig={{ ...initialConfig }}>
          <Tweet editMode={editMode} editTweetId={editTweetId} />
        </LexicalComposer>
      </div>
    </div>
  )
}

// Add this component for displaying three drafts
const DraftSelector = ({ drafts, onSelectDraft, selectedIndex, onSelectIndex }: {
  drafts: any[]
  onSelectDraft: (draft: any) => void
  selectedIndex: number
  onSelectIndex: (index: number) => void
}) => {
  if (!drafts || drafts.length === 0) return null

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      <h3 className="text-lg font-semibold text-gray-900">Choose your favorite draft:</h3>
      <div className="grid gap-3">
        {drafts.map((draft, index) => (
          <div
            key={draft.id}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedIndex === index
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
            onClick={() => {
              onSelectIndex(index)
              onSelectDraft(draft)
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Draft {index + 1}
              </span>
              {selectedIndex === index && (
                <span className="text-blue-600 text-sm font-medium">✓ Selected</span>
              )}
            </div>
            <p className="text-gray-900 whitespace-pre-wrap">{draft.improvedText}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
