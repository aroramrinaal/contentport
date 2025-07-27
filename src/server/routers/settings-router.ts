import { db } from '@/db'
import { account as accountSchema } from '@/db/schema'
// import { chatLimiter } from '@/lib/chat-limiter' // Not needed since everyone is pro
import { redis } from '@/lib/redis'
import { xai } from '@ai-sdk/xai'
import { generateText } from 'ai'
import { and, desc, eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { TwitterApi } from 'twitter-api-v2'
import { z } from 'zod'
import { j, privateProcedure } from '../jstack'
import { DEFAULT_TWEETS } from '@/constants/default-tweet-preset'

export type Account = {
  id: string
  name: string
  username: string
  profile_image_url: string
  verified: boolean
}

const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!).readOnly

interface Settings {
  user: {
    profile_image_url: string
    name: string
    username: string
    id: string
    verified: boolean
    verified_type: 'string'
  }
}

interface TweetWithStats {
  id: string
  text: string
  likes: number
  retweets: number
  created_at: string
}

interface StyleAnalysis {
  overall: string
  first_third: string
  second_third: string
  third_third: string
  [key: string]: string
}

async function analyzeUserStyle(tweets: any[]): Promise<StyleAnalysis> {
  const systemPrompt = `You are an expert at analyzing writing styles from social media posts. Analyze the given tweets and provide a concise summary of the writing style, tone, voice, common themes, and characteristic patterns. Include examples where it makes sense. Focus on what makes this person's writing unique and distinctive. Keep your analysis under 200 words and do it in 5-10 bullet points. Write it as instructions for someone else to write, e.g. NOT ("this user writes...", but "write like...").

Also, please keep your analysis in simple, easy language at 6-th grade reading level. no fancy words like "utilize this" or "leverage that". 

The goal is that with your analysis, another LLM will be able to replicate the exact style. So picture the style as clearly as possible.
  
EXAMPLE: 
- write in lowercase only, avoiding capitalization on personal pronouns and sentence starts. Example: "i'm not using the next.js app router navigation for @contentport anymore, the results are kinda amazing"
- separate ideas with double line breaks for clarity and emphasis. Example: "a few days ago i posted about moving away from next.js navigation 👀
◆ pages load instantly now"

- use simple punctuation: periods to end statements and emojis to add tone. avoid commas.
- use bulleted lists using the symbol ◆ to break down key points concisely. Example: "◆ pages load instantly now ◆ whole app feels way faster"
- make use of sentence fragments and brief statements to create a punchy, direct style. Example: "dear @neondatabase, you're so easy to set up and have a great free tier"
- occasionally use casual, conversational vocabulary including slang and mild profanity to convey authenticity and enthusiasm. Example: "man i just fucking love aws s3"
- use rhetorical questions to engage readers. Example: "why didn't anyone tell me that talking to users is actually fun"
- use a friendly, informal tone with a mix of humor and straightforwardness, often expressing excitement or frustration openly.
- use emojis sparingly but purposefully to highlight emotion or humor (e.g., 🎉 for celebration, 👀 for attention, 🤡 for self-deprecation). Not every post contains emojis, but when used, they reinforce tone.
- keep sentence structures mostly simple with occasional casual connectors like "but," "so," or "and" leading thoughts without formal conjunctions.`

  const formatTweetAnalysis = (tweets: any[]) => {
    return tweets.map((tweet, index) => `${index + 1}. ${tweet.text}`).join('\n\n')
  }

  const thirdSize = Math.ceil(tweets.length / 3)
  const firstThird = tweets.slice(0, thirdSize)
  const secondThird = tweets.slice(thirdSize, thirdSize * 2)
  const thirdThird = tweets.slice(thirdSize * 2)

  const [overallAnalysis, firstThirdAnalysis, secondThirdAnalysis, thirdThirdAnalysis] =
    await Promise.all([
      generateText({
        model: xai('grok-3-latest'),
        system: systemPrompt,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze the overall writing style from these tweets:\n\n${formatTweetAnalysis(tweets)}`,
          },
        ],
      }),
      generateText({
        model: xai('grok-3-latest'),
        system: systemPrompt,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze the writing style from these tweets:\n\n${formatTweetAnalysis(firstThird)}`,
          },
        ],
      }),
      generateText({
        model: xai('grok-3-latest'),
        system: systemPrompt,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze the writing style from these tweets:\n\n${formatTweetAnalysis(secondThird)}`,
          },
        ],
      }),
      generateText({
        model: xai('grok-3-latest'),
        system: systemPrompt,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Analyze the writing style from these tweets:\n\n${formatTweetAnalysis(thirdThird)}`,
          },
        ],
      }),
    ])

  return {
    overall: overallAnalysis.text,
    first_third: firstThirdAnalysis.text,
    second_third: secondThirdAnalysis.text,
    third_third: thirdThirdAnalysis.text,
  }
}

export const settingsRouter = j.router({
  limit: privateProcedure.get(async ({ c, ctx }) => {
    const { user } = ctx
    // Everyone is pro by default - return unlimited usage
    return c.json({ 
      remaining: 999999, // Unlimited 
      reset: Date.now() + 24 * 60 * 60 * 1000 // Reset 24h from now (not that it matters)
    })
  }),

  // onboarding: privateProcedure
  //   .input(
  //     z.object({
  //       username: z.string(),
  //     }),
  //   )
  //   .post(async ({ c, ctx, input }) => {
  //     const { username } = input
  //     const { user } = ctx

  //     let userData: UserV2 | undefined = undefined

  //     try {
  //       const { data } = await client.v2.userByUsername(username.replace('@', ''), {
  //         'user.fields': [
  //           'profile_image_url',
  //           'name',
  //           'username',
  //           'id',
  //           'verified',
  //           'verified_type',
  //         ],
  //       })

  //       userData = data
  //     } catch (err) {
  //       throw new HTTPException(404, {
  //         message: `User "${username}" not found`,
  //       })
  //     }

  //     if (!userData) {
  //       throw new HTTPException(404, {
  //         message: `User "${username}" not found`,
  //       })
  //     }

  //     await redis.json.set(`connected-account:${user.email}`, '$', {
  //       ...userData,
  //     })

  //     const userTweets = await client.v2.userTimeline(userData.id, {
  //       max_results: 30,
  //       'tweet.fields': [
  //         'public_metrics',
  //         'created_at',
  //         'text',
  //         'author_id',
  //         'note_tweet',
  //         'edit_history_tweet_ids',
  //         'in_reply_to_user_id',
  //         'referenced_tweets',
  //       ],
  //       'user.fields': ['username', 'profile_image_url', 'name'],
  //       exclude: ['retweets', 'replies'],
  //       expansions: ['author_id'],
  //     })

  //     const styleKey = `style:${user.email}`
  //     let isPreset: boolean = false
  //     let userTweetCount: number = 0

  //     if (!userTweets.data.data) {
  //       isPreset = true

  //       await redis.json.set(styleKey, '$', {
  //         tweets: DEFAULT_TWEETS,
  //         prompt: '',
  //       })
  //     } else {
  //       isPreset = false

  //       const filteredTweets = userTweets.data.data?.filter(
  //         (tweet) =>
  //           !tweet.in_reply_to_user_id &&
  //           !tweet.referenced_tweets?.some((ref) => ref.type === 'replied_to'),
  //       )

  //       const tweetsWithStats: TweetWithStats[] = filteredTweets.map((tweet) => ({
  //         id: tweet.id,
  //         text: tweet.text,
  //         likes: tweet.public_metrics?.like_count || 0,
  //         retweets: tweet.public_metrics?.retweet_count || 0,
  //         created_at: tweet.created_at || '',
  //       }))

  //       const sortedTweets = tweetsWithStats.sort((a, b) => b.likes - a.likes)

  //       const topTweets = sortedTweets.slice(0, 20)

  //       const author = userTweets.includes.users?.[0]
  //       let formattedTweets = topTweets.map((tweet) => {
  //         const cleanedText = tweet.text.replace(/https:\/\/t\.co\/\w+/g, '').trim()

  //         return {
  //           id: tweet.id,
  //           text: cleanedText,
  //           created_at: tweet.created_at,
  //           author_id: userData.id,
  //           edit_history_tweet_ids: [tweet.id],
  //           author: author
  //             ? {
  //                 username: author.username,
  //                 profile_image_url: author.profile_image_url,
  //                 name: author.name,
  //               }
  //             : null,
  //         }
  //       })

  //       userTweetCount = formattedTweets.length

  //       if (formattedTweets.length < 20) {
  //         const existingIds = new Set(formattedTweets.map((t) => t.id))
  //         for (const defaultTweet of DEFAULT_TWEETS) {
  //           if (formattedTweets.length >= 20) break
  //           if (!existingIds.has(defaultTweet.id)) {
  //             formattedTweets.push(defaultTweet)
  //             existingIds.add(defaultTweet.id)
  //           }
  //         }
  //       }

  //       await redis.json.set(styleKey, '$', {
  //         tweets: formattedTweets.reverse(),
  //         prompt: '',
  //       })

  //       const styleAnalysis = await analyzeUserStyle(formattedTweets)
  //       const draftStyleKey = `draft-style:${user.email}`
  //       await redis.json.set(draftStyleKey, '$', styleAnalysis)
  //     }

  //     await db.insert(knowledgeDocument).values([
  //       {
  //         userId: user.id,
  //         fileName: '',
  //         type: 'url',
  //         s3Key: '',
  //         title: 'Introducing Zod 4',
  //         description:
  //           "An article about the Zod 4.0 release. After a year of active development: Zod 4 is now stable! It's faster, slimmer, more tsc-efficient, and implements some long-requested features.",
  //         isExample: true,
  //         sourceUrl: 'https://zod.dev/v4',
  //       },
  //       {
  //         userId: user.id,
  //         fileName: 'data-fetching.png',
  //         type: 'image',
  //         s3Key: 'knowledge/4bBacfDWPhQzOzN479b605xuippnbKzF/Lsv-t_5_EMwNXW8jptBYG.png',
  //         title: 'React Hooks Cheatsheet - Visual Guide',
  //         isExample: true,
  //         sourceUrl: '',
  //       },
  //     ])

  //     return c.json({
  //       success: true,
  //       data: {
  //         userTweetCount,
  //         isPreset,
  //         username: userData.username,
  //         name: userData.name,
  //         profile_image_url: userData.profile_image_url,
  //         verified: userData.verified,
  //       },
  //     })
  //   }),

  // connect: privateProcedure
  //   .input(
  //     z.object({
  //       username: z.string(),
  //     }),
  //   )
  //   .post(async ({ c, ctx, input }) => {
  //     const { username } = input
  //     const { user } = ctx

  //     const { data: userData } = await client.v2.userByUsername(
  //       username.replace('@', ''),
  //       {
  //         'user.fields': [
  //           'profile_image_url',
  //           'name',
  //           'username',
  //           'id',
  //           'verified',
  //           'verified_type',
  //         ],
  //       },
  //     )

  //     if (!userData) {
  //       throw new HTTPException(404, {
  //         message: `User "${username}" not found`,
  //       })
  //     }

  //     await redis.json.set(`active-account:${user.email}`, '$', {
  //       ...userData,
  //     })

  //     return c.json({
  //       success: true,
  //       data: {
  //         username: userData.username,
  //         name: userData.name,
  //         profile_image_url: userData.profile_image_url,
  //         verified: userData.verified,
  //       },
  //     })
  //   }),

  delete_account: privateProcedure
    .input(
      z.object({
        accountId: z.string(),
      }),
    )
    .post(async ({ c, ctx, input }) => {
      const { user } = ctx
      const { accountId } = input

      const activeAccount = await redis.json.get<Account>(`active-account:${user.email}`)

      if (activeAccount?.id === accountId) {
        await redis.del(`active-account:${user.email}`)
      }

      const [dbAccount] = await db
        .select()
        .from(accountSchema)
        .where(and(eq(accountSchema.userId, user.id), eq(accountSchema.id, accountId)))

      if (dbAccount) {
        await db.delete(accountSchema).where(eq(accountSchema.id, accountId))
      }

      await redis.json.del(`account:${user.email}:${accountId}`)

      return c.json({ success: true })
    }),

  list_accounts: privateProcedure.get(async ({ c, ctx }) => {
    const { user } = ctx
    const accountIds = await db
      .select({
        id: accountSchema.id,
      })
      .from(accountSchema)
      .where(
        and(eq(accountSchema.userId, user.id), eq(accountSchema.providerId, 'twitter')),
      )
      .orderBy(desc(accountSchema.createdAt))

    const activeAccount = await redis.json.get<Account>(`active-account:${user.email}`)

    const accounts = await Promise.all(
      accountIds.map(async (accountRecord) => {
        const accountData = await redis.json.get<Account>(
          `account:${user.email}:${accountRecord.id}`,
        )
        return {
          ...accountRecord,
          ...accountData,
          isActive: activeAccount?.id === accountRecord.id,
        }
      }),
    )

    return c.superjson({ accounts })
  }),

  connect: privateProcedure
    .input(
      z.object({
        accountId: z.string(),
      }),
    )
    .mutation(async ({ c, ctx, input }) => {
      const { user } = ctx
      const account = await redis.get<Account>(`account:${user.email}:${input.accountId}`)

      if (!account) {
        throw new HTTPException(404, {
          message: `Account "${input.accountId}" not found`,
        })
      }

      await redis.json.set(`active-account:${user.email}`, '$', account)

      return c.json({ success: true })
    }),

  active_account: privateProcedure.get(async ({ c, input, ctx }) => {
    const { user } = ctx

    let account: Account | null = null

    account = await redis.json.get<Account>(`active-account:${user.email}`)

    // if (!account) {
    //   // legacy compat
    //   account = await redis.json.get<Account>(`connected-account:${user.email}`)

    //   if (account) {
    //     await redis.json.set(`active-account:${user.email}`, '$', account)
    //   }
    // }

    return c.json({ account })
  }),

  switch_account: privateProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ c, ctx, input }) => {
      const { user } = ctx
      const { accountId } = input

      const account = await redis.json.get<Account>(`account:${user.email}:${accountId}`)

      if (!account) {
        throw new HTTPException(404, { message: `Account "${accountId}" not found` })
      }

      await redis.json.set(`active-account:${user.email}`, '$', account)

      return c.json({ success: true, account })
    }),

  refresh_tweets: privateProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ c, ctx, input }) => {
      const { user } = ctx
      const { accountId } = input

      // Get the account from database
      const dbAccount = await db.query.account.findFirst({
        where: and(eq(accountSchema.userId, user.id), eq(accountSchema.id, accountId)),
      })

      if (!dbAccount || !dbAccount.accessToken) {
        throw new HTTPException(400, {
          message: 'Twitter account not connected or access token missing',
        })
      }

      // Create Twitter client with user's tokens
      const client = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY as string,
        appSecret: process.env.TWITTER_CONSUMER_SECRET as string,
        accessToken: dbAccount.accessToken as string,
        accessSecret: dbAccount.accessSecret as string,
      })

      // Get user profile
      const userProfile = await client.currentUser()
      const { data } = await client.v2.userByUsername(userProfile.screen_name, {
        'user.fields': ['verified', 'verified_type'],
      })

      // Fetch fresh tweets with new system
      const userTweets = await client.v2.userTimeline(userProfile.id_str, {
        max_results: 50, // Using the new limit
        'tweet.fields': [
          'public_metrics',
          'created_at',
          'text',
          'author_id',
          'note_tweet',
          'edit_history_tweet_ids',
          'in_reply_to_user_id',
          'referenced_tweets',
        ],
        'user.fields': ['username', 'profile_image_url', 'name'],
        exclude: ['retweets', 'replies'],
        expansions: ['author_id'],
      })

      const styleKey = `style:${user.email}:${accountId}`

      if (!userTweets.data.data) {
        await redis.json.set(styleKey, '$', {
          tweets: DEFAULT_TWEETS,
          prompt: '',
        })
      } else {
        const filteredTweets = userTweets.data.data?.filter(
          (tweet) =>
            !tweet.in_reply_to_user_id &&
            !tweet.referenced_tweets?.some((ref) => ref.type === 'replied_to') &&
            tweet.text.length > 20 &&
            tweet.text.length < 280,
        )
        
        const tweetsWithStats = filteredTweets.map((tweet) => ({
          id: tweet.id,
          text: tweet.text,
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          created_at: tweet.created_at || '',
          engagement_score: (tweet.public_metrics?.like_count || 0) + 
                          (tweet.public_metrics?.retweet_count || 0) * 2 + 
                          (tweet.public_metrics?.reply_count || 0) * 3,
        }))
        
        const sortedTweets = tweetsWithStats.sort((a, b) => b.engagement_score - a.engagement_score)
        const topTweets = sortedTweets.slice(0, 30)
        const author = userProfile
        let formattedTweets = topTweets.map((tweet) => {
          const cleanedText = tweet.text.replace(/https:\/\/t\.co\/\w+/g, '').trim()
          return {
            id: tweet.id,
            text: cleanedText,
            created_at: tweet.created_at,
            author_id: userProfile.id_str,
            edit_history_tweet_ids: [tweet.id],
            engagement_score: tweet.engagement_score,
            author: author
              ? {
                  username: author.screen_name,
                  profile_image_url: author.profile_image_url_https,
                  name: author.name,
                }
              : null,
          }
        })
        
        if (formattedTweets.length < 30) {
          const existingIds = new Set(formattedTweets.map((t) => t.id))
          for (const defaultTweet of DEFAULT_TWEETS) {
            if (formattedTweets.length >= 30) break
            if (!existingIds.has(defaultTweet.id)) {
              formattedTweets.push(defaultTweet)
              existingIds.add(defaultTweet.id)
            }
          }
        }
        
        await redis.json.set(styleKey, '$', {
          tweets: formattedTweets.reverse(),
          prompt: '',
        })
        
        // Re-analyze style with new tweets
        const styleAnalysis = await analyzeUserStyle(formattedTweets)
        const draftStyleKey = `draft-style:${accountId}`
        await redis.json.set(draftStyleKey, '$', styleAnalysis)
      }

      return c.json({ 
        success: true, 
        message: 'Tweets refreshed successfully',
        tweetCount: userTweets.data.data?.length || 0
      })
    }),
})
