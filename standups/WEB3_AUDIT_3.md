# Web3 Audit #3 - Onchain Contract Structure & UX Integration

## Executive Summary

This audit analyzes the polling center's Web3 integration requirements based on the current implementation. The platform currently operates with an offchain database as the source of truth while supporting optional transaction hashes. This audit proposes a **hybrid onchain-offchain architecture** that maintains fast UX while adding verifiable onchain voting.

**Key Recommendation**: Implement onchain voting using smart contracts with the existing database as a fast-access cache layer, enabling both immediate UX responsiveness and blockchain verifiability.

Claude Code Summary:
Total cost:            $3.01
Total duration (API):  31m 23.3s
Total duration (wall): 39m 18.1s
Total code changes:    2828 lines added, 911 lines removed
Token usage by model:
  claude-3-5-haiku:  253.5k input, 6.0k output, 0 cache read, 0 cache write
  claude-sonnet:  2.3k input, 56.9k output, 4.5m cache read, 156.2k cache write

---

## Current Architecture Analysis

### **Frontend State** (Production Ready)
- ✅ **Frame V2 Integration**: Complete with dynamic metadata and authentication
- ✅ **Authentication**: Frame Quick Auth with JWT token management
- ✅ **UX Flow**: Poll creation → Voting → Results → Sharing
- ⚠️ **Web3 Gap**: No wallet connection or transaction submission capability

### **Backend State** (Production Ready)
- ✅ **API Complete**: All CRUD operations for polls and votes
- ✅ **Database Schema**: Vote tracking with optional `transaction_hash` field
- ✅ **Blockchain Integration**: viem + Alchemy Base network client
- ✅ **Transaction Verification**: Background verification with retry logic
- ⚠️ **Smart Contract Gap**: No contract deployment or interaction

### **Database Structure Analysis**
```sql
-- Existing schema supports hybrid model
CREATE TABLE votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    voter_fid INTEGER NOT NULL,
    option_index INTEGER NOT NULL,
    transaction_hash TEXT,        -- Currently optional
    voted_at INTEGER NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(id)
);

CREATE TABLE vote_transactions (
    id TEXT PRIMARY KEY,
    vote_id TEXT NOT NULL,
    transaction_hash TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, confirmed, failed
    block_number INTEGER,
    verified_at INTEGER,
    FOREIGN KEY (vote_id) REFERENCES votes(id)
);
```

---

## Simplified Smart Contract Architecture

### **Core Contract: PollsManager.sol** 
**Full implementation available in:** `docs/WEB3_FRONTEND_INTEGRATION_ENHANCED.md`

**Key Features:**
- **Dead Simple**: No backend signatures, no nonces, no complex validation
- **Solmate Integration**: Uses `Owned` and `ReentrancyGuard` for security
- **Solady Optimization**: Uses `LibBitmap` for gas-efficient vote tracking
- **Dual Prevention**: Prevents double voting by both wallet address and Farcaster FID
- **Minimal Storage**: Only essential data onchain, full poll data in database

**Core Functions:**
- `createPoll(pollId, creatorFid, durationDays, optionCount)` - Direct poll creation
- `submitVote(pollId, optionIndex, voterFid)` - Direct vote submission
- `usedPollIds` mapping prevents duplicate poll IDs
- Bitmap-based vote tracking for gas efficiency

### **Contract Deployment Specification**
- **Network**: Base Mainnet (chainId: 8453)
- **Dependencies**: Solmate, Solady (gas-optimized libraries)
- **Access Control**: Simple owner-based admin functions
- **No Upgradability**: Keep it simple, deploy new contract if needed

---

## UX Integration Points

### **1. Dead Simple Poll Creation**
```
New Flow: Create Form → Smart Contract Call → POST /api/polls (with tx hash) → Database
```

**UX States:**
- `idle`: Ready to create poll
- `onchain`: "Creating poll onchain..." 
- `saving`: "Saving poll data..."
- `complete`: Poll created, redirect to poll page

**No Complexity:** No signatures, no gas estimation, no fallbacks needed

### **2. Dead Simple Voting**
```
New Flow: Vote Button → Smart Contract Call → POST /api/polls/:id/vote (with tx hash) → Database  
```

**UX States:**
- `idle`: Ready to vote
- `onchain`: "Submitting vote onchain..."
- `confirming`: "Confirming transaction..."
- `complete`: Vote recorded, show share modal

**No Complexity:** Base is cheap, no gas warnings needed

### **3. UI Gating Strategy**
```
Display Logic: Only show polls/votes that have transaction hashes from mini app usage
```

**Benefits:**
- Onchain verification without forcing onchain usage
- Users can vote directly on contract but won't see results in UI
- Clean separation between "official" and "external" interactions

---

## Frame V2 Integration with ethProvider

**Detailed implementation available in:** `docs/WEB3_FRONTEND_INTEGRATION_ENHANCED.md`

### **Key Integration Patterns**
- **viem for encoding**: Transaction data construction and ABI handling
- **ethProvider for connection**: Uses Frame SDK's `frame.sdk.wallet.ethProvider` 
- **Limited methods**: Only supports `eth_sendTransaction` and `wallet_switchEthereumChain`
- **No gas estimation**: Base is cheap, ethProvider doesn't support `eth_estimateGas`
- **No contract reading**: All data comes from database API

### **Simplified Architecture**
```javascript
// Pattern: viem encodes, ethProvider sends
const data = encodeFunctionData({abi, functionName, args}); 
const txHash = await ethProvider.request({method: 'eth_sendTransaction', params: [{from, to, data}]});
```

---

## Backend Integration Requirements

### **Simplified API Endpoints**

#### `POST /api/polls` (Enhanced)
```javascript
// Input: Include transaction hash from contract creation
{
  question: string,
  options: string[],
  duration: '1' | '3' | '7',
  transactionHash: string,     // REQUIRED: Onchain creation tx
  pollId: string,              // Must match contract pollId  
  creatorFid: number
}

// Process: Verify transaction before creating poll
const verified = await verifyPollCreationTransaction(transactionHash, pollId, creatorAddress, creatorFid);
if (!verified) throw new Error('Invalid poll creation transaction');
```

#### `POST /api/polls/:id/vote` (Enhanced)  
```javascript
// Input: Require transaction hash
{
  optionIndex: number,
  transactionHash: string,     // REQUIRED: Onchain vote tx
  voterFid: number
}

// Process: Verify vote transaction before recording
const verified = await verifyVoteTransaction(transactionHash, pollId, voterAddress, voterFid, optionIndex);
if (!verified) throw new Error('Invalid vote transaction');
```

### **Database Schema Updates**
```sql
-- Enhanced polls table with onchain tracking
ALTER TABLE polls ADD COLUMN creation_tx TEXT;           -- Onchain poll creation transaction
ALTER TABLE polls ADD COLUMN onchain_poll_id TEXT;       -- Links to contract pollId

-- Enhanced votes table
ALTER TABLE votes ADD COLUMN verification_status TEXT DEFAULT 'verified'; -- All onchain votes are verified
```

### **Simplified Contract Verification Service**
**Full implementation available in:** `docs/WEB3_FRONTEND_INTEGRATION_ENHANCED.md`

**Key Features:**
- **Event parsing**: Decode `PollCreated` and `VoteCast` events from transaction receipts
- **Parameter validation**: Verify transaction parameters match expected values
- **No signature complexity**: Direct event verification only
- **Database integration**: Update verification status after confirmation

---

## Implementation Plan

### **Phase 1: Smart Contract Development** (1-2 days)
1. **Contract Development**: Simple PollsManager.sol with Solmate/Solady
2. **Deploy to Base**: Testnet first, then mainnet
3. **ABI Export**: Generate TypeScript ABI for frontend
4. **Verification**: Verify contract on Basescan

### **Phase 2: Frontend Integration** (1-2 days)  
1. **Blockchain Client**: viem + ethProvider integration
2. **Contract Calls**: Direct createPoll/submitVote functions
3. **UX States**: Simple loading states for onchain operations
4. **API Integration**: Enhanced endpoints with transaction hashes

### **Phase 3: Backend Integration** (1 day)
1. **Event Verification**: Parse transaction receipts for events
2. **API Enhancement**: Require transaction hashes for poll/vote endpoints
3. **Database Updates**: Add transaction hash columns
4. **Error Handling**: Reject invalid transactions

### **Phase 4: Testing & Launch** (1 day)
1. **End-to-End Testing**: Full user flows on Base testnet
2. **Production Deploy**: Contract + API + frontend
3. **UI Verification**: Confirm only mini-app polls show in UI
4. **Monitor**: Watch for any integration issues

**Total Estimated Time: 4-6 days**

---

## Technical Specifications

### **Gas Cost Estimates** (Base Network)
- **Poll Creation**: ~80,000 gas (~$0.01 at Base rates)
- **Vote Submission**: ~60,000 gas (~$0.008 at Base rates)  
- **No Gas UI**: Base is cheap enough to not show gas estimates

### **Smart Contract Security**
- **Reentrancy Protection**: Solmate's ReentrancyGuard
- **Access Control**: Simple owner-based permissions
- **Input Validation**: Basic validation on all public functions
- **Event Logging**: PollCreated and VoteCast events for verification
- **Duplicate Prevention**: usedPollIds and bitmap voting tracking

### **Data Flow**
- **Primary Display**: Database for fast UI rendering
- **Verification Source**: Smart contract events via transaction hash
- **UI Gating**: Only transactions from mini app appear in UI
- **No Sync Jobs**: Real-time verification during API calls

---

## Migration Strategy

### **Backward Compatibility**
- **Existing polls**: Continue working as offchain-only
- **New polls**: All created onchain via mini app
- **No breaking changes**: Database schema additions only

### **Database Migration**
```sql
-- Simple additions to existing schema
ALTER TABLE polls ADD COLUMN creation_tx TEXT;
ALTER TABLE polls ADD COLUMN onchain_poll_id TEXT;
ALTER TABLE votes ADD COLUMN verification_status TEXT DEFAULT 'verified';
```

### **UI Migration**
- **Phase 1**: Add onchain functionality alongside existing features
- **Phase 2**: Filter UI to show only onchain polls/votes
- **Phase 3**: Remove offchain creation paths (optional)

---

## Success Metrics

### **Technical Metrics**
- **Transaction Success Rate**: >95% successful onchain transactions
- **UX Performance**: <2 second additional latency for onchain operations  
- **Event Verification**: 100% transaction hash verification accuracy
- **Cost Efficiency**: <$0.02 average cost per transaction on Base

### **User Experience Metrics**
- **Completion Rate**: >90% users complete onchain flows without issues
- **UI Consistency**: Only mini-app polls visible in feed
- **Error Rate**: <5% failed transactions requiring retry

---

## Risk Assessment & Mitigation

### **Technical Risks**
| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Smart contract bugs | High | Low | Simple contract, thorough testing |
| ethProvider limitations | Medium | Low | Fallback error messages |
| Base network issues | Low | Low | Base is stable and cheap |
| Event parsing errors | Medium | Low | Robust error handling |

### **UX Risks**  
| Risk | Impact | Probability | Mitigation |
|------|---------|-------------|------------|
| Wallet connection issues | Medium | Low | Clear error messages |
| Transaction failures | Medium | Low | Simple retry logic |
| User confusion | Low | Low | Base transactions are fast/cheap |

---

## Conclusion

The polling center is ready for **dead simple** Web3 integration that maintains fast UX while adding onchain verification.

**Key Benefits:**
- **No complexity**: Direct contract calls, no signatures or nonces
- **Fast UX**: Database remains primary display source
- **UI gating**: Clean separation between mini-app and external usage
- **Low cost**: Base network makes transactions essentially free
- **Quick implementation**: 4-6 days total development time

**Recommended Approach:**
1. **Simple contract**: Basic poll creation and voting with Solmate/Solady
2. **Direct integration**: viem + ethProvider, no public client needed
3. **Transaction verification**: Parse events from receipts, no complex sync
4. **UI filtering**: Show only polls/votes with transaction hashes

This approach avoids all the complexity we initially discussed while still providing meaningful onchain verification and a clean user experience.