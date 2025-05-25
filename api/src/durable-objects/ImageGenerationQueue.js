// Durable Object for managing image generation queue
export class ImageGenerationQueue {
  constructor(ctx, env) {
    this.ctx = ctx
    this.env = env
    this.queue = []
    this.isProcessing = false
    this.debounceTimers = new Map() // pollId -> timeout
    this.DEBOUNCE_DELAY = 2000 // 2 seconds
  }

  async fetch(request) {
    try {
      const url = new URL(request.url)
      const path = url.pathname

      if (request.method === 'POST' && path === '/add') {
        const task = await request.json()
        return this.addTask(task)
      }

      if (request.method === 'POST' && path === '/process') {
        return this.processQueue()
      }

      if (request.method === 'GET' && path === '/status') {
        return this.getStatus()
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('ImageGenerationQueue error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  async addTask(task) {
    const pollId = task.pollId
    
    // Clear existing debounce timer for this poll
    if (this.debounceTimers.has(pollId)) {
      clearTimeout(this.debounceTimers.get(pollId))
    }
    
    // Remove any existing queued tasks for this poll (we only need the latest)
    this.queue = this.queue.filter(queuedTask => queuedTask.pollId !== pollId)
    
    // Set up debounced task
    const timer = setTimeout(() => {
      // Add task to queue after debounce delay
      this.queue.push({
        ...task,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        status: 'queued'
      })
      
      // Remove from debounce map
      this.debounceTimers.delete(pollId)
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.ctx.waitUntil(this.processQueue())
      }
    }, this.DEBOUNCE_DELAY)
    
    this.debounceTimers.set(pollId, timer)

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Task debounced for ${this.DEBOUNCE_DELAY}ms`,
      queueLength: this.queue.length 
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return new Response(JSON.stringify({ message: 'No tasks to process' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift()
        
        try {
          await this.processTask(task)
          console.log(`Completed image generation task: ${task.id}`)
        } catch (error) {
          console.error(`Failed to process task ${task.id}:`, error)
          // Could implement retry logic here
        }
      }
    } finally {
      this.isProcessing = false
    }

    return new Response(JSON.stringify({ success: true, processed: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async processTask(task) {
    const { createImageGenerationService } = await import('../services/imageGeneration.js')
    const { getPollWithDetails } = await import('../routes/polls.js')
    
    const db = this.env.DB
    const browser = this.env.BROWSER
    const r2 = this.env.IMAGES
    
    if (!db || !browser || !r2) {
      throw new Error('Required services not available')
    }

    // Get poll data
    const poll = await getPollWithDetails(db, task.pollId, null) // No neynar in DO
    if (!poll) {
      throw new Error(`Poll ${task.pollId} not found`)
    }

    // Get creator info if available
    let creator = { 
      fid: poll.creator_fid, 
      username: null, 
      display_name: null, 
      pfp_url: null 
    }

    // Generate live image (always shows current results)
    const imageService = createImageGenerationService(browser, r2)
    const imageUrl = await imageService.generateLivePollImage(poll, creator)
    
    // Update poll with latest image URL (cache-busted for live updates)
    await db.prepare(`
      UPDATE polls SET image_url = ? WHERE id = ?
    `).bind(imageUrl, task.pollId).run()

    console.log(`Generated ${task.type} image for poll ${task.pollId}: ${imageUrl}`)
  }

  async getStatus() {
    return new Response(JSON.stringify({
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      debouncedPolls: Array.from(this.debounceTimers.keys()),
      debounceCount: this.debounceTimers.size,
      queue: this.queue.map(task => ({
        id: task.id,
        type: task.type,
        pollId: task.pollId,
        status: task.status,
        createdAt: task.createdAt
      }))
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}