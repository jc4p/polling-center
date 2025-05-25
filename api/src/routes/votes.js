import { Hono } from 'hono'
import { z } from 'zod'
import { getUserFid, getAuthenticatedUser } from '../middleware/auth.js'
import { verifyTransactionWithRetry, isValidTransactionHash } from '../utils/blockchain.js'

const votesRouter = new Hono()

// Validation schemas
const getVotesSchema = z.object({
  poll_id: z.string().optional(),
  voter_fid: z.string().transform(Number).pipe(z.number().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default('0')
})

// GET /api/votes - Get vote history with filters
votesRouter.get('/', async (c) => {
  try {
    const query = getVotesSchema.parse(c.req.query())
    const db = c.env.DB
    const neynar = c.get('neynar')
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Build query with filters
    let whereClause = ''
    let params = []
    
    if (query.poll_id) {
      whereClause = 'WHERE v.poll_id = ?'
      params.push(query.poll_id)
    }
    
    if (query.voter_fid) {
      whereClause += whereClause ? ' AND v.voter_fid = ?' : 'WHERE v.voter_fid = ?'
      params.push(query.voter_fid)
    }

    const votesQuery = `
      SELECT v.id, v.poll_id, v.voter_fid, v.option_index, v.transaction_hash, 
             v.voted_at, po.option_text, p.question as poll_question
      FROM votes v
      LEFT JOIN poll_options po ON v.poll_id = po.poll_id AND v.option_index = po.option_index
      LEFT JOIN polls p ON v.poll_id = p.id
      ${whereClause}
      ORDER BY v.voted_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(query.limit, query.offset)

    const { results: votes } = await db.prepare(votesQuery).bind(...params).all()

    // Get unique voter FIDs for Neynar lookup
    const voterFids = [...new Set(votes.map(v => v.voter_fid))]
    let voters = []
    if (neynar && voterFids.length > 0) {
      voters = await neynar.getUsersByFids(voterFids)
    }

    // Enrich votes with voter info
    const enrichedVotes = votes.map(vote => {
      const voter = voters.find(v => v.fid === vote.voter_fid)
      return {
        id: vote.id,
        poll_id: vote.poll_id,
        poll_question: vote.poll_question,
        option_index: vote.option_index,
        option_text: vote.option_text,
        transaction_hash: vote.transaction_hash,
        short_tx_hash: vote.transaction_hash ? 
          `${vote.transaction_hash.slice(0, 8)}...${vote.transaction_hash.slice(-3)}` : null,
        voted_at: vote.voted_at,
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
        }
      }
    })
    
    return c.json({ 
      votes: enrichedVotes,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: votes.length
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid query parameters', details: error.errors }, 400)
    }
    console.error('Error fetching votes:', error)
    return c.json({ error: 'Failed to fetch votes' }, 500)
  }
})

// GET /api/votes/:transactionHash - Get vote by transaction hash
votesRouter.get('/:transactionHash', async (c) => {
  try {
    const transactionHash = c.req.param('transactionHash')
    
    if (!transactionHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return c.json({ error: 'Invalid transaction hash format' }, 400)
    }
    
    const db = c.env.DB
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const { results: [vote] } = await db.prepare(`
      SELECT v.id, v.poll_id, v.voter_fid, v.option_index, v.transaction_hash, 
             v.voted_at, po.option_text, p.question as poll_question
      FROM votes v
      LEFT JOIN poll_options po ON v.poll_id = po.poll_id AND v.option_index = po.option_index
      LEFT JOIN polls p ON v.poll_id = p.id
      WHERE v.transaction_hash = ?
    `).bind(transactionHash).all()
    
    if (!vote) {
      return c.json({ error: 'Vote not found' }, 404)
    }

    // Get voter info from Neynar
    const neynar = c.get('neynar')
    let voter = { fid: vote.voter_fid, username: null, display_name: null, pfp_url: null }
    if (neynar) {
      const voters = await neynar.getUsersByFids([vote.voter_fid])
      if (voters.length > 0) {
        const voterData = voters[0]
        voter = {
          fid: voterData.fid,
          username: voterData.username,
          display_name: voterData.display_name,
          pfp_url: voterData.pfp_url
        }
      }
    }

    return c.json({
      vote: {
        id: vote.id,
        poll_id: vote.poll_id,
        poll_question: vote.poll_question,
        option_index: vote.option_index,
        option_text: vote.option_text,
        transaction_hash: vote.transaction_hash,
        voted_at: vote.voted_at,
        voter
      }
    })
  } catch (error) {
    console.error('Error fetching vote:', error)
    return c.json({ error: 'Failed to fetch vote' }, 500)
  }
})

// POST /api/votes/verify - Verify vote transaction on blockchain with retry logic
votesRouter.post('/verify', async (c) => {
  try {
    const { transactionHash, useRetry = true, maxRetries = 5 } = await c.req.json()
    
    if (!isValidTransactionHash(transactionHash)) {
      return c.json({ error: 'Invalid transaction hash' }, 400)
    }
    
    const blockchain = c.get('blockchain')
    if (!blockchain) {
      return c.json({ error: 'Blockchain client not available' }, 503)
    }
    
    try {
      let result
      
      if (useRetry) {
        // Use retry logic for better reliability
        result = await verifyTransactionWithRetry(blockchain, transactionHash, maxRetries)
      } else {
        // Single attempt verification
        const transaction = await blockchain.getTransaction({ hash: transactionHash })
        const receipt = await blockchain.getTransactionReceipt({ hash: transactionHash })
        
        const verified = !!(transaction && receipt && receipt.status === 'success')
        
        result = {
          verified,
          transaction: verified ? {
            hash: transaction.hash,
            blockNumber: Number(receipt.blockNumber),
            blockHash: receipt.blockHash,
            status: receipt.status,
            gasUsed: Number(receipt.gasUsed),
            confirmations: receipt.blockNumber ? 1 : 0
          } : null
        }
      }
      
      return c.json(result)
    } catch (error) {
      console.error('Blockchain verification error:', error)
      return c.json({ 
        verified: false,
        error: error.message.includes('not found') 
          ? 'Transaction not found on blockchain' 
          : 'Failed to verify transaction on blockchain'
      })
    }
  } catch (error) {
    console.error('Error verifying transaction:', error)
    return c.json({ error: 'Failed to verify transaction' }, 500)
  }
})

// POST /api/votes/:voteId/update-transaction - Update vote with transaction hash (requires auth)
votesRouter.post('/:voteId/update-transaction', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const user = getAuthenticatedUser(c)
    const voteId = c.req.param('voteId')
    const { transactionHash, verify = true } = await c.req.json()
    
    if (!isValidTransactionHash(transactionHash)) {
      return c.json({ error: 'Invalid transaction hash' }, 400)
    }
    
    const db = c.env.DB
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Check if vote exists and belongs to user
    const { results: [vote] } = await db.prepare(`
      SELECT id, voter_fid, transaction_hash FROM votes WHERE id = ?
    `).bind(voteId).all()

    if (!vote) {
      return c.json({ error: 'Vote not found' }, 404)
    }

    if (vote.voter_fid !== user.fid) {
      return c.json({ error: 'Not authorized to update this vote' }, 403)
    }

    if (vote.transaction_hash) {
      return c.json({ error: 'Vote already has a transaction hash' }, 400)
    }

    // Optionally verify transaction before updating
    if (verify) {
      const blockchain = c.get('blockchain')
      if (blockchain) {
        try {
          const result = await verifyTransactionWithRetry(blockchain, transactionHash, 3)
          if (!result.verified) {
            return c.json({ error: 'Transaction verification failed' }, 400)
          }
        } catch (error) {
          console.error('Transaction verification failed:', error)
          return c.json({ error: 'Could not verify transaction on blockchain' }, 400)
        }
      }
    }

    // Update vote with transaction hash
    await db.prepare(`
      UPDATE votes SET transaction_hash = ? WHERE id = ?
    `).bind(transactionHash, voteId).run()

    return c.json({ 
      success: true, 
      message: 'Transaction hash updated successfully',
      vote_id: voteId,
      transaction_hash: transactionHash
    })
  } catch (error) {
    console.error('Error updating vote transaction:', error)
    return c.json({ error: 'Failed to update vote transaction' }, 500)
  }
})

// GET /api/votes/:voteId/status - Check vote transaction status
votesRouter.get('/:voteId/status', async (c) => {
  try {
    const voteId = c.req.param('voteId')
    const db = c.env.DB
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Get vote and transaction status
    const { results: [voteData] } = await db.prepare(`
      SELECT v.id, v.poll_id, v.voter_fid, v.option_index, v.transaction_hash, v.voted_at,
             vt.status as tx_status, vt.block_number, vt.verified_at
      FROM votes v
      LEFT JOIN vote_transactions vt ON v.transaction_hash = vt.transaction_hash
      WHERE v.id = ?
    `).bind(voteId).all()

    if (!voteData) {
      return c.json({ error: 'Vote not found' }, 404)
    }

    // If no transaction hash, vote is confirmed
    if (!voteData.transaction_hash) {
      return c.json({
        vote_id: voteId,
        status: 'confirmed',
        message: 'Vote confirmed (no blockchain transaction)'
      })
    }

    // If transaction status is already confirmed or failed, return that
    if (voteData.tx_status === 'confirmed') {
      return c.json({
        vote_id: voteId,
        status: 'confirmed',
        transaction_hash: voteData.transaction_hash,
        block_number: voteData.block_number,
        verified_at: voteData.verified_at,
        message: 'Vote confirmed on blockchain'
      })
    }

    if (voteData.tx_status === 'failed') {
      return c.json({
        vote_id: voteId,
        status: 'failed',
        transaction_hash: voteData.transaction_hash,
        message: 'Transaction failed on blockchain'
      })
    }

    // Transaction is pending, try to verify it now
    const blockchain = c.get('blockchain')
    if (!blockchain) {
      return c.json({
        vote_id: voteId,
        status: 'pending',
        transaction_hash: voteData.transaction_hash,
        message: 'Blockchain verification unavailable'
      })
    }

    try {
      // Try single verification attempt (don't use retry logic for polling)
      const transaction = await blockchain.getTransaction({ hash: voteData.transaction_hash })
      const receipt = await blockchain.getTransactionReceipt({ hash: voteData.transaction_hash })
      
      if (transaction && receipt) {
        const verified = receipt.status === 'success'
        const newStatus = verified ? 'confirmed' : 'failed'
        const now = Math.floor(Date.now() / 1000)

        // Update transaction status in database
        await db.prepare(`
          UPDATE vote_transactions 
          SET status = ?, block_number = ?, verified_at = ?
          WHERE transaction_hash = ?
        `).bind(newStatus, Number(receipt.blockNumber), now, voteData.transaction_hash).run()

        return c.json({
          vote_id: voteId,
          status: newStatus,
          transaction_hash: voteData.transaction_hash,
          block_number: Number(receipt.blockNumber),
          verified_at: now,
          message: verified ? 'Vote confirmed on blockchain' : 'Transaction failed on blockchain'
        })
      }

      // Transaction not found yet, still pending
      return c.json({
        vote_id: voteId,
        status: 'pending',
        transaction_hash: voteData.transaction_hash,
        message: 'Transaction not yet visible on blockchain'
      })

    } catch (error) {
      console.error('Error checking transaction status:', error)
      return c.json({
        vote_id: voteId,
        status: 'pending',
        transaction_hash: voteData.transaction_hash,
        message: 'Unable to verify transaction at this time'
      })
    }
  } catch (error) {
    console.error('Error checking vote status:', error)
    return c.json({ error: 'Failed to check vote status' }, 500)
  }
})

// GET /api/votes/pending - Get all pending transaction verifications (admin/debug)
votesRouter.get('/pending', async (c) => {
  try {
    const db = c.env.DB
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const { results: pendingVotes } = await db.prepare(`
      SELECT v.id as vote_id, v.poll_id, v.voter_fid, v.transaction_hash, 
             vt.status, vt.created_at, vt.verified_at,
             p.question as poll_question
      FROM votes v
      JOIN vote_transactions vt ON v.transaction_hash = vt.transaction_hash
      LEFT JOIN polls p ON v.poll_id = p.id
      WHERE vt.status = 'pending'
      ORDER BY vt.created_at DESC
      LIMIT 50
    `).all()

    return c.json({
      pending_votes: pendingVotes.results || [],
      count: pendingVotes.results?.length || 0
    })
  } catch (error) {
    console.error('Error fetching pending votes:', error)
    return c.json({ error: 'Failed to fetch pending votes' }, 500)
  }
})

export { votesRouter }