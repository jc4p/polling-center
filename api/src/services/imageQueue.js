// Service to queue image generation tasks via Durable Objects
export class ImageQueueService {
  constructor(imageQueueBinding) {
    this.imageQueueBinding = imageQueueBinding
  }

  async queueLiveImage(pollId) {
    const id = this.imageQueueBinding.idFromName('image-queue')
    const stub = this.imageQueueBinding.get(id)
    
    return await stub.fetch('http://internal/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'live',
        pollId: pollId
      })
    })
  }

  async getQueueStatus() {
    const id = this.imageQueueBinding.idFromName('image-queue')
    const stub = this.imageQueueBinding.get(id)
    
    const response = await stub.fetch('http://internal/status')
    return await response.json()
  }
}

export function createImageQueueService(imageQueueBinding) {
  return new ImageQueueService(imageQueueBinding)
}