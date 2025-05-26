// Onchain verification service for poll creation and voting
import { decodeEventLog, parseAbi } from 'viem'
import { verifyTransactionWithRetry, isValidTransactionHash } from '../utils/blockchain.js'

// Smart contract ABI for event parsing
const POLLS_CONTRACT_ABI = parseAbi([
  'event PollCreated(string indexed pollId, uint256 indexed creatorFid, uint8 durationDays, uint8 optionCount)',
  'event VoteCast(string indexed pollId, uint256 indexed voterFid, uint8 optionIndex)',
  'function createPoll(string calldata pollId, uint256 creatorFid, uint8 durationDays, uint8 optionCount) external',
  'function submitVote(string calldata pollId, uint8 optionIndex, uint256 voterFid) external'
])

/**
 * Verify poll creation transaction and extract event data
 * @param {Object} blockchain - viem public client
 * @param {string} transactionHash - Transaction hash to verify
 * @param {string} expectedPollId - Expected poll ID
 * @param {number} expectedCreatorFid - Expected creator FID
 * @param {number} expectedDurationDays - Expected duration
 * @param {number} expectedOptionCount - Expected option count
 * @param {string} contractAddress - Contract address (optional, for future use)
 * @returns {Promise<{verified: boolean, pollCreationData?: Object, error?: string}>}
 */
export async function verifyPollCreationTransaction(
  blockchain, 
  transactionHash, 
  expectedPollId, 
  expectedCreatorFid, 
  expectedDurationDays, 
  expectedOptionCount,
  contractAddress = null
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
    
    if (!receipt.logs || receipt.logs.length === 0) {
      return { verified: false, error: 'No events found in transaction' }
    }

    // Parse logs to find PollCreated event
    let pollCreatedEvent = null
    
    for (const log of receipt.logs) {
      try {
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
    const { pollId, creatorFid, durationDays, optionCount } = pollCreatedEvent.args

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

    if (Number(durationDays) !== expectedDurationDays) {
      return { 
        verified: false, 
        error: `Duration mismatch: expected ${expectedDurationDays}, got ${durationDays}` 
      }
    }

    if (Number(optionCount) !== expectedOptionCount) {
      return { 
        verified: false, 
        error: `Option count mismatch: expected ${expectedOptionCount}, got ${optionCount}` 
      }
    }

    console.log(`✅ Poll creation verified: ${pollId}`)

    return {
      verified: true,
      pollCreationData: {
        pollId: pollId,
        creatorFid: Number(creatorFid),
        durationDays: Number(durationDays),
        optionCount: Number(optionCount),
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
 * @param {string} contractAddress - Contract address (optional, for future use)
 * @returns {Promise<{verified: boolean, voteData?: Object, error?: string}>}
 */
export async function verifyVoteTransaction(
  blockchain, 
  transactionHash, 
  expectedPollId, 
  expectedVoterFid, 
  expectedOptionIndex,
  contractAddress = null
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
    
    if (!receipt.logs || receipt.logs.length === 0) {
      return { verified: false, error: 'No events found in transaction' }
    }

    // Parse logs to find VoteCast event
    let voteCastEvent = null
    
    for (const log of receipt.logs) {
      try {
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
    const { pollId, voterFid, optionIndex } = voteCastEvent.args

    if (pollId !== expectedPollId) {
      return { 
        verified: false, 
        error: `Poll ID mismatch: expected ${expectedPollId}, got ${pollId}` 
      }
    }

    if (Number(voterFid) !== expectedVoterFid) {
      return { 
        verified: false, 
        error: `Voter FID mismatch: expected ${expectedVoterFid}, got ${voterFid}` 
      }
    }

    if (Number(optionIndex) !== expectedOptionIndex) {
      return { 
        verified: false, 
        error: `Option index mismatch: expected ${expectedOptionIndex}, got ${optionIndex}` 
      }
    }

    console.log(`✅ Vote verified: ${pollId} - option ${optionIndex} by FID ${voterFid}`)

    return {
      verified: true,
      voteData: {
        pollId: pollId,
        voterFid: Number(voterFid),
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