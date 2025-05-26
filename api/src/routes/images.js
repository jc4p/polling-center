import { Hono } from 'hono'
import { createImageGenerationService } from '../services/imageGeneration.js'
import { getPollWithDetails } from './polls.js'

const imagesRouter = new Hono()

// GET /api/polls/:id/image - Generate live poll image with current results
imagesRouter.get('/polls/:id/image', async (c) => {
  try {
    const pollId = c.req.param('id')
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

    return c.json({ 
      success: true,
      image_url: imageUrl,
      poll_id: pollId
    })
    
  } catch (error) {
    console.error('Error generating poll image:', error)
    return c.json({ error: 'Failed to generate poll image' }, 500)
  }
})


export { imagesRouter }