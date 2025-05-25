import { z } from 'zod'

const NEYNAR_API_URL = 'https://api.neynar.com/v2'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// Validation schema for Neynar user response
const neynarUserSchema = z.object({
  fid: z.number(),
  username: z.string().optional(),
  display_name: z.string().optional(),
  pfp_url: z.string().optional(),
  profile: z.object({
    bio: z.object({
      text: z.string().optional()
    }).optional()
  }).optional(),
  follower_count: z.number().optional(),
  following_count: z.number().optional(),
  power_badge: z.boolean().optional()
})

const neynarBulkResponseSchema = z.object({
  users: z.array(neynarUserSchema)
})

export class NeynarService {
  constructor(apiKey, db) {
    this.apiKey = apiKey
    this.db = db
  }

  async getUsersByFids(fids) {
    if (!Array.isArray(fids) || fids.length === 0) {
      return []
    }

    // Check cache first
    const cachedUsers = await this.getCachedUsers(fids)
    const uncachedFids = fids.filter(fid => !cachedUsers.find(u => u.fid === fid))

    let freshUsers = []
    
    // Fetch uncached users from Neynar API
    if (uncachedFids.length > 0) {
      try {
        freshUsers = await this.fetchUsersFromNeynar(uncachedFids)
        
        // Cache the fresh data
        await this.cacheUsers(freshUsers)
      } catch (error) {
        console.error('Error fetching from Neynar:', error)
        // Continue with cached data only
      }
    }

    // Combine cached and fresh data
    const allUsers = [...cachedUsers, ...freshUsers]
    
    // Return users in the same order as requested FIDs
    return fids.map(fid => allUsers.find(user => user.fid === fid)).filter(Boolean)
  }

  async getUserByFid(fid) {
    const users = await this.getUsersByFids([fid])
    return users[0] || null
  }

  async getCachedUsers(fids) {
    if (!this.db || fids.length === 0) return []

    try {
      const placeholders = fids.map(() => '?').join(',')
      const query = `
        SELECT fid, username, display_name, pfp_url, bio, 
               follower_count, following_count, power_badge,
               cached_at, expires_at
        FROM neynar_user_cache 
        WHERE fid IN (${placeholders}) 
        AND expires_at > strftime('%s', 'now')
      `
      
      const result = await this.db.prepare(query).bind(...fids).all()
      
      return result.results?.map(row => ({
        fid: row.fid,
        username: row.username,
        display_name: row.display_name,
        pfp_url: row.pfp_url,
        bio: row.bio,
        follower_count: row.follower_count,
        following_count: row.following_count,
        power_badge: Boolean(row.power_badge),
        cached_at: row.cached_at,
        expires_at: row.expires_at
      })) || []
    } catch (error) {
      console.error('Error reading user cache:', error)
      return []
    }
  }

  async fetchUsersFromNeynar(fids) {
    if (!this.apiKey || fids.length === 0) {
      throw new Error('Neynar API key required')
    }

    // Neynar allows up to 100 FIDs at once
    const chunks = this.chunkArray(fids, 100)
    const allUsers = []

    for (const chunk of chunks) {
      try {
        const response = await fetch(`${NEYNAR_API_URL}/farcaster/user/bulk?fids=${chunk.join(',')}`, {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Neynar API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        const validatedData = neynarBulkResponseSchema.parse(data)
        
        const processedUsers = validatedData.users.map(user => ({
          fid: user.fid,
          username: user.username || null,
          display_name: user.display_name || null,
          pfp_url: user.pfp_url || null,
          bio: user.profile?.bio?.text || null,
          follower_count: user.follower_count || 0,
          following_count: user.following_count || 0,
          power_badge: user.power_badge || false
        }))

        allUsers.push(...processedUsers)
      } catch (error) {
        console.error(`Error fetching FIDs ${chunk.join(',')}:`, error)
        // Continue with other chunks
      }
    }

    return allUsers
  }

  async cacheUsers(users) {
    if (!this.db || users.length === 0) return

    try {
      const now = Math.floor(Date.now() / 1000) // Unix timestamp
      const expiresAt = now + 86400 // 24 hours

      for (const user of users) {
        await this.db.prepare(`
          INSERT OR REPLACE INTO neynar_user_cache 
          (fid, username, display_name, pfp_url, bio, follower_count, 
           following_count, power_badge, cached_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          user.fid,
          user.username,
          user.display_name,
          user.pfp_url,
          user.bio,
          user.follower_count,
          user.following_count,
          user.power_badge ? 1 : 0,
          now,
          expiresAt
        ).run()
      }
    } catch (error) {
      console.error('Error caching users:', error)
    }
  }

  async clearExpiredCache() {
    if (!this.db) return

    try {
      await this.db.prepare(`
        DELETE FROM neynar_user_cache 
        WHERE expires_at < strftime('%s', 'now')
      `).run()
    } catch (error) {
      console.error('Error clearing expired cache:', error)
    }
  }

  chunkArray(array, size) {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

export function createNeynarService(apiKey, db) {
  return new NeynarService(apiKey, db)
}