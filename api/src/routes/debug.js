import { Hono } from 'hono'
import { createImageGenerationService } from '../services/imageGeneration.js'
import { getPollWithDetails } from './polls.js'

const debugRouter = new Hono()

// POST /api/debug/regenerate-image/:pollId - Force regenerate poll image for testing
debugRouter.post('/regenerate-image/:pollId', async (c) => {
  try {
    const pollId = c.req.param('pollId')
    const db = c.env.DB
    const browser = c.env.BROWSER
    const r2 = c.env.IMAGES
    const neynar = c.get('neynar')
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }
    
    if (!browser) {
      return c.json({ error: 'Browser rendering not available' }, 503)
    }
    
    if (!r2) {
      return c.json({ error: 'Image storage not available' }, 503)
    }

    console.log(`🔄 Debug: Regenerating image for poll ${pollId}`)

    // Get poll details
    const poll = await getPollWithDetails(db, pollId, neynar)
    
    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }

    // Get recent voters for social proof (sorted by follower count)
    let voters = []
    if (neynar) {
      try {
        // Get recent voters from database
        const { results: recentVotes } = await db.prepare(`
          SELECT DISTINCT voter_fid 
          FROM votes 
          WHERE poll_id = ? 
          ORDER BY voted_at DESC 
          LIMIT 20
        `).bind(pollId).all()

        if (recentVotes.length > 0) {
          const voterFids = recentVotes.map(v => v.voter_fid)
          const voterProfiles = await neynar.getUsersByFids(voterFids)
          
          // Sort by follower count (descending) and take top 10
          voters = voterProfiles
            .sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0))
            .slice(0, 10)
          
          console.log(`📊 Found ${voters.length} voters for social proof`)
          console.log(`👥 Top voters by followers:`, voters.map(v => `${v.display_name} (${v.follower_count} followers)`))
        }
      } catch (error) {
        console.error('Failed to fetch voters for image:', error)
        // Continue without voters if fetch fails
      }
    }

    // Generate live image with current results
    const imageService = createImageGenerationService(browser, r2)
    const imageUrl = await imageService.generateLivePollImage(poll, poll.creator, voters)
    
    // Update poll with image URL
    await db.prepare(`
      UPDATE polls SET image_url = ? WHERE id = ?
    `).bind(imageUrl, pollId).run()

    console.log(`✅ Debug: Image regenerated successfully for poll ${pollId}`)

    return c.json({ 
      success: true,
      message: 'Image regenerated successfully',
      image_url: imageUrl,
      poll_id: pollId,
      poll_question: poll.question,
      total_votes: poll.total_votes,
      voters_count: voters.length,
      voters: voters.map(v => ({
        display_name: v.display_name,
        username: v.username,
        follower_count: v.follower_count
      }))
    })
    
  } catch (error) {
    console.error('Error regenerating poll image:', error)
    return c.json({ 
      error: 'Failed to regenerate poll image', 
      details: error.message 
    }, 500)
  }
})

// GET /api/debug/poll/:pollId - Get poll details for debugging
debugRouter.get('/poll/:pollId', async (c) => {
  try {
    const pollId = c.req.param('pollId')
    const db = c.env.DB
    const neynar = c.get('neynar')
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Get poll details
    const poll = await getPollWithDetails(db, pollId, neynar)
    
    if (!poll) {
      return c.json({ error: 'Poll not found' }, 404)
    }

    // Get recent voters
    const { results: recentVotes } = await db.prepare(`
      SELECT voter_fid, voted_at 
      FROM votes 
      WHERE poll_id = ? 
      ORDER BY voted_at DESC 
      LIMIT 20
    `).bind(pollId).all()

    let voters = []
    if (neynar && recentVotes.length > 0) {
      const voterFids = recentVotes.map(v => v.voter_fid)
      const voterProfiles = await neynar.getUsersByFids(voterFids)
      voters = voterProfiles.sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0))
    }

    return c.json({
      poll: {
        id: poll.id,
        question: poll.question,
        total_votes: poll.total_votes,
        status: poll.status,
        image_url: poll.image_url,
        creator: poll.creator,
        options: poll.options
      },
      voters: voters.map(v => ({
        fid: v.fid,
        display_name: v.display_name,
        username: v.username,
        follower_count: v.follower_count,
        pfp_url: v.pfp_url
      })),
      debug_info: {
        total_votes_in_db: recentVotes.length,
        voters_with_profiles: voters.length,
        image_generation_ready: !!(c.env.BROWSER && c.env.IMAGES)
      }
    })
    
  } catch (error) {
    console.error('Error fetching poll debug info:', error)
    return c.json({ 
      error: 'Failed to fetch poll debug info', 
      details: error.message 
    }, 500)
  }
})

export { debugRouter } 