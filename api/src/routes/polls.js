import { Hono } from 'hono'
import { z } from 'zod'
import { getAuthenticatedUser, getUserFid } from '../middleware/auth.js'
import { isValidTransactionHash } from '../utils/blockchain.js'
import { createImageQueueService } from '../services/imageQueue.js'
import { verifyPollCreationTransaction, verifyVoteTransaction } from '../services/onchainVerification.js'
import { createBlockchainClient } from '../config/blockchain.js'
import { nanoid } from 'nanoid'

const pollsRouter = new Hono()

// Validation schemas
const createPollSchema = z.object({
  question: z.string().min(1, 'Question is required').max(280, 'Question too long'),
  options: z.array(z.string().min(1, 'Option cannot be empty').max(100, 'Option too long'))
    .min(2, 'At least 2 options required')
    .max(10, 'Maximum 10 options allowed'),
  duration: z.enum(['1', '3', '7'], { errorMap: () => ({ message: 'Duration must be 1, 3, or 7 days' }) })
    .transform(Number)
})

const verifyPollSchema = z.object({
  transactionHash: z.string().refine(
    (hash) => isValidTransactionHash(hash), 
    'Invalid transaction hash format'
  )
})

const votePollSchema = z.object({
  optionIndex: z.number().min(0, 'Invalid option'),
  transactionHash: z.string().refine(
    (hash) => isValidTransactionHash(hash), 
    'Invalid transaction hash format'
  )
})

const reactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required').max(10, 'Invalid emoji')
})

const listPollsSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('20'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default('0'),
  status: z.enum(['active', 'expired', 'all']).default('active'),
  creator_fid: z.string().transform(Number).pipe(z.number().positive()).optional(),
  voter_fid: z.string().transform(Number).pipe(z.number().positive()).optional()
})

// GET /api/polls - List polls with filtering and pagination
pollsRouter.get('/', async (c) => {
  try {
    const query = listPollsSchema.parse(c.req.query())
    const db = c.env.DB
    const neynar = c.get('neynar')
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Check if user is authenticated for voting status
    let userFid = null
    try {
      const createAuth = c.get('createAuth')
      if (createAuth) {
        await createAuth()(c, async () => {})
      }
      const user = getAuthenticatedUser(c)
      userFid = user?.fid
    } catch (error) {
      // User not authenticated, continue without voting status
    }

    // Build query based on filters
    let whereClause = ''
    let joinClause = ''
    let selectClause = 'SELECT p.id, p.creator_fid, p.question, p.duration_days, p.created_at, p.expires_at, p.status, p.total_votes'
    let fromClause = 'FROM polls p'
    let params = []
    
    // Only show verified polls (have transaction_hash)
    whereClause = 'WHERE p.transaction_hash IS NOT NULL'
    
    // Add JOIN if filtering by voter_fid
    if (query.voter_fid) {
      joinClause = 'JOIN votes v ON p.id = v.poll_id'
      whereClause += ' AND v.voter_fid = ?'
      params.push(query.voter_fid)
    }
    
    if (query.status !== 'all') {
      if (query.status === 'active') {
        whereClause += ' AND p.status = ? AND p.expires_at > strftime("%s", "now")'
        params.push('active')
      } else {
        whereClause += ' AND (p.status = ? OR p.expires_at <= strftime("%s", "now"))'
        params.push('expired')
      }
    }
    
    if (query.creator_fid) {
      whereClause += ' AND p.creator_fid = ?'
      params.push(query.creator_fid)
    }

    const pollsQuery = `
      SELECT p.id, p.creator_fid, p.question, p.duration_days, p.created_at, p.expires_at, p.status, p.total_votes, p.image_url
      ${fromClause} 
      ${joinClause}
      ${whereClause}
      ORDER BY 
        -- Sort by vote count first (popular polls), then by recency
        p.total_votes DESC,
        p.created_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(query.limit, query.offset)

    const { results: polls } = await db.prepare(pollsQuery).bind(...params).all()

    // Get unique creator FIDs for Neynar lookup
    const creatorFids = [...new Set(polls.map(p => p.creator_fid))]
    let creators = []
    if (neynar && creatorFids.length > 0) {
      creators = await neynar.getUsersByFids(creatorFids)
    }

    // Get voting status for authenticated user
    let userVotes = []
    if (userFid && polls.length > 0) {
      const pollIds = polls.map(p => p.id)
      const placeholders = pollIds.map(() => '?').join(',')
      const { results } = await db.prepare(`
        SELECT poll_id, option_index FROM votes 
        WHERE poll_id IN (${placeholders}) AND voter_fid = ?
      `).bind(...pollIds, userFid).all()
      userVotes = results
    }

    // Enrich polls with creator info and voting status
    const enrichedPolls = polls.map(poll => {
      const creator = creators.find(c => c.fid === poll.creator_fid)
      const userVote = userVotes.find(v => v.poll_id === poll.id)
      
      return {
        id: poll.id,
        question: poll.question,
        duration_days: poll.duration_days,
        created_at: poll.created_at,
        expires_at: poll.expires_at,
        status: poll.expires_at <= Math.floor(Date.now() / 1000) ? 'expired' : poll.status,
        total_votes: poll.total_votes,
        image_url: poll.image_url,
        transaction_hash: poll.transaction_hash,
        has_voted: !!userVote,
        user_vote: userVote ? { option_index: userVote.option_index } : null,
        creator: creator ? {
          fid: creator.fid,
          username: creator.username,
          display_name: creator.display_name,
          pfp_url: creator.pfp_url
        } : {
          fid: poll.creator_fid,
          username: null,
          display_name: null,
          pfp_url: null
        },
        time_ago: formatTimeAgo(poll.created_at)
      }
    })

    return c.json({ 
      polls: enrichedPolls,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: polls.length
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.errors }, 400)
    }
    console.error('Error fetching polls:', error)
    return c.json({ error: 'Failed to fetch polls' }, 500)
  }
})

// POST /api/polls - Create new poll (requires auth, no onchain verification yet)
pollsRouter.post('/', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const user = getAuthenticatedUser(c)
    const body = await c.req.json()
    const validData = createPollSchema.parse(body)
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const pollId = nanoid()
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + (validData.duration * 24 * 60 * 60)

    // Create poll without transaction hash (unverified)
    await db.prepare(`
      INSERT INTO polls (id, creator_fid, question, duration_days, created_at, expires_at, status, total_votes)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 0)
    `).bind(pollId, user.fid, validData.question, validData.duration, now, expiresAt).run()

    // Create poll options
    for (let i = 0; i < validData.options.length; i++) {
      await db.prepare(`
        INSERT INTO poll_options (id, poll_id, option_index, option_text, vote_count)
        VALUES (?, ?, ?, ?, 0)
      `).bind(nanoid(), pollId, i, validData.options[i]).run()
    }

    // Fetch the created poll with options
    const poll = await getPollWithDetails(db, pollId, c.get('neynar'))

    console.log(`📝 Poll created (unverified): ${pollId}`)
    return c.json({ poll }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400)
    }
    console.error('Error creating poll:', error)
    return c.json({ error: 'Failed to create poll' }, 500)
  }
})

// POST /api/polls/:id/verify - Verify poll with onchain transaction
pollsRouter.post('/:id/verify', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const user = getAuthenticatedUser(c)
    const pollId = c.req.param('id')
    const body = await c.req.json()
    const validData = verifyPollSchema.parse(body)
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Check if poll exists and user is the creator
    const { results: [poll] } = await db.prepare(`
      SELECT id, creator_fid, question, duration_days, transaction_hash FROM polls WHERE id = ?
    `).bind(pollId).all()

    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }

    if (poll.creator_fid !== user.fid) {
      return c.json({ error: 'Only poll creator can verify' }, 403)
    }

    if (poll.transaction_hash) {
      return c.json({ error: 'Poll already verified' }, 400)
    }

    // Get poll options count for verification
    const { results: options } = await db.prepare(`
      SELECT COUNT(*) as count FROM poll_options WHERE poll_id = ?
    `).bind(pollId).all()

    // Create blockchain client for verification
    const blockchain = createBlockchainClient(c.env)

    // Verify onchain poll creation transaction
    const contractAddress = c.env.POLLS_CONTRACT_ADDRESS
    if (!contractAddress) {
      return c.json({ error: 'Contract address not configured' }, 503)
    }
    
    const verificationResult = await verifyPollCreationTransaction(
      blockchain,
      validData.transactionHash,
      pollId,
      poll.creator_fid,
      poll.duration_days,
      options[0].count,
      contractAddress
    )

    if (!verificationResult.verified) {
      console.error(`Poll creation verification failed: ${verificationResult.error}`)
      return c.json({ 
        error: 'Onchain verification failed', 
        details: verificationResult.error 
      }, 400)
    }

    // Update poll with transaction hash
    await db.prepare(`
      UPDATE polls SET transaction_hash = ? WHERE id = ?
    `).bind(validData.transactionHash, pollId).run()

    // Queue live image generation task now that poll is verified
    const imageQueue = c.env.IMAGE_QUEUE
    if (imageQueue) {
      try {
        const queueService = createImageQueueService(imageQueue)
        await queueService.queueLiveImage(pollId)
      } catch (error) {
        console.error('Failed to queue live image generation:', error)
      }
    }

    // Fetch the updated poll
    const updatedPoll = await getPollWithDetails(db, pollId, c.get('neynar'))

    console.log(`✅ Poll verified successfully: ${pollId}`)
    return c.json({ 
      poll: updatedPoll,
      verification: verificationResult.pollCreationData
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400)
    }
    console.error('Error verifying poll:', error)
    return c.json({ error: 'Failed to verify poll' }, 500)
  }
})

// GET /api/polls/:id - Get poll details with options and current results
pollsRouter.get('/:id', async (c) => {
  try {
    const pollId = c.req.param('id')
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const poll = await getPollWithDetails(db, pollId, c.get('neynar'))
    
    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }
    
    return c.json({ poll })
  } catch (error) {
    console.error('Error fetching poll:', error)
    return c.json({ error: 'Failed to fetch poll' }, 500)
  }
})

// POST /api/polls/:id/vote - Submit vote (requires auth and onchain verification)
pollsRouter.post('/:id/vote', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const user = getAuthenticatedUser(c)
    const pollId = c.req.param('id')
    const body = await c.req.json()
    const validData = votePollSchema.parse(body)
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Use authenticated user's FID for voting
    const voterFid = user.fid

    // Check if poll exists and is active
    const { results: [poll] } = await db.prepare(`
      SELECT id, expires_at, status, transaction_hash FROM polls WHERE id = ?
    `).bind(pollId).all()

    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }

    if (poll.status !== 'active' || poll.expires_at <= Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Poll is no longer active' }, 400)
    }

    // Only allow voting on onchain-verified polls
    if (!poll.transaction_hash) {
      return c.json({ error: 'Can only vote on onchain-verified polls' }, 400)
    }

    // Check if user already voted
    const { results: [existingVote] } = await db.prepare(`
      SELECT id FROM votes WHERE poll_id = ? AND voter_fid = ?
    `).bind(pollId, voterFid).all()

    if (existingVote) {
      return c.json({ error: 'You have already voted on this poll' }, 400)
    }

    // Verify option exists
    const { results: [option] } = await db.prepare(`
      SELECT id FROM poll_options WHERE poll_id = ? AND option_index = ?
    `).bind(pollId, validData.optionIndex).all()

    if (!option) {
      return c.json({ error: 'Invalid option selected' }, 400)
    }

    // Create blockchain client for verification
    const blockchain = createBlockchainClient(c.env)

    // Verify onchain vote transaction
    const contractAddress = c.env.POLLS_CONTRACT_ADDRESS
    if (!contractAddress) {
      return c.json({ error: 'Contract address not configured' }, 503)
    }
    
    const verificationResult = await verifyVoteTransaction(
      blockchain,
      validData.transactionHash,
      pollId,
      voterFid,
      validData.optionIndex,
      contractAddress
    )

    if (!verificationResult.verified) {
      console.error(`Vote verification failed: ${verificationResult.error}`)
      return c.json({ 
        error: 'Onchain verification failed', 
        details: verificationResult.error 
      }, 400)
    }

    // Create vote record (verified)
    const voteId = nanoid()
    const now = Math.floor(Date.now() / 1000)

    await db.prepare(`
      INSERT INTO votes (id, poll_id, voter_fid, option_index, transaction_hash, block_number, voted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      voteId, 
      pollId, 
      voterFid, 
      validData.optionIndex, 
      validData.transactionHash,
      verificationResult.voteData.blockNumber,
      now
    ).run()

    // Create confirmed transaction record
    await db.prepare(`
      INSERT INTO vote_transactions (transaction_hash, vote_id, block_number, block_hash, gas_used, status, verified_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?)
    `).bind(
      validData.transactionHash, 
      voteId, 
      verificationResult.voteData.blockNumber,
      verificationResult.voteData.blockHash,
      verificationResult.voteData.gasUsed,
      now,
      now
    ).run()

    // Vote counts are updated automatically by triggers

    // Queue live image regeneration task (shows updated results)
    const imageQueue = c.env.IMAGE_QUEUE
    if (imageQueue) {
      try {
        const queueService = createImageQueueService(imageQueue)
        await queueService.queueLiveImage(pollId)
      } catch (error) {
        console.error('Failed to queue live image generation:', error)
      }
    }

    console.log(`✅ Vote verified and recorded: ${pollId} - option ${validData.optionIndex} by FID ${voterFid}`)
    return c.json({ 
      success: true,
      message: 'Vote verified and recorded successfully',
      vote_id: voteId,
      transaction_hash: validData.transactionHash,
      status: 'confirmed',
      block_number: verificationResult.voteData.blockNumber
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400)
    }
    console.error('Error recording vote:', error)
    return c.json({ error: 'Failed to record vote' }, 500)
  }
})

// GET /api/polls/:id/results - Get detailed poll results
pollsRouter.get('/:id/results', async (c) => {
  try {
    const pollId = c.req.param('id')
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const poll = await getPollWithDetails(db, pollId, c.get('neynar'))
    
    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }

    // Get recent votes with user info
    const { results: recentVotes } = await db.prepare(`
      SELECT v.voter_fid, v.option_index, v.transaction_hash, v.voted_at, po.option_text
      FROM votes v
      JOIN poll_options po ON v.poll_id = po.poll_id AND v.option_index = po.option_index
      WHERE v.poll_id = ?
      ORDER BY v.voted_at DESC
      LIMIT 10
    `).bind(pollId).all()

    // Get voter details from Neynar
    const voterFids = [...new Set(recentVotes.map(v => v.voter_fid))]
    let voters = []
    const neynar = c.get('neynar')
    if (neynar && voterFids.length > 0) {
      voters = await neynar.getUsersByFids(voterFids)
    }

    const enrichedVotes = recentVotes.map(vote => {
      const voter = voters.find(v => v.fid === vote.voter_fid)
      return {
        voter: voter ? {
          fid: voter.fid,
          username: voter.username,
          display_name: voter.display_name,
          pfp_url: voter.pfp_url
        } : {
          fid: vote.voter_fid,
          username: null,
          display_name: null,
          pfp_url: null
        },
        option_text: vote.option_text,
        transaction_hash: vote.transaction_hash,
        short_tx_hash: vote.transaction_hash ? 
          `${vote.transaction_hash.slice(0, 8)}...${vote.transaction_hash.slice(-3)}` : null,
        voted_at: vote.voted_at
      }
    })

    return c.json({ 
      poll,
      recent_votes: enrichedVotes
    })
  } catch (error) {
    console.error('Error fetching results:', error)
    return c.json({ error: 'Failed to fetch results' }, 500)
  }
})

// GET /api/polls/:id/user-vote - Check if user has voted on poll (requires auth)
pollsRouter.get('/:id/user-vote', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const user = getAuthenticatedUser(c)
    const pollId = c.req.param('id')
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Check if user has voted on this poll using authenticated user's FID
    const { results: [vote] } = await db.prepare(`
      SELECT id, option_index FROM votes WHERE poll_id = ? AND voter_fid = ?
    `).bind(pollId, user.fid).all()

    return c.json({ 
      hasVoted: !!vote,
      userVote: vote ? { option_index: vote.option_index } : null
    })
  } catch (error) {
    console.error('Error checking user vote:', error)
    return c.json({ error: 'Failed to check user vote' }, 500)
  }
})

// POST /api/polls/:id/react - Add emoji reaction (requires auth)
pollsRouter.post('/:id/react', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const user = getAuthenticatedUser(c)
    const pollId = c.req.param('id')
    const body = await c.req.json()
    const validData = reactionSchema.parse(body)
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Verify poll exists
    const { results: [poll] } = await db.prepare(`
      SELECT id FROM polls WHERE id = ?
    `).bind(pollId).all()

    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }

    // Add or update reaction
    await db.prepare(`
      INSERT OR REPLACE INTO poll_reactions (id, poll_id, reactor_fid, emoji, created_at)
      VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    `).bind(nanoid(), pollId, user.fid, validData.emoji).run()

    return c.json({ success: true, message: 'Reaction added' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400)
    }
    console.error('Error adding reaction:', error)
    return c.json({ error: 'Failed to add reaction' }, 500)
  }
})

// Helper function to get poll with all details
export async function getPollWithDetails(db, pollId, neynar) {
  // Get poll basic info
  const { results: [poll] } = await db.prepare(`
    SELECT id, creator_fid, question, duration_days, created_at, expires_at, status, total_votes, image_url, transaction_hash
    FROM polls WHERE id = ?
  `).bind(pollId).all()

  if (!poll) return null

  // Get poll options with vote counts
  const { results: options } = await db.prepare(`
    SELECT option_index, option_text, vote_count
    FROM poll_options 
    WHERE poll_id = ? 
    ORDER BY option_index
  `).bind(pollId).all()

  // Calculate percentages
  const optionsWithPercentages = options.map(option => ({
    index: option.option_index,
    text: option.option_text,
    vote_count: option.vote_count,
    percentage: poll.total_votes > 0 ? Math.round((option.vote_count / poll.total_votes) * 100) : 0
  }))

  // Get creator info from Neynar
  let creator = { fid: poll.creator_fid, username: null, display_name: null, pfp_url: null }
  if (neynar) {
    const creators = await neynar.getUsersByFids([poll.creator_fid])
    if (creators.length > 0) {
      const creatorData = creators[0]
      creator = {
        fid: creatorData.fid,
        username: creatorData.username,
        display_name: creatorData.display_name,
        pfp_url: creatorData.pfp_url
      }
    }
  }

  return {
    id: poll.id,
    question: poll.question,
    duration_days: poll.duration_days,
    created_at: poll.created_at,
    expires_at: poll.expires_at,
    status: poll.expires_at <= Math.floor(Date.now() / 1000) ? 'expired' : poll.status,
    total_votes: poll.total_votes,
    image_url: poll.image_url,
    transaction_hash: poll.transaction_hash,
    creator,
    options: optionsWithPercentages,
    time_ago: formatTimeAgo(poll.created_at)
  }
}

// Helper function to format time ago
function formatTimeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  
  if (diff < 3600) { // Less than 1 hour
    const minutes = Math.floor(diff / 60)
    return minutes <= 1 ? '1m ago' : `${minutes}m ago`
  } else if (diff < 86400) { // Less than 1 day
    const hours = Math.floor(diff / 3600)
    return hours === 1 ? '1h ago' : `${hours}h ago`
  } else { // 1 day or more
    const days = Math.floor(diff / 86400)
    return days === 1 ? '1d ago' : `${days}d ago`
  }
}


export { pollsRouter }