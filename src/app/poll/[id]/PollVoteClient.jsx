'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { RadioOption } from '@/components/ui/RadioGroup';
import { VoteTransaction } from '@/components/ui/VoteTransaction';
import { ShareModal } from '@/components/ui/ShareModal';
import { pollsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWeb3 } from '@/lib/web3Context';

export function PollVoteClient({ poll, votes }) {
  const router = useRouter();
  const { getAuthHeaders, isAuthenticated, user } = useAuth();
  const { pollsContract, isConnected } = useWeb3();
  const [selectedOption, setSelectedOption] = useState(0);
  const [votingState, setVotingState] = useState('idle'); 
  // States: idle, onchain, confirming, complete
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState(null);

  // Check if user has already voted (use database, not onchain)
  useEffect(() => {
    const checkVotingStatus = async () => {
      if (!user) return;
      
      try {
        // Use existing API to check if user voted
        const response = await fetch(`/api/polls/${poll.id}/user-vote?fid=${user.fid}`);
        if (response.ok) {
          const data = await response.json();
          setHasVoted(data.hasVoted);
        }
      } catch (error) {
        console.error('Failed to check voting status:', error);
      }
    };

    checkVotingStatus();
  }, [user, poll.id]);

  const handleVote = async () => {
    setError('');
    
    if (!isAuthenticated) {
      setError('Authentication required to vote');
      return;
    }

    if (!isConnected || !pollsContract) {
      setError('Web3 connection required for onchain voting');
      return;
    }

    try {
      // Get user profile for FID
      const profileResponse = await pollsApi.getUserProfile(getAuthHeaders());
      const userFid = profileResponse.user.fid;

      // Step 1: Submit vote to smart contract (Base is cheap!)
      setVotingState('onchain');
      const txHash = await pollsContract.submitVote(
        poll.id,
        selectedOption,
        userFid
      );

      // Step 2: Confirm transaction in database
      setVotingState('confirming');
      await pollsApi.voteWithTransaction(poll.id, {
        optionIndex: selectedOption
      }, txHash, getAuthHeaders());

      setVotingState('complete');
      setHasVoted(true);
      setUserVote({ option_index: selectedOption });
      
      // Show share modal (existing functionality)
      setShowShareModal(true);

    } catch (err) {
      console.error('Voting failed:', err);
      setVotingState('idle');
      
      if (err.message.includes('AlreadyVoted')) {
        setError('You have already voted on this poll.');
        setHasVoted(true);
        return;
      }
      
      if (err.message.includes('Web3 connection')) {
        setError('Web3 connection required. Please check your wallet.');
      } else {
        setError('Vote submission failed. Please try again.');
      }
    }
  };

  const handleViewResults = () => {
    router.push(`/poll/${poll.id}/results`);
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleShareModalClose = () => {
    setShowShareModal(false);
    // After sharing, redirect to results
    router.push(`/poll/${poll.id}/results`);
  };

  const getShareUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_FRAME_URL || 'http://localhost:3000';
    // Share to results page if poll is expired, otherwise to vote page
    return poll.status === 'expired' 
      ? `${baseUrl}/poll/${poll.id}/results` 
      : `${baseUrl}/poll/${poll.id}`;
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {poll.options.map((option, index) => (
          <RadioOption
            key={index}
            value={index}
            checked={selectedOption === index}
            onChange={(e) => setSelectedOption(parseInt(e.target.value))}
            name="poll-option"
          >
            {option.text}
          </RadioOption>
        ))}
      </div>

      <div className="flex px-4 py-3">
        <Button 
          size="small" 
          className="flex-1" 
          onClick={handleVote}
          disabled={votingState !== 'idle' || poll.status === 'expired' || !isAuthenticated || hasVoted}
        >
          {votingState === 'onchain' ? 'Submitting onchain...' : 
           votingState === 'confirming' ? 'Confirming...' : 
           votingState === 'complete' ? 'Vote submitted!' : 
           hasVoted ? 'Already Voted' :
           poll.status === 'expired' ? 'Poll Expired' : 
           !isAuthenticated ? 'Authentication Required' : 'Vote'}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-2">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      {votingState !== 'idle' && (
        <div className="px-4 py-2">
          <p className="text-forest-600 text-sm text-center">
            {votingState === 'onchain' && 'Submitting vote onchain...'}
            {votingState === 'confirming' && 'Confirming transaction...'}
            {votingState === 'complete' && 'Vote submitted successfully!'}
          </p>
        </div>
      )}

      <div className="flex gap-3 px-4 py-3">
        <Button 
          variant="secondary" 
          size="small" 
          className="flex-1"
          onClick={handleViewResults}
        >
          View Results
        </Button>
        <Button 
          variant="secondary" 
          size="small" 
          className="flex-1"
          onClick={handleShare}
        >
          Share
        </Button>
      </div>


      <h3 className="text-forest-900 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
        Vote Transactions
      </h3>

      {votes.length > 0 ? (
        votes.map((vote, index) => (
          <VoteTransaction
            key={index}
            user={vote.voter.display_name}
            transaction={vote.short_tx_hash || `@${vote.voter.username}`}
            avatar={vote.voter.pfp_url}
            timestamp={vote.voted_at}
          />
        ))
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-forest-600">No votes yet. Be the first to vote!</p>
        </div>
      )}

      <ShareModal 
        isOpen={showShareModal}
        onClose={handleShareModalClose}
        poll={{...poll, userVote}}
        shareUrl={getShareUrl()}
        shareType={hasVoted ? 'vote' : 'poll'}
      />
    </>
  );
}