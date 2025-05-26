import { z } from 'zod'

const envSchema = z.object({
  ALCHEMY_BASE_RPC_URL: z.string().url('ALCHEMY_BASE_RPC_URL must be a valid URL'),
  NEYNAR_API_KEY: z.string().min(1, 'NEYNAR_API_KEY is required'),
  FRAME_DOMAIN: z.string().min(1, 'FRAME_DOMAIN is required for JWT verification'),
  POLLS_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'POLLS_CONTRACT_ADDRESS must be a valid Ethereum address'),
  ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  CORS_ORIGINS: z.string().optional().transform(val => 
    val ? val.split(',').map(s => s.trim()) : []
  ),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
})

export function validateEnv(env) {
  try {
    return envSchema.parse(env)
  } catch (error) {
    console.error('Environment validation failed:', error.errors)
    throw new Error(`Invalid environment configuration: ${error.errors.map(e => e.message).join(', ')}`)
  }
}

export function getConfig(env) {
  const validatedEnv = validateEnv(env)
  
  return {
    ...validatedEnv,
    isDevelopment: validatedEnv.ENVIRONMENT === 'development',
    isProduction: validatedEnv.ENVIRONMENT === 'production',
    corsOrigins: validatedEnv.CORS_ORIGINS.length > 0 
      ? validatedEnv.CORS_ORIGINS 
      : ['http://localhost:3000', 'https://polling.center', 'https://*.polling.center']
  }
}