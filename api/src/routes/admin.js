import { Hono } from 'hono'
import { verifyTransactionWithRetry } from '../utils/blockchain.js'

const adminRouter = new Hono()

// POST /api/admin/verify-pending-transactions - Background job to verify pending transactions
adminRouter.post('/verify-pending-transactions', async (c) => {
  try {
    const db = c.env.DB
    const blockchain = c.get('blockchain')
    
    if (!db) {
      return c.json({ error: 'Database not available' }, 503)
    }
    
    if (!blockchain) {
      return c.json({ error: 'Blockchain client not available' }, 503)
    }

    // Get pending transactions (limit to avoid timeout)
    const { results: pendingTxs } = await db.prepare(`
      SELECT transaction_hash, vote_id, created_at
      FROM vote_transactions 
      WHERE status = 'pending'
      AND created_at > strftime('%s', 'now') - 3600  -- Only check transactions from last hour
      ORDER BY created_at DESC
      LIMIT 20
    `).all()

    if (!pendingTxs || pendingTxs.length === 0) {
      return c.json({ 
        message: 'No pending transactions to verify',
        processed: 0
      })
    }

    let processed = 0
    let confirmed = 0
    let failed = 0
    const results = []

    // Process each pending transaction
    for (const tx of pendingTxs) {
      try {
        console.log(`Verifying transaction: ${tx.transaction_hash}`)
        
        // Use single attempt (no retry for background job)
        const transaction = await blockchain.getTransaction({ hash: tx.transaction_hash })
        const receipt = await blockchain.getTransactionReceipt({ hash: tx.transaction_hash })
        
        if (transaction && receipt) {
          const verified = receipt.status === 'success'
          const newStatus = verified ? 'confirmed' : 'failed'
          const now = Math.floor(Date.now() / 1000)

          // Update transaction status
          await db.prepare(`
            UPDATE vote_transactions 
            SET status = ?, block_number = ?, verified_at = ?
            WHERE transaction_hash = ?
          `).bind(newStatus, Number(receipt.blockNumber), now, tx.transaction_hash).run()

          results.push({
            transaction_hash: tx.transaction_hash,
            vote_id: tx.vote_id,
            status: newStatus,
            block_number: Number(receipt.blockNumber)
          })

          if (verified) confirmed++
          else failed++
          processed++
        } else {
          // Transaction still not found, leave as pending
          results.push({
            transaction_hash: tx.transaction_hash,
            vote_id: tx.vote_id,
            status: 'still_pending',
            message: 'Transaction not yet visible'
          })
        }
      } catch (error) {
        console.error(`Error verifying ${tx.transaction_hash}:`, error.message)
        results.push({
          transaction_hash: tx.transaction_hash,
          vote_id: tx.vote_id,
          status: 'error',
          error: error.message
        })
      }
    }

    return c.json({
      message: 'Verification complete',
      total_pending: pendingTxs.length,
      processed,
      confirmed,
      failed,
      results
    })
  } catch (error) {
    console.error('Error in background verification:', error)
    return c.json({ error: 'Background verification failed' }, 500)
  }
})

export { adminRouter }