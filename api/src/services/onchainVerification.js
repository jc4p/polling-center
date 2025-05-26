// Onchain verification service for poll creation and voting
import { decodeEventLog, parseAbi } from 'viem'
import { verifyTransactionWithRetry, isValidTransactionHash } from '../utils/blockchain.js'

// Smart contract ABI for event parsing - matches deployed PollingCenter contract
const POLLS_CONTRACT_ABI = parseAbi([
  'event PollCreated(string indexed pollId, address indexed creator, uint256 indexed creatorFid, uint256 expiresAt)',
  'event VoteCast(string indexed pollId, address indexed voter, uint256 indexed fid, uint256 optionIndex)',
  'function createPoll(string calldata pollId, uint256 creatorFid, uint256 durationDays, uint256 optionCount) external',
  'function submitVote(string calldata pollId, uint256 optionIndex, uint256 voterFid) external'
])

/**
 * Verify poll creation transaction and extract event data
 * @param {Object} blockchain - viem public client
 * @param {string} transactionHash - Transaction hash to verify
 * @param {string} expectedPollId - Expected poll ID
 * @param {number} expectedCreatorFid - Expected creator FID
 * @param {number} expectedDurationDays - Expected duration
 * @param {number} expectedOptionCount - Expected option count
 * @param {string} contractAddress - Contract address to verify transaction against
 * @returns {Promise<{verified: boolean, pollCreationData?: Object, error?: string}>}
 */
export async function verifyPollCreationTransaction(
  blockchain, 
  transactionHash, 
  expectedPollId, 
  expectedCreatorFid, 
  expectedDurationDays, 
  expectedOptionCount,
  contractAddress
) {
  try {
    if (!isValidTransactionHash(transactionHash)) {
      return { verified: false, error: 'Invalid transaction hash format' }
    }

    console.log(`Verifying poll creation transaction: ${transactionHash}`)
    console.log(`Expected: pollId=${expectedPollId}, creatorFid=${expectedCreatorFid}, duration=${expectedDurationDays}, options=${expectedOptionCount}`)

    // Get transaction receipt with retry logic
    const verificationResult = await verifyTransactionWithRetry(blockchain, transactionHash)
    
    if (!verificationResult.verified) {
      return { verified: false, error: 'Transaction failed or reverted' }
    }

    const receipt = await blockchain.getTransactionReceipt({ hash: transactionHash })
    
    // Verify transaction was sent to the correct contract
    if (contractAddress && receipt.to && receipt.to.toLowerCase() !== contractAddress.toLowerCase()) {
      return { verified: false, error: `Transaction sent to wrong contract: expected ${contractAddress}, got ${receipt.to}` }
    }
    
    if (!receipt.logs || receipt.logs.length === 0) {
      return { verified: false, error: 'No events found in transaction' }
    }

    // Parse logs to find PollCreated event
    let pollCreatedEvent = null
    
    for (const log of receipt.logs) {
      try {
        // Only check logs from our contract address
        if (contractAddress && log.address.toLowerCase() !== contractAddress.toLowerCase()) {
          continue
        }
        
        const decodedLog = decodeEventLog({
          abi: POLLS_CONTRACT_ABI,
          data: log.data,
          topics: log.topics
        })
        
        if (decodedLog.eventName === 'PollCreated') {
          pollCreatedEvent = decodedLog
          break
        }
      } catch (error) {
        // Skip logs that don't match our ABI
        continue
      }
    }

    if (!pollCreatedEvent) {
      return { verified: false, error: 'PollCreated event not found in transaction' }
    }

    // Verify event parameters match expected values
    const { pollId, creator, creatorFid, expiresAt } = pollCreatedEvent.args
    
    // Calculate expected expiration based on duration
    const transaction = await blockchain.getTransaction({ hash: transactionHash })
    const block = await blockchain.getBlock({ blockNumber: receipt.blockNumber })
    const expectedExpiresAt = Number(block.timestamp) + (expectedDurationDays * 24 * 60 * 60)

    if (pollId !== expectedPollId) {
      return { 
        verified: false, 
        error: `Poll ID mismatch: expected ${expectedPollId}, got ${pollId}` 
      }
    }

    if (Number(creatorFid) !== expectedCreatorFid) {
      return { 
        verified: false, 
        error: `Creator FID mismatch: expected ${expectedCreatorFid}, got ${creatorFid}` 
      }
    }

    // Verify expiration time is within reasonable range (allow for block time variance)
    const timeDiff = Math.abs(Number(expiresAt) - expectedExpiresAt)
    if (timeDiff > 300) { // Allow 5 minute variance
      return { 
        verified: false, 
        error: `Expiration time mismatch: expected around ${expectedExpiresAt}, got ${expiresAt}` 
      }
    }

    // Note: optionCount is validated in the contract but not emitted in the event

    console.log(`✅ Poll creation verified: ${pollId}`)

    return {
      verified: true,
      pollCreationData: {
        pollId: pollId,
        creator: creator,
        creatorFid: Number(creatorFid),
        expiresAt: Number(expiresAt),
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash,
        transactionHash: receipt.transactionHash,
        gasUsed: Number(receipt.gasUsed)
      }
    }

  } catch (error) {
    console.error('Poll creation verification failed:', error)
    return { verified: false, error: error.message }
  }
}

/**
 * Verify vote transaction and extract event data
 * @param {Object} blockchain - viem public client
 * @param {string} transactionHash - Transaction hash to verify
 * @param {string} expectedPollId - Expected poll ID
 * @param {number} expectedVoterFid - Expected voter FID
 * @param {number} expectedOptionIndex - Expected option index
 * @param {string} contractAddress - Contract address to verify transaction against
 * @returns {Promise<{verified: boolean, voteData?: Object, error?: string}>}
 */
export async function verifyVoteTransaction(
  blockchain, 
  transactionHash, 
  expectedPollId, 
  expectedVoterFid, 
  expectedOptionIndex,
  contractAddress
) {
  try {
    if (!isValidTransactionHash(transactionHash)) {
      return { verified: false, error: 'Invalid transaction hash format' }
    }

    console.log(`Verifying vote transaction: ${transactionHash}`)
    console.log(`Expected: pollId=${expectedPollId}, voterFid=${expectedVoterFid}, optionIndex=${expectedOptionIndex}`)

    // Get transaction receipt with retry logic
    const verificationResult = await verifyTransactionWithRetry(blockchain, transactionHash)
    
    if (!verificationResult.verified) {
      return { verified: false, error: 'Transaction failed or reverted' }
    }

    const receipt = await blockchain.getTransactionReceipt({ hash: transactionHash })
    
    // Verify transaction was sent to the correct contract
    if (contractAddress && receipt.to && receipt.to.toLowerCase() !== contractAddress.toLowerCase()) {
      return { verified: false, error: `Transaction sent to wrong contract: expected ${contractAddress}, got ${receipt.to}` }
    }
    
    if (!receipt.logs || receipt.logs.length === 0) {
      return { verified: false, error: 'No events found in transaction' }
    }

    // Parse logs to find VoteCast event
    let voteCastEvent = null
    
    for (const log of receipt.logs) {
      try {
        // Only check logs from our contract address
        if (contractAddress && log.address.toLowerCase() !== contractAddress.toLowerCase()) {
          continue
        }
        
        const decodedLog = decodeEventLog({
          abi: POLLS_CONTRACT_ABI,
          data: log.data,
          topics: log.topics
        })
        
        if (decodedLog.eventName === 'VoteCast') {
          voteCastEvent = decodedLog
          break
        }
      } catch (error) {
        // Skip logs that don't match our ABI
        continue
      }
    }

    if (!voteCastEvent) {
      return { verified: false, error: 'VoteCast event not found in transaction' }
    }

    // Verify event parameters match expected values
    const { pollId, voter, fid, optionIndex } = voteCastEvent.args

    if (pollId !== expectedPollId) {
      return { 
        verified: false, 
        error: `Poll ID mismatch: expected ${expectedPollId}, got ${pollId}` 
      }
    }

    if (Number(fid) !== expectedVoterFid) {
      return { 
        verified: false, 
        error: `Voter FID mismatch: expected ${expectedVoterFid}, got ${fid}` 
      }
    }

    if (Number(optionIndex) !== expectedOptionIndex) {
      return { 
        verified: false, 
        error: `Option index mismatch: expected ${expectedOptionIndex}, got ${optionIndex}` 
      }
    }

    console.log(`✅ Vote verified: ${pollId} - option ${optionIndex} by FID ${fid}`)

    return {
      verified: true,
      voteData: {
        pollId: pollId,
        voter: voter,
        voterFid: Number(fid),
        optionIndex: Number(optionIndex),
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash,
        transactionHash: receipt.transactionHash,
        gasUsed: Number(receipt.gasUsed)
      }
    }

  } catch (error) {
    console.error('Vote verification failed:', error)
    return { verified: false, error: error.message }
  }
}

/**
 * Generic transaction verification with event parsing
 * @param {Object} blockchain - viem public client
 * @param {string} transactionHash - Transaction hash to verify
 * @returns {Promise<{verified: boolean, events?: Array, transaction?: Object, error?: string}>}
 */
export async function verifyTransactionAndParseEvents(blockchain, transactionHash) {
  try {
    if (!isValidTransactionHash(transactionHash)) {
      return { verified: false, error: 'Invalid transaction hash format' }
    }

    const verificationResult = await verifyTransactionWithRetry(blockchain, transactionHash)
    
    if (!verificationResult.verified) {
      return { verified: false, error: 'Transaction failed or reverted' }
    }

    const receipt = await blockchain.getTransactionReceipt({ hash: transactionHash })
    const parsedEvents = []

    if (receipt.logs) {
      for (const log of receipt.logs) {
        try {
          const decodedLog = decodeEventLog({
            abi: POLLS_CONTRACT_ABI,
            data: log.data,
            topics: log.topics
          })
          parsedEvents.push(decodedLog)
        } catch (error) {
          // Skip logs that don't match our ABI
          continue
        }
      }
    }

    return {
      verified: true,
      events: parsedEvents,
      transaction: verificationResult.transaction
    }

  } catch (error) {
    console.error('Transaction verification failed:', error)
    return { verified: false, error: error.message }
  }
}