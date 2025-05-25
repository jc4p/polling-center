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

    // Generate live image with current results
    const imageService = createImageGenerationService(browser, r2)
    const imageUrl = await imageService.generateLivePollImage(poll, poll.creator)
    
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