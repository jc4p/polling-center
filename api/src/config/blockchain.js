import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

export function createBlockchainClient(env) {
  if (!env.ALCHEMY_BASE_RPC_URL) {
    throw new Error('ALCHEMY_BASE_RPC_URL environment variable is required')
  }

  return createPublicClient({
    chain: base,
    transport: http(env.ALCHEMY_BASE_RPC_URL)
  })
}

export { base as baseChain }