# Enhanced Web3 Frontend Integration Specification

## Overview

This document specifies the enhanced frontend Web3 integration using **viem for transaction construction** and **ethProvider for connection** within the Farcaster Frame V2 environment. The implementation uses **direct contract calls** with the **offchain database as the primary data source**.

## Key Changes

1. **Dead Simple**: No signatures, just direct contract calls
2. **No Public Client**: All data reading comes from the offchain database API
3. **Solmate/Solady Integration**: Smart contract uses optimized libraries
4. **Database as Source of Truth**: Onchain is for verification, database for performance
5. **UI Gating**: Only polls/votes created through the mini app show up in UI

---

## Core Integration Components

### **1. Blockchain Client Setup (No Public Client)**

```javascript
// src/lib/blockchain.js
import { encodeFunctionData, parseAbi } from 'viem';
import * as frame from '@farcaster/frame-sdk';

export class FrameBlockchainClient {
  constructor() {
    this.ethProvider = null;
    this.contractAddress = process.env.NEXT_PUBLIC_POLLS_CONTRACT_ADDRESS;
    this.contractAbi = parseAbi([
      'function createPoll(string calldata pollId, uint256 creatorFid, uint256 durationDays, uint256 optionCount) external',
      'function submitVote(string calldata pollId, uint256 optionIndex, uint256 voterFid) external',
      'event PollCreated(string indexed pollId, address indexed creator, uint256 indexed creatorFid, uint256 expiresAt)',
      'event VoteCast(string indexed pollId, address indexed voter, uint256 indexed fid, uint256 optionIndex)'
    ]);
  }

  async initialize() {
    // Initialize Frame SDK ethProvider only
    await frame.sdk.actions.ready();
    this.ethProvider = frame.sdk.wallet.ethProvider;

    // Verify Base network
    await this.ensureBaseNetwork();
  }

  async ensureBaseNetwork() {
    const chainId = await this.ethProvider.request({method: 'eth_chainId'});
    const chainIdDecimal = parseInt(chainId, 16);
    
    if (chainIdDecimal !== 8453) {
      await this.ethProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }] // Base mainnet
      });
    }
  }

  async getAccount() {
    const accounts = await this.ethProvider.request({
      method: 'eth_requestAccounts'
    });
    return accounts[0];
  }

  // Viem for transaction construction, ethProvider for submission
  async sendTransaction(data) {
    const account = await this.getAccount();
    
    // Keep it simple - ethProvider only supports basic params on Base
    return await this.ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: account,
        to: this.contractAddress,
        data: data
      }]
    });
  }
}
```

### **2. Enhanced Contract Interaction Layer**

```javascript
// src/lib/pollsContract.js
import { encodeFunctionData } from 'viem';

export class PollsContract {
  constructor(blockchainClient) {
    this.client = blockchainClient;
  }

  async createPoll(pollId, creatorFid, durationDays, optionCount) {
    // Dead simple - no signatures needed!
    const data = encodeFunctionData({
      abi: this.client.contractAbi,
      functionName: 'createPoll',
      args: [
        pollId,
        BigInt(creatorFid),
        BigInt(durationDays), 
        BigInt(optionCount)
      ]
    });

    // Use ethProvider to send the transaction
    const txHash = await this.client.sendTransaction(data);
    return txHash;
  }

  async submitVote(pollId, optionIndex, voterFid) {
    // Use viem to encode the function call
    const data = encodeFunctionData({
      abi: this.client.contractAbi,
      functionName: 'submitVote',
      args: [pollId, BigInt(optionIndex), BigInt(voterFid)]
    });

    // Use ethProvider to send the transaction
    const txHash = await this.client.sendTransaction(data);
    return txHash;
  }

  // No gas estimation needed - Base is cheap and ethProvider doesn't support it anyway!
}
```

### **3. Simplified API Integration**

```javascript
// src/lib/pollsApi.js
import { pollsApi } from './api';

export class PollsApiEnhanced {
  
  // Simple: Create poll with transaction hash
  static async createPollWithTransaction(pollData, transactionHash, authHeaders) {
    return await pollsApi.apiCall('/polls', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pollData,
        transactionHash
      })
    });
  }

  // Simple: Submit vote with transaction hash
  static async submitVoteWithTransaction(pollId, voteData, transactionHash, authHeaders) {
    return await pollsApi.apiCall(`/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...voteData,
        transactionHash
      })
    });
  }

  // All other functions remain the same - they use database data
  static async getPolls(params = {}) {
    return await pollsApi.getPolls(params);
  }

  static async getPoll(pollId) {
    return await pollsApi.getPoll(pollId);
  }

  static async getResults(pollId) {
    return await pollsApi.getResults(pollId);
  }
}
```

---

## Enhanced Integration Points

### **1. Dead Simple Poll Creation Flow**

```javascript
// src/app/create/page.jsx (Dead simple!)
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useWeb3 } from '@/lib/web3Context';
import { PollsApiEnhanced } from '@/lib/pollsApi';

export default function CreatePollPage() {
  const { user, getAuthHeaders } = useAuth();
  const { pollsContract, isConnected } = useWeb3();
  const [formData, setFormData] = useState({
    question: '',
    options: ['', ''],
    duration: '7'
  });
  const [creationState, setCreationState] = useState('idle'); 
  // States: idle, onchain, saving, complete

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected || !pollsContract) {
      alert('Web3 connection required for onchain polls');
      return;
    }

    try {
      // Generate unique poll ID
      const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Step 1: Submit to smart contract
      setCreationState('onchain');
      const txHash = await pollsContract.createPoll(
        pollId,
        user.fid,
        parseInt(formData.duration),
        formData.options.length
      );

      // Step 2: Save to database with transaction hash
      setCreationState('saving');
      const response = await PollsApiEnhanced.createPollWithTransaction({
        question: formData.question,
        options: formData.options,
        duration: formData.duration,
        pollId: pollId,
        creatorFid: user.fid
      }, txHash, getAuthHeaders());

      setCreationState('complete');
      
      // Redirect to poll page
      window.location.href = `/poll/${response.poll.id}`;
      
    } catch (error) {
      console.error('Poll creation failed:', error);
      setCreationState('idle');
      alert('Poll creation failed. Please try again.');
    }
  };

  const getCreationStateMessage = () => {
    switch (creationState) {
      case 'onchain': return 'Creating poll onchain...';
      case 'saving': return 'Saving poll data...';
      case 'complete': return 'Poll created successfully!';
      default: return '';
    }
  };

  // ... rest of component UI with state indicators
}
```

### **2. Dead Simple Voting Flow**

```javascript
// src/app/poll/[id]/PollVoteClient.jsx (Enhanced)
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useWeb3 } from '@/lib/web3Context';
import { PollsApiEnhanced } from '@/lib/pollsApi';

export default function PollVoteClient({ initialPoll }) {
  const { user, getAuthHeaders } = useAuth();
  const { pollsContract, isConnected, blockchainClient } = useWeb3();
  const [selectedOption, setSelectedOption] = useState(null);
  const [votingState, setVotingState] = useState('idle'); 
  // States: idle, onchain, confirming, complete
  const [hasVoted, setHasVoted] = useState(false);

  // Check if user has already voted (use database, not onchain)
  useEffect(() => {
    // This uses existing database check via API
    // No onchain reading required since database is source of truth
    const checkVotingStatus = async () => {
      if (!user) return;
      
      try {
        // Use existing API to check if user voted
        const response = await fetch(`/api/polls/${initialPoll.id}/user-vote?fid=${user.fid}`);
        if (response.ok) {
          const data = await response.json();
          setHasVoted(data.hasVoted);
        }
      } catch (error) {
        console.error('Failed to check voting status:', error);
      }
    };

    checkVotingStatus();
  }, [user, initialPoll.id]);

  const handleVote = async () => {
    if (selectedOption === null || !isConnected || !pollsContract) return;

    try {
      // Step 1: Submit vote to smart contract (Base is cheap!)
      setVotingState('onchain');
      const txHash = await pollsContract.submitVote(
        initialPoll.id,
        selectedOption,
        user.fid
      );

      // Step 2: Confirm transaction in database
      setVotingState('confirming');
      await PollsApiEnhanced.submitVoteWithTransaction(initialPoll.id, {
        optionIndex: selectedOption,
        voterFid: user.fid
      }, txHash, getAuthHeaders());

      setVotingState('complete');
      setHasVoted(true);
      
      // Show share modal (existing functionality)
      setShowShareModal(true);

    } catch (error) {
      console.error('Voting failed:', error);
      setVotingState('idle');
      
      if (error.message.includes('AlreadyVoted')) {
        alert('You have already voted on this poll.');
        setHasVoted(true);
        return;
      }
      
      alert('Vote submission failed. Please try again.');
    }
  };

  const getVotingStateMessage = () => {
    switch (votingState) {
      case 'onchain': return 'Submitting vote onchain...';
      case 'confirming': return 'Confirming transaction...';
      case 'complete': return 'Vote submitted successfully!';
      default: return '';
    }
  };

  // ... rest of component UI with state indicators
}
```

### **3. Results Display (Database Only - No Onchain Reading)**

```javascript
// src/app/poll/[id]/results/ResultsClient.jsx (Database-focused)
'use client';
import { useState, useEffect } from 'react';

export default function ResultsClient({ poll, recentVotes }) {
  const [verificationStatus, setVerificationStatus] = useState('database');

  // Show verification status based on whether votes have transaction hashes
  useEffect(() => {
    const onchainVotes = recentVotes.filter(vote => vote.transaction_hash);
    const totalVotes = recentVotes.length;
    
    if (onchainVotes.length === totalVotes && totalVotes > 0) {
      setVerificationStatus('fully-verified');
    } else if (onchainVotes.length > 0) {
      setVerificationStatus('partially-verified');
    } else {
      setVerificationStatus('offchain-only');
    }
  }, [recentVotes]);

  const getVerificationIcon = () => {
    switch (verificationStatus) {
      case 'fully-verified': return '✅';
      case 'partially-verified': return '🔶';
      case 'offchain-only': return '📊';
      default: return '📊';
    }
  };

  const getVerificationMessage = () => {
    switch (verificationStatus) {
      case 'fully-verified': return 'All votes verified onchain';
      case 'partially-verified': return 'Some votes verified onchain';
      case 'offchain-only': return 'Results from database';
      default: return 'Results from database';
    }
  };

  return (
    <div className="poll-results">
      {/* Verification Status */}
      <div className="verification-status mb-4 p-3 bg-mint-100 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getVerificationIcon()}</span>
          <span className="text-sm font-medium text-forest-900">
            {getVerificationMessage()}
          </span>
        </div>
        
        <div className="mt-2 text-xs text-forest-600">
          {recentVotes.filter(v => v.transaction_hash).length} of {recentVotes.length} votes onchain
        </div>
      </div>

      {/* Poll results from database */}
      {poll.options.map((option, index) => (
        <div key={index} className="option-result mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium">{option.text}</span>
            <span className="text-sm">{option.vote_count} votes</span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-mint-200 rounded-full h-2">
            <div 
              className="bg-forest-700 h-2 rounded-full" 
              style={{ width: `${option.percentage}%` }}
            ></div>
          </div>
          
          <div className="text-xs text-forest-600 mt-1">
            {option.percentage}%
          </div>
        </div>
      ))}

      {/* Recent votes with transaction hash indicators */}
      <div className="recent-votes mt-6">
        <h3 className="font-medium mb-3">Recent Votes</h3>
        {recentVotes.map((vote, index) => (
          <div key={index} className="vote-item flex items-center gap-3 mb-2 p-2 bg-mint-50 rounded">
            <img 
              src={vote.voter.pfp_url} 
              alt={vote.voter.display_name}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{vote.voter.display_name}</div>
              <div className="text-xs text-forest-600">voted for "{vote.option_text}"</div>
            </div>
            {vote.transaction_hash && (
              <div className="text-xs text-forest-600">
                ⛓️ {vote.short_tx_hash}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Environment Configuration

### **Environment Variables**

```bash
# .env.local
NEXT_PUBLIC_POLLS_CONTRACT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
NEXT_PUBLIC_ENABLE_ONCHAIN=true

# No Alchemy API key needed for frontend (no public client)
# All data comes from database API
```

### **Backend Environment Variables**

```bash
# Backend .env
POLLS_CONTRACT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
BACKEND_SIGNER_PRIVATE_KEY=0x...  # Private key for signing poll creation assertions
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

---

## Error Handling & Fallbacks

### **Signature Validation Errors**

```javascript
// src/lib/errorHandling.js
export class Web3ErrorHandler {
  static handleSignatureError(error) {
    if (error.message.includes('InvalidSignature')) {
      return {
        type: 'INVALID_SIGNATURE',
        message: 'Backend authorization failed. Please try again.',
        canRetry: true
      };
    }
    
    if (error.message.includes('ExpiredSignature')) {
      return {
        type: 'EXPIRED_SIGNATURE', 
        message: 'Authorization expired. Please try again.',
        canRetry: true
      };
    }
    
    if (error.message.includes('UsedAssertion')) {
      return {
        type: 'USED_ASSERTION',
        message: 'This authorization has already been used.',
        canRetry: true
      };
    }
    
    return {
      type: 'UNKNOWN_SIGNATURE_ERROR',
      message: 'Authorization failed. Please try again.',
      canRetry: true
    };
  }

  static handleContractError(error, fallbackAction) {
    if (error.message.includes('AlreadyVoted')) {
      return {
        type: 'ALREADY_VOTED',
        message: 'You have already voted on this poll.',
        canRetry: false
      };
    }
    
    if (error.message.includes('PollInactive')) {
      return {
        type: 'POLL_INACTIVE',
        message: 'This poll is no longer active.',
        canRetry: false
      };
    }
    
    return this.handleTransactionError(error, fallbackAction);
  }
}
```

---

## Database Schema Integration

### **Enhanced Poll Creation API**

```javascript
// Backend: api/src/routes/polls.js (Enhanced)

// New endpoint: Prepare poll creation
app.post('/api/polls/prepare', async (c) => {
  const user = await authenticateUser(c);
  const { question, options, duration, creatorFid, creatorAddress } = await c.req.json();
  
  // Validate user permissions
  await backendSigner.validateUserPermissions(creatorFid, creatorAddress);
  
  // Get current nonce for user
  const nonce = await getUserNonce(creatorAddress);
  
  // Generate unique poll ID
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate backend signature
  const signatureData = await backendSigner.generatePollCreationSignature(
    pollId,
    creatorAddress,
    creatorFid,
    parseInt(duration),
    options.length,
    nonce
  );
  
  // Store signature in database for verification
  await db.prepare(`
    INSERT INTO poll_signatures (id, poll_id, creator_address, creator_fid, signature, deadline, nonce, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    crypto.randomUUID(),
    pollId,
    creatorAddress,
    creatorFid,
    signatureData.signature,
    signatureData.deadline,
    signatureData.nonce,
    Date.now()
  ]);
  
  return c.json({
    pollId,
    signature: signatureData.signature,
    deadline: signatureData.deadline,
    nonce: signatureData.nonce,
    signerAddress: signatureData.signerAddress
  });
});

// Enhanced endpoint: Create poll with transaction verification
app.post('/api/polls', async (c) => {
  const user = await authenticateUser(c);
  const { question, options, duration, transactionHash, pollId, creatorFid } = await c.req.json();
  
  if (transactionHash) {
    // Verify transaction matches our signature
    const verified = await contractVerifier.verifyPollCreation(
      transactionHash, 
      pollId, 
      user.walletAddress, 
      creatorFid
    );
    
    if (!verified) {
      throw new Error('Invalid poll creation transaction');
    }
    
    // Mark signature as used
    await db.prepare(`
      UPDATE poll_signatures SET used = TRUE WHERE poll_id = ?
    `).run([pollId]);
  }
  
  // Create poll in database
  const poll = await createPoll({
    ...pollData,
    creation_tx: transactionHash,
    onchain_poll_id: pollId
  });
  
  return c.json({ poll });
});
```

This enhanced specification removes all onchain reading from the frontend, requires backend signatures for poll creation, and uses the database as the primary data source while maintaining onchain verification capabilities.
