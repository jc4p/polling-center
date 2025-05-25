import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createBlockchainClient } from './config/blockchain.js'
import { getConfig } from './config/env.js'
import { handleErrors } from './utils/validation.js'
import { createNeynarService } from './services/neynar.js'
import { createAuthMiddleware, createOptionalAuthMiddleware } from './middleware/auth.js'
import { pollsRouter } from './routes/polls.js'
import { votesRouter } from './routes/votes.js'
import { adminRouter } from './routes/admin.js'
import { imagesRouter } from './routes/images.js'
import { ImageGenerationQueue } from './durable-objects/ImageGenerationQueue.js'

const app = new Hono()

// Global error handling
app.use('*', handleErrors())

// Configuration and CORS middleware
app.use('*', async (c, next) => {
  try {
    const config = getConfig(c.env)
    c.set('config', config)
    
    // Set CORS headers dynamically
    const corsMiddleware = cors({
      origin: config.corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
    
    return corsMiddleware(c, next)
  } catch (error) {
    console.error('Configuration error:', error.message)
    return c.json({ error: 'Server configuration error' }, 500)
  }
})

// Middleware to add services to context
app.use('*', async (c, next) => {
  try {
    const config = c.get('config')
    
    // Add blockchain client
    if (config?.ALCHEMY_BASE_RPC_URL) {
      c.set('blockchain', createBlockchainClient(c.env))
    }
    
    // Add Neynar service (requires D1 database binding)
    if (config?.NEYNAR_API_KEY && c.env.DB) {
      c.set('neynar', createNeynarService(config.NEYNAR_API_KEY, c.env.DB))
    }
    
    // Add auth middleware creator
    if (config?.FRAME_DOMAIN) {
      c.set('createAuth', () => createAuthMiddleware(config.FRAME_DOMAIN))
      c.set('createOptionalAuth', () => createOptionalAuthMiddleware(config.FRAME_DOMAIN))
    }
    
  } catch (error) {
    console.error('Failed to initialize services:', error.message)
    // Don't fail the request, just log the error
  }
  await next()
})

// Health check
app.get('/', (c) => {
  const config = c.get('config')
  return c.json({ 
    message: 'Polling Center API',
    version: '1.0.0',
    environment: config?.ENVIRONMENT || 'unknown',
    services: {
      blockchain: c.get('blockchain') ? 'connected' : 'disconnected',
      neynar: c.get('neynar') ? 'connected' : 'disconnected',
      database: c.env.DB ? 'connected' : 'disconnected',
      auth: c.get('createAuth') ? 'configured' : 'not configured'
    },
    timestamp: new Date().toISOString()
  })
})

// Routes
app.route('/api/polls', pollsRouter)
app.route('/api/votes', votesRouter)
app.route('/api/admin', adminRouter)
app.route('/api', imagesRouter)

// Profile endpoint
app.get('/api/profile', async (c) => {
  try {
    // Apply auth middleware
    const createAuth = c.get('createAuth')
    if (createAuth) {
      await createAuth()(c, async () => {})
    }
    
    const { getAuthenticatedUser } = await import('./middleware/auth.js')
    const user = getAuthenticatedUser(c)
    const neynar = c.get('neynar')
    
    if (!neynar) {
      return c.json({ error: 'Profile service not available' }, 503)
    }

    // Get user profile from Neynar
    try {
      const users = await neynar.getUsersByFids([user.fid])
      if (users.length === 0) {
        return c.json({ error: 'User profile not found' }, 404)
      }

      const userData = users[0]
      return c.json({
        user: {
          fid: userData.fid,
          username: userData.username,
          display_name: userData.display_name,
          pfp_url: userData.pfp_url
        }
      })
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return c.json({ error: 'Failed to fetch user profile' }, 500)
    }
  } catch (error) {
    console.error('Error in profile endpoint:', error)
    return c.json({ error: 'Failed to get profile' }, 500)
  }
})

// Image queue status endpoint (for debugging)
app.get('/api/images/queue/status', async (c) => {
  try {
    const imageQueue = c.env.IMAGE_QUEUE
    if (!imageQueue) {
      return c.json({ error: 'Image queue not available' }, 503)
    }

    const { createImageQueueService } = await import('./services/imageQueue.js')
    const queueService = createImageQueueService(imageQueue)
    const status = await queueService.getQueueStatus()
    
    return c.json(status)
  } catch (error) {
    console.error('Error getting queue status:', error)
    return c.json({ error: 'Failed to get queue status' }, 500)
  }
})

// Error handling
app.onError((err, c) => {
  console.error('API Error:', err)
  return c.json({ 
    error: 'Internal Server Error',
    message: err.message 
  }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

export default app
export { ImageGenerationQueue }
