import { HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Attachment } from './chat-router'
import { BUCKET_NAME, FILE_TYPE_MAP, s3Client } from '@/lib/s3'
import mammoth from 'mammoth'
import { FilePart, ImagePart, TextPart } from 'ai'
import { db } from '@/db'
import { knowledgeDocument } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Helper function to fetch video transcript with polling
const fetchVideoTranscript = async (
  s3Key: string,
  maxAttempts: number = 10,
  delayMs: number = 2000
): Promise<string | null> => {
  const transcriptKey = s3Key.replace(/\.[^/.]+$/, '.json') // Replace file extension with .json

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `transcriptions/${transcriptKey}`,
      })

      const response = await s3Client.send(command)

      if (response.Body) {
        const bodyContents = await response.Body.transformToString()
        const transcriptionData = JSON.parse(bodyContents) as any

        // Extract transcript text from the transcription JSON
        if (transcriptionData.text) {
          return transcriptionData.text
        }

        return 'Transcript content found but format not recognized'
      }
    } catch (error: any) {
      // Check if it's a NoSuchKey error (404 equivalent)
      if (error.name === 'NoSuchKey' && attempt < maxAttempts) {
        console.log(`Transcript not ready yet (attempt ${attempt}), waiting...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }

      console.error(`Error fetching transcript (attempt ${attempt}):`, error)

      // If not the last attempt, wait and try again
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
    }
  }

  return null // Transcript not ready or doesn't exist
}

export const parseAttachments = async ({
  attachments,
}: {
  attachments?: Attachment[]
}) => {
  const validAttachments =
    attachments?.filter((a) => Boolean(a.fileKey) || Boolean(a.type === 'url')) ?? []

  const attachmentContents = await Promise.all(
    validAttachments.map(async (attachment) => {
      if (attachment.type === 'url') {
        const { id } = attachment
        const [document] = await db
          .select()
          .from(knowledgeDocument)
          .where(eq(knowledgeDocument.id, id))

        if (document && document.sourceUrl) {
          return { type: 'link' as const, link: document.sourceUrl }
        }
      }

      try {
        const command = new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: attachment.fileKey,
        })

        const data = await s3Client.send(command)
        const contentType = data.ContentType as keyof typeof FILE_TYPE_MAP

        const type = FILE_TYPE_MAP[contentType as keyof typeof FILE_TYPE_MAP]

        if (!type) {
          console.warn(`Unknown content type: ${contentType} for file: ${attachment.fileKey}`)
          // For unknown types, try to fetch using S3 SDK
          try {
            const getObjectCommand = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: attachment.fileKey,
            })
            
            const s3Response = await s3Client.send(getObjectCommand)
            
            if (!s3Response.Body) {
              throw new Error('No file body received from S3')
            }
            
            const uint8Array = await s3Response.Body.transformToByteArray()
            const buffer = uint8Array.buffer as ArrayBuffer
            
            return { 
              type: 'file' as const, 
              data: buffer, 
              mimeType: contentType 
            } as FilePart
          } catch (error) {
            console.error(`Error fetching unknown file type from S3: ${attachment.fileKey}`, error)
            throw new Error(`Failed to fetch file from S3: ${attachment.fileKey}`)
          }
        }

        if (type === 'image') {
          // For images, we need to fetch the actual image data using S3 SDK
          try {
            const getObjectCommand = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: attachment.fileKey,
            })
            
            const s3Response = await s3Client.send(getObjectCommand)
            
            if (!s3Response.Body) {
              throw new Error('No file body received from S3')
            }
            
            const uint8Array = await s3Response.Body.transformToByteArray()
            const buffer = uint8Array.buffer as ArrayBuffer
            
            return { 
              type: 'image' as const, 
              image: buffer 
            } as ImagePart
          } catch (error) {
            console.error(`Error fetching image from S3: ${attachment.fileKey}`, error)
            throw new Error(`Failed to fetch image from S3: ${attachment.fileKey}`)
          }
        } else if (type === 'docx') {
          try {
            const getObjectCommand = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: attachment.fileKey,
            })
            
            const s3Response = await s3Client.send(getObjectCommand)
            
            if (!s3Response.Body) {
              throw new Error('No file body received from S3')
            }
            
            const uint8Array = await s3Response.Body.transformToByteArray()
            const buffer = Buffer.from(uint8Array)
            
            const { value } = await mammoth.extractRawText({
              buffer: buffer,
            })
            return {
              type: 'text' as const,
              text: `<attached_docx>${value}</attached_docx>`,
            } as TextPart
          } catch (error) {
            console.error(`Error fetching docx from S3: ${attachment.fileKey}`, error)
            throw new Error(`Failed to fetch docx from S3: ${attachment.fileKey}`)
          }
        } else if (attachment.type === 'video') {
          // Handle video transcript
          const transcript = await fetchVideoTranscript(attachment.fileKey!)

          if (transcript) {
            return {
              type: 'text' as const,
              text: `<video_transcript>${transcript}</video_transcript>`,
            } as TextPart
          } else {
            // If transcript is not ready, return a placeholder
            return {
              type: 'text' as const,
              text: `<video_transcript>Video transcript is being processed and is not yet available. Please try again in a few moments.</video_transcript>`,
            } as TextPart
          }
        } else {
          // For other file types, try to fetch using S3 SDK
          try {
            const getObjectCommand = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: attachment.fileKey,
            })
            
            const s3Response = await s3Client.send(getObjectCommand)
            
            if (!s3Response.Body) {
              throw new Error('No file body received from S3')
            }
            
            const uint8Array = await s3Response.Body.transformToByteArray()
            const buffer = uint8Array.buffer as ArrayBuffer
            
            return { 
              type: 'file' as const, 
              data: buffer, 
              mimeType: contentType 
            } as FilePart
          } catch (error) {
            console.error(`Error fetching file from S3: ${attachment.fileKey}`, error)
            throw new Error(`Failed to fetch file from S3: ${attachment.fileKey}`)
          }
        }
      } catch (error) {
        console.error(`Error processing attachment ${attachment.fileKey}:`, error)
        throw new Error(`Failed to process attachment: ${attachment.fileKey}`)
      }
    })
  )

  const images = attachmentContents.filter(Boolean).filter((a) => a.type === 'image')
  const files = attachmentContents
    .filter(Boolean)
    .filter((a) => a.type !== 'image' && a.type !== 'link')
  const links = attachmentContents.filter(Boolean).filter((a) => a.type === 'link')

  return { images, files, links }
}

export class PromptBuilder {
  private parts: string[] = []

  add(content: string | undefined | null): this {
    if (content?.trim()) {
      this.parts.push(content.trim())
    }
    return this
  }

  build(): string {
    return this.parts.join('\n\n').trim()
  }
}
