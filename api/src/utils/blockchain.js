// Blockchain utility functions with retry logic

export async function verifyTransactionWithRetry(blockchain, transactionHash, maxRetries = 5) {
  let attempt = 0
  const baseDelay = 1000 // Start with 1 second
  
  while (attempt < maxRetries) {
    try {
      console.log(`Verifying transaction attempt ${attempt + 1}/${maxRetries}: ${transactionHash}`)
      
      // Try to get transaction and receipt
      const [transaction, receipt] = await Promise.all([
        blockchain.getTransaction({ hash: transactionHash }),
        blockchain.getTransactionReceipt({ hash: transactionHash })
      ])
      
      if (transaction && receipt) {
        const verified = receipt.status === 'success'
        
        return {
          verified,
          transaction: {
            hash: transaction.hash,
            blockNumber: Number(receipt.blockNumber),
            blockHash: receipt.blockHash,
            status: receipt.status,
            gasUsed: Number(receipt.gasUsed),
            confirmations: receipt.blockNumber ? 1 : 0
          }
        }
      }
      
      // Transaction not found yet, but don't throw error on early attempts
      if (attempt === maxRetries - 1) {
        throw new Error(`Transaction not found after ${maxRetries} attempts`)
      }
      
    } catch (error) {
      console.log(`Verification attempt ${attempt + 1} failed:`, error.message)
      
      // If it's the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error
      }
    }
    
    // Calculate exponential backoff delay
    const delay = baseDelay * Math.pow(2, attempt)
    console.log(`Waiting ${delay}ms before next attempt...`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    attempt++
  }
  
  throw new Error(`Transaction verification failed after ${maxRetries} attempts`)
}

export async function waitForTransactionConfirmation(blockchain, transactionHash, requiredConfirmations = 1) {
  const maxWaitTime = 300000 // 5 minutes max wait
  const pollInterval = 250 // Check every 0.25 seconds
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const receipt = await blockchain.getTransactionReceipt({ hash: transactionHash })
      
      if (receipt && receipt.blockNumber) {
        const latestBlock = await blockchain.getBlockNumber()
        const confirmations = Number(latestBlock) - Number(receipt.blockNumber) + 1
        
        if (confirmations >= requiredConfirmations) {
          return {
            confirmed: true,
            blockNumber: Number(receipt.blockNumber),
            confirmations,
            status: receipt.status
          }
        }
        
        console.log(`Transaction ${transactionHash} has ${confirmations}/${requiredConfirmations} confirmations`)
      }
    } catch (error) {
      console.log('Error checking confirmation:', error.message)
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
  
  throw new Error(`Transaction confirmation timeout after ${maxWaitTime}ms`)
}

export function isValidTransactionHash(hash) {
  return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash)
}

export function isValidAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address)
}