import { launch } from '@cloudflare/playwright'
import { nanoid } from 'nanoid'

// Service for generating poll images using Playwright and storing in R2
export class ImageGenerationService {
  constructor(browser, r2Bucket) {
    this.browser = browser
    this.r2Bucket = r2Bucket
  }

  // Generate live poll image with current results (cache-busted for live updates)
  async generateLivePollImage(poll, creator, voters = []) {
    const html = this.generateLivePollImageHTML(poll, creator, voters)
    
    try {
      const playwright = await launch(this.browser, { keep_alive: 120000 }) // 2 minutes
      const page = await playwright.newPage()
      
      // Set viewport to 3:2 aspect ratio (1200x800 for high quality)
      await page.setViewportSize({ width: 1200, height: 800 })
      
      console.log('🖼️ Generating image for poll:', poll.id)
      console.log('👤 Creator data:', creator)
      
      console.log('🖼️ Generating image for poll:', poll.id)
      console.log('👤 Creator data:', creator)
      
      // Set content and wait for fonts to load
      await page.setContent(html, { waitUntil: 'networkidle' })
      
      // Take screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      })
      
      await playwright.close()
      
      // Upload to R2 with timestamp for cache busting
      const timestamp = Date.now()
      const filename = `poll-${poll.id}-${timestamp}.png`
      const key = `share-images/${filename}`
      
      await this.r2Bucket.put(key, screenshot, {
        httpMetadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=300, must-revalidate' // 5 minutes cache with revalidation
        }
      })

      // Clean up old versions of this poll's images (keep only the latest)
      await this.cleanupOldPollImages(poll.id, key)
      
      // Return public URL (assuming custom domain setup)
      return `https://images.polling.center/${key}`
      
    } catch (error) {
      console.error('Error generating live poll image:', error)
      throw new Error('Failed to generate live poll image')
    }
  }


  // Generate HTML for live poll image (shows current results with progress bars)
  generateLivePollImageHTML(poll, creator, voters = []) {
    const options = poll.options.map(option => {
      const percentage = poll.total_votes > 0 ? Math.round((option.vote_count / poll.total_votes) * 100) : 0
      return `
        <div class="result-option">
          <div class="option-header">
            <span class="option-text">${this.escapeHtml(option.text)}</span>
            <span class="option-percentage">${percentage}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="vote-count">${option.vote_count} votes</div>
        </div>
      `
    }).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Space Grotesk', sans-serif;
          background: #f9fcf8;
          width: 1200px;
          height: 800px;
          display: flex;
          flex-direction: column;
          padding: 40px;
          position: relative;
          overflow: hidden;
        }
        
        .header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 40px;
        }
        
        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #67974e;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 32px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        
        .avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #67974e;
          color: white;
          font-weight: 700;
          font-size: 32px;
        }
        
        .creator-info {
          flex: 1;
        }
        
        .creator-name {
          font-weight: 600;
          color: #121b0e;
          font-size: 32px;
          line-height: 1.2;
        }
        
        .creator-username {
          color: #67974e;
          font-size: 24px;
          margin-top: 4px;
        }
        
        .poll-question {
          font-size: 40px;
          font-weight: 600;
          color: #121b0e;
          line-height: 1.2;
          margin-bottom: 30px;
          max-height: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
        }
        
        .results {
          display: flex;
          flex-direction: column;
          gap: 30px;
          flex: 1;
        }
        
        .result-option {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .option-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .option-percentage {
          color: #4ab714;
          font-size: 36px;
          font-weight: 700;
        }
        
        .progress-bar {
          width: 100%;
          height: 20px;
          background: #ebf3e7;
          border-radius: 10px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #4ab714;
          border-radius: 10px;
          transition: width 0.3s ease;
        }
        
        .option-text {
          color: #121b0e;
          font-size: 28px;
          font-weight: 500;
          flex: 1;
        }
        
        .footer {
          margin-top: auto;
          padding-bottom: 60px;
        }
        
        .watermark {
          position: absolute;
          bottom: 20px;
          right: 30px;
          color: #67974e;
          font-size: 16px;
          font-weight: 500;
        }
        
        .voters-section {
          margin-top: 20px;
          margin-bottom: 20px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 15px;
          border: 1px solid #d7e7d0;
        }
        
        .voters-label {
          color: #67974e;
          font-size: 22px;
          font-weight: 600;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .voters-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          align-items: center;
          justify-content: center;
        }
        
        .voter-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #67974e;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          border: 4px solid #ffffff;
          box-shadow: 0 6px 12px rgba(0,0,0,0.2);
        }
        
        .voter-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #67974e;
          color: white;
          font-weight: 600;
          font-size: 26px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="avatar" ${creator?.pfp_url ? `style="background-image: url('${creator.pfp_url}')"` : ''}>
          ${!creator?.pfp_url ? `<div class="avatar-fallback">${creator?.display_name?.[0]?.toUpperCase() || creator?.username?.[0]?.toUpperCase() || '?'}</div>` : ''}
        </div>
        <div class="creator-info">
          <div class="creator-name">${this.escapeHtml(creator?.display_name || creator?.username || 'Anonymous')}</div>
          ${creator?.username ? `<div class="creator-username">@${this.escapeHtml(creator.username)}</div>` : ''}
        </div>
      </div>
      
      <div class="poll-question">
        ${this.escapeHtml(poll.question)}
      </div>
      
      <div class="results">
        ${options}
      </div>
      
      ${voters.length > 0 ? `
        <div class="voters-section">
          <div class="voters-label">Recent voters</div>
          <div class="voters-grid">
            ${voters.slice(0, 10).map(voter => `
              <div class="voter-avatar" ${voter.pfp_url ? `style="background-image: url('${this.escapeHtml(voter.pfp_url)}')"` : ''}>
                ${!voter.pfp_url ? `<div class="voter-avatar-fallback">${this.escapeHtml(voter.display_name?.[0]?.toUpperCase() || voter.username?.[0]?.toUpperCase() || '?')}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="footer"></div>
      
      <div class="watermark">polling.center</div>
    </body>
    </html>
    `
  }


  // Clean up old versions of poll images (keep only the latest)
  async cleanupOldPollImages(pollId, currentKey) {
    try {
      // List all images for this poll
      const prefix = `share-images/poll-${pollId}-`
      const listed = await this.r2Bucket.list({ prefix })
      
      if (listed.objects.length <= 1) {
        return // No old images to delete
      }
      
      // Sort by timestamp (filename contains timestamp)
      const sortedObjects = listed.objects
        .filter(obj => obj.key !== currentKey) // Don't delete the one we just created
        .sort((a, b) => {
          // Extract timestamp from filename: poll-{id}-{timestamp}.png
          const timestampA = parseInt(a.key.split('-').pop().split('.')[0])
          const timestampB = parseInt(b.key.split('-').pop().split('.')[0])
          return timestampB - timestampA // Newest first
        })
      
      // Delete all but keep the current one (already uploaded)
      const toDelete = sortedObjects // Delete all old versions
      
      if (toDelete.length > 0) {
        // Delete old images
        for (const obj of toDelete) {
          await this.r2Bucket.delete(obj.key)
        }
        console.log(`Cleaned up ${toDelete.length} old images for poll ${pollId}`)
      }
    } catch (error) {
      console.error(`Failed to cleanup old images for poll ${pollId}:`, error)
      // Don't throw - cleanup is not critical
    }
  }

  // Helper to escape HTML
  escapeHtml(text) {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}

// Factory function to create service
export function createImageGenerationService(browser, r2Bucket) {
  return new ImageGenerationService(browser, r2Bucket)
}