# Backend Standup #4 - Onchain Verification Implementation

## What Was Accomplished

✅ **Complete onchain verification system** for poll creation and voting  
✅ **Two-step poll creation flow** - create poll then verify onchain  
✅ **Transaction hash verification** with retry logic for Alchemy delays  
✅ **Smart contract event parsing** to validate poll and vote transactions  
✅ **UI gating** - only verified polls appear in listings  
✅ **Database schema updates** with transaction_hash column  

**Previous Status**: Backend had complete API functionality with optional transaction hashes.  
**Current Status**: Backend now enforces onchain verification for all poll creation and voting operations.

Claude Code Summary:
Total cost:            $1.96
Total duration (API):  24m 29.0s
Total duration (wall): 21m 53.6s
Total code changes:    867 lines added, 113 lines removed
Token usage by model:
  claude-3-5-haiku:  112.3k input, 21.9k output, 0 cache read, 0 cache write
  claude-sonnet:  257 input, 26.5k output, 2.7m cache read, 155.6k cache write

---

## Key Changes for Frontend Integration

### **New API Flow - Poll Creation**

**Old Flow:**
```javascript
// ❌ This no longer works
POST /api/polls {
  question, options, duration, transactionHash, pollId, creatorFid
}
```

**New Flow:**
```javascript
// ✅ New two-step process
// 1. Create poll in database first
const response = await fetch('/api/polls', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    question: "Your poll question?",
    options: ["Option 1", "Option 2"], 
    duration: "3" // "1", "3", or "7" days
  })
})
const { poll } = await response.json()

// 2. Call smart contract with the database poll ID
const txHash = await contract.createPoll(
  poll.id,        // Use the database ID as contract poll ID
  creatorFid,     // Your Farcaster FID
  3,              // Duration in days
  2               // Number of options
)

// 3. Verify the transaction with backend
await fetch(`/api/polls/${poll.id}/verify`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    transactionHash: txHash
  })
})
```

### **New API Flow - Voting**

**Updated Voting:**
```javascript
// ✅ Enhanced voting with required transaction hash
// 1. Call smart contract first (use FID from JWT context)
const txHash = await contract.submitVote(
  pollId,       // The poll ID
  optionIndex,  // 0, 1, 2, etc.
  userFid       // Get from JWT or profile endpoint
)

// 2. Submit vote with transaction hash (FID automatically extracted from JWT)
await fetch(`/api/polls/${pollId}/vote`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${jwt}` },
  body: JSON.stringify({
    optionIndex: 1,
    transactionHash: txHash  // Only these fields needed
  })
})
```

### **New API Endpoints**

#### `POST /api/polls/:id/verify`
**Purpose:** Verify onchain poll creation transaction  
**Auth:** Required (JWT, must be poll creator)  
**Input:**
```javascript
{
  transactionHash: "0x..."  // Transaction hash from smart contract call
}
```
**Output:**
```javascript
{
  poll: { /* updated poll with transaction_hash */ },
  verification: {
    pollId: "poll-123",
    creatorFid: 12345,
    durationDays: 3,
    optionCount: 2,
    blockNumber: 1234567,
    blockHash: "0x...",
    transactionHash: "0x...",
    gasUsed: 85000
  }
}
```

#### `GET /api/profile`
**Purpose:** Get current authenticated user's profile  
**Auth:** Required (JWT)  
**Input:** None  
**Output:**
```javascript
{
  user: {
    fid: 12345,
    username: "username",
    display_name: "Display Name",
    pfp_url: "https://..."
  }
}
```

### **UI Changes Required**

#### **Poll Listings** 
- `GET /api/polls` now only returns verified polls
- No code changes needed, just fewer polls will appear until verified
- Unverified polls won't show in any listings

#### **Poll Creation Flow**
1. **Create Poll Form** → `POST /api/polls` → Get poll ID
2. **Smart Contract Call** → `contract.createPoll()` → Get transaction hash  
3. **Verify Transaction** → `POST /api/polls/:id/verify` → Poll becomes visible
4. **Handle States:**
   - Loading: "Creating poll..."
   - Onchain: "Submitting to blockchain..."
   - Verifying: "Verifying transaction..."
   - Complete: "Poll created successfully!"

#### **Voting Flow**
1. **Get User FID** → `GET /api/profile` or extract from JWT
2. **Smart Contract Call** → `contract.submitVote(pollId, optionIndex, userFid)` → Get transaction hash
3. **Submit Vote** → `POST /api/polls/:id/vote` with `{optionIndex, transactionHash}` → Immediate verification
4. **Handle States:**
   - Loading: "Submitting vote..."
   - Onchain: "Recording vote onchain..."
   - Complete: "Vote recorded!"

#### **Error Handling**
- **Verification Failed**: Show transaction verification error details
- **Already Verified**: Poll already has onchain verification
- **Unverified Polls**: Can't vote on polls without transaction_hash
- **Blockchain Errors**: Contract call failures or network issues

#### **Authentication Changes**
- **FID Removal**: No longer pass `creatorFid` or `voterFid` in API calls
- **JWT Required**: All protected endpoints automatically extract FID from JWT
- **Profile Endpoint**: Use `GET /api/profile` to get current user's FID for contract calls
- **Simplified Payloads**: Smaller request bodies, less room for user error

---

## Smart Contract Integration Requirements

### **Contract ABI Required**
The frontend needs to interact with a smart contract with these functions:

```solidity
// Contract functions to call
function createPoll(string calldata pollId, uint256 creatorFid, uint8 durationDays, uint8 optionCount) external
function submitVote(string calldata pollId, uint8 optionIndex, uint256 voterFid) external

// Events that backend verifies
event PollCreated(string indexed pollId, uint256 indexed creatorFid, uint8 durationDays, uint8 optionCount)
event VoteCast(string indexed pollId, uint256 indexed voterFid, uint8 optionIndex)
```

### **viem Integration Pattern**
```javascript
import { createWalletClient, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const walletClient = createWalletClient({
  chain: base,
  transport: http()
})

// Get user FID first
const profileResponse = await fetch('/api/profile', {
  headers: { 'Authorization': `Bearer ${jwt}` }
})
const { user } = await profileResponse.json()

// Contract interaction
const txHash = await walletClient.writeContract({
  address: CONTRACT_ADDRESS, // Will be provided after deployment
  abi: POLLS_CONTRACT_ABI,
  functionName: 'createPoll',
  args: [pollId, user.fid, durationDays, optionCount]
})
```

---

## TODO: Post-Contract Deployment

### **Backend Updates Needed**
1. **Add contract address** to environment variables
2. **Update verification service** to check transactions are on correct contract
3. **Add contract address validation** in `onchainVerification.js`
4. **Test with actual deployed contract** on Base network

### **Code Changes Required**
```javascript
// In onchainVerification.js - add contract address verification
export async function verifyPollCreationTransaction(
  blockchain, 
  transactionHash, 
  expectedPollId, 
  expectedCreatorFid, 
  expectedDurationDays, 
  expectedOptionCount,
  contractAddress // Add this parameter
) {
  // Verify transaction was sent to correct contract
  const transaction = await blockchain.getTransaction({ hash: transactionHash })
  if (transaction.to.toLowerCase() !== contractAddress.toLowerCase()) {
    return { verified: false, error: 'Transaction not sent to correct contract' }
  }
  // ... rest of verification
}
```

### **Environment Variables**
```bash
# Add to wrangler.toml and .env
POLLS_CONTRACT_ADDRESS=0x... # Contract address after deployment
```

---

## Testing Requirements

### **Frontend Testing Checklist**
- [ ] Poll creation with contract interaction
- [ ] Transaction verification with retry logic  
- [ ] Voting with onchain verification
- [ ] Error handling for failed transactions
- [ ] UI states during blockchain operations
- [ ] Only verified polls appear in listings

### **Integration Testing**
- [ ] End-to-end poll creation and voting flow
- [ ] Transaction verification with actual Base network
- [ ] Error scenarios (failed transactions, network issues)
- [ ] Performance with blockchain call delays

---

## Backend Implementation Summary

### **Database Changes**
```sql
-- Migration already provided
ALTER TABLE polls ADD COLUMN transaction_hash TEXT;
```

### **New Files Added**
- `api/src/services/onchainVerification.js` - Transaction verification service
- Smart contract event parsing and validation logic

### **Modified Files**
- `api/src/routes/polls.js` - Updated poll creation and voting flows
- Enhanced authentication and verification requirements

### **Key Features**
- **Retry Logic**: Handles Alchemy API delays automatically
- **Event Parsing**: Validates correct contract events were emitted  
- **Security**: Only poll creators can verify, only verified polls accept votes
- **Performance**: Database remains fast cache, blockchain is verification layer

---

## Key API Changes Summary

### **Removed Parameters**
- ❌ `creatorFid` from `POST /api/polls` 
- ❌ `voterFid` from `POST /api/polls/:id/vote`
- ❌ `pollId` from `POST /api/polls` (now auto-generated)

### **New Required Fields**
- ✅ `transactionHash` required for `POST /api/polls/:id/verify`
- ✅ `transactionHash` required for `POST /api/polls/:id/vote`

### **New Endpoints**
- ✅ `POST /api/polls/:id/verify` - Verify poll creation transaction
- ✅ `GET /api/profile` - Get authenticated user's profile and FID

### **Enhanced Filtering**
- ✅ `GET /api/polls` now only returns verified polls (`transaction_hash IS NOT NULL`)
- ✅ Voting only allowed on verified polls

---

## Next Steps for Frontend Team

1. **Update poll creation components** to use two-step flow
2. **Remove FID parameters** from API calls (use JWT extraction)
3. **Add profile endpoint** calls to get user FID for contract interactions
4. **Add smart contract integration** with viem and Frame SDK
5. **Implement transaction verification** calls
6. **Update voting components** to require onchain transactions
7. **Add loading states** for blockchain operations
8. **Test with deployed contract** once available

The backend is ready for full onchain integration with simplified authentication. After contract deployment, we'll provide the contract address and ABI for frontend integration.