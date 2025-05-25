import { createClient, Errors } from '@farcaster/quick-auth'

const quickAuthClient = createClient()

export function createAuthMiddleware(domain) {
  return async (c, next) => {
    const authorization = c.req.header('Authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401)
    }

    const token = authorization.split(' ')[1]
    
    if (!token) {
      return c.json({ error: 'Invalid authorization format' }, 401)
    }

    try {
      const payload = await quickAuthClient.verifyJwt({
        token,
        domain
      })

      // Set user info in context for use in routes
      c.set('user', {
        fid: payload.sub,           // Farcaster ID
        address: payload.address,   // Ethereum address
        iss: payload.iss,          // Issuer
        aud: payload.aud,          // Audience (domain)
        exp: payload.exp,          // Expiration
        iat: payload.iat           // Issued at
      })

      await next()
    } catch (error) {
      console.error('JWT verification failed:', error)
      
      if (error instanceof Errors.InvalidTokenError) {
        return c.json({ error: 'Invalid or expired token' }, 401)
      }
      
      return c.json({ error: 'Authentication failed' }, 401)
    }
  }
}

// Middleware for optional authentication (for public endpoints that can benefit from user context)
export function createOptionalAuthMiddleware(domain) {
  return async (c, next) => {
    const authorization = c.req.header('Authorization')
    
    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.split(' ')[1]
      
      try {
        const payload = await quickAuthClient.verifyJwt({
          token,
          domain
        })

        c.set('user', {
          fid: payload.sub,
          address: payload.address,
          iss: payload.iss,
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat
        })
      } catch (error) {
        // Ignore auth errors for optional middleware
        console.log('Optional auth failed:', error.message)
      }
    }

    await next()
  }
}

// Helper function to get authenticated user from context
export function getAuthenticatedUser(c) {
  const user = c.get('user')
  if (!user) {
    throw new Error('User not authenticated')
  }
  return user
}

// Helper function to get user FID (works with both authenticated and optional auth)
export function getUserFid(c) {
  const user = c.get('user')
  return user?.fid || null
}