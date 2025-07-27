import { diff_wordMode } from '@/lib/diff-utils'
import { editToolStyleMessage, editToolSystemPrompt } from '@/lib/prompt-utils'
import { redis } from '@/lib/redis'
import { chunkDiffs, DiffWithReplacement, processDiffs } from '@/lib/utils'
import { TestUIMessage } from '@/types/message'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { FilePart, generateText, ImagePart, TextPart, tool, Tool } from 'ai'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { Style } from '../style-router'
import { buildEditorStateMessage } from './edit-tweet'
import { Account } from '../settings-router'

interface StyleAnalysis {
  overall: string
  first_third: string
  second_third: string
  third_third: string
  [key: string]: string
}

interface CreateThreeDraftsProps {
  redisKeys: {
    chat: string
    style: string
    account: string
  }
  chatId: string
  userMessage: TestUIMessage
  tweet: any
  userEmail: string
}

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

export const create_three_drafts = ({
  redisKeys,
  chatId,
  userMessage,
  tweet,
  userEmail,
}: CreateThreeDraftsProps) =>
  tool({
    description: 'create 3 initial tweet drafts',
    parameters: z.object({}),
    execute: async () => {
      const [style, account, unseenAttachments, websiteContent, draftStyle] =
        await Promise.all([
          redis.json.get<Style>(redisKeys.style),
          redis.json.get<Account>(redisKeys.account),
          redis.lrange<(FilePart | TextPart | ImagePart)[]>(
            `unseen-attachments:${chatId}`,
            0,
            -1,
          ),
          redis.lrange<{ url: string; title: string; content: string }>(
            `website-contents:${chatId}`,
            0,
            -1,
          ),
          redis.json.get<StyleAnalysis>(`draft-style:${userEmail}`),
        ])

      if (Boolean(unseenAttachments.length)) {
        await redis.del(`unseen-attachments:${chatId}`)
      }

      if (websiteContent && websiteContent.length > 0) {
        await redis.del(`website-contents:${chatId}`)
      }

      const websiteContentMessage: TextPart[] = websiteContent.map((content) => ({
        type: 'text',
        text: `<attached_website_content url="${content.url}">${content.content}</attached_website_content>`,
      }))

      const editorStateMessage: TestUIMessage = {
        role: 'user',
        id: `meta:editor-state:${nanoid()}`,
        content: await buildEditorStateMessage(chatId, tweet, true),
      }

      let firstDraftMessages: TestUIMessage[] = [
        ...(style
          ? [
              editToolStyleMessage({
                style,
                account,
                examples: draftStyle?.first_third || draftStyle?.overall || '',
              }),
            ]
          : []),
        editorStateMessage,
        {
          ...userMessage,
          content: [
            ...userMessage.content,
            ...unseenAttachments.flat(),
            ...websiteContentMessage,
          ],
        },
      ]
      let secondDraftMessages: TestUIMessage[] = [
        ...(style
          ? [
              editToolStyleMessage({
                style,
                account,
                examples: draftStyle?.second_third || draftStyle?.overall || '',
              }),
            ]
          : []),
        editorStateMessage,
        {
          ...userMessage,
          content: [
            ...userMessage.content,
            ...unseenAttachments.flat(),
            ...websiteContentMessage,
          ],
        },
      ]
      let thirdDraftMessages: TestUIMessage[] = [
        ...(style
          ? [
              editToolStyleMessage({
                style,
                account,
                examples: draftStyle?.third_third || draftStyle?.overall || '',
              }),
            ]
          : []),
        editorStateMessage,
        {
          ...userMessage,
          content: [
            ...userMessage.content,
            ...unseenAttachments.flat(),
            ...websiteContentMessage,
          ],
        },
      ]

      // Add style-specific instructions for each draft
      if (draftStyle?.overall) {
        const styleInstructions = [
          "Create a draft that follows the user's writing style closely",
          "Create a draft with a slightly different angle while maintaining the style",
          "Create a draft that explores a more creative variation of the style"
        ]
        
        firstDraftMessages.push({
          role: 'user',
          id: `style-instruction-1:${nanoid()}`,
          content: [{ type: 'text', text: styleInstructions[0] || '' }]
        })
        
        secondDraftMessages.push({
          role: 'user',
          id: `style-instruction-2:${nanoid()}`,
          content: [{ type: 'text', text: styleInstructions[1] || '' }]
        })
        
        thirdDraftMessages.push({
          role: 'user',
          id: `style-instruction-3:${nanoid()}`,
          content: [{ type: 'text', text: styleInstructions[2] || '' }]
        })
      }

      const chatModel = openrouter.chat('anthropic/claude-sonnet-4', {
        reasoning: { effort: 'low' },
        models: ['anthropic/claude-3.7-sonnet', 'google/gemini-2.5-pro'],
      })

      const [draft1, draft2, draft3] = await Promise.all([
        generateText({
          model: chatModel,
          temperature: 0.7, // Increased from 0.10 for more creative drafts
          system: editToolSystemPrompt,
          // @ts-ignore
          messages: firstDraftMessages,
        }),
        generateText({
          model: chatModel,
          temperature: 0.8, // Slightly higher for second draft
          system: editToolSystemPrompt,
          // @ts-ignore
          messages: secondDraftMessages,
        }),
        generateText({
          model: chatModel,
          temperature: 0.9, // Highest for third draft to explore different angles
          system: editToolSystemPrompt,
          // @ts-ignore
          messages: thirdDraftMessages,
        }),
      ])

      const sanitizeTweetOutput = (text: string): string => {
        let sanitized = text.endsWith('\n') ? text.slice(0, -1) : text
        return sanitized
          .replaceAll('<current_tweet>', '')
          .replaceAll('</current_tweet>', '')
          .replaceAll('—', '-')
          .trim()
      }

      const diff = (
        currentContent: string,
        newContent: string,
      ): DiffWithReplacement[] => {
        const rawDiffs = diff_wordMode(currentContent, newContent)
        const chunkedDiffs = chunkDiffs(rawDiffs)
        return processDiffs(chunkedDiffs)
      }

      const drafts = [
        {
          id: nanoid(),
          improvedText: sanitizeTweetOutput(draft1.text),
          diffs: diff(tweet.content || '', sanitizeTweetOutput(draft1.text)),
        },
        {
          id: nanoid(),
          improvedText: sanitizeTweetOutput(draft2.text),
          diffs: diff(tweet.content || '', sanitizeTweetOutput(draft2.text)),
        },
        {
          id: nanoid(),
          improvedText: sanitizeTweetOutput(draft3.text),
          diffs: diff(tweet.content || '', sanitizeTweetOutput(draft3.text)),
        },
      ]

      return drafts
    },
  })

type TReturn = ReturnType<typeof create_three_drafts>
export type ThreeDrafts = TReturn extends Tool<infer I, infer O> ? O : never
