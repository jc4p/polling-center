import { z } from 'zod'

export class ValidationError extends Error {
  constructor(message, details) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}

export class BlockchainError extends Error {
  constructor(message, transactionHash = null) {
    super(message)
    this.name = 'BlockchainError'
    this.transactionHash = transactionHash
  }
}

export function validateRequest(schema) {
  return async (c, next) => {
    try {
      let data
      const contentType = c.req.header('content-type')
      
      if (contentType && contentType.includes('application/json')) {
        data = await c.req.json()
      } else {
        data = c.req.query()
      }
      
      const validatedData = schema.parse(data)
      c.set('validatedData', validatedData)
      
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        }, 400)
      }
      throw error
    }
  }
}

export function handleErrors() {
  return async (c, next) => {
    try {
      await next()
    } catch (error) {
      console.error('Request error:', error)
      
      if (error instanceof ValidationError) {
        return c.json({
          error: error.message,
          details: error.details
        }, 400)
      }
      
      if (error instanceof BlockchainError) {
        return c.json({
          error: error.message,
          transactionHash: error.transactionHash
        }, 422)
      }
      
      return c.json({
        error: 'Internal server error',
        message: error.message
      }, 500)
    }
  }
}

// Common validation schemas
export const schemas = {
  ethereumAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  pollId: z.string().min(1),
  pagination: z.object({
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
    offset: z.string().transform(Number).pipe(z.number().min(0)).default('0')
  })
}