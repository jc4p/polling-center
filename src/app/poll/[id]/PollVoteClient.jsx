'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { RadioOption } from '@/components/ui/RadioGroup';
import { VoteTransaction } from '@/components/ui/VoteTransaction';
import { ShareModal } from '@/components/ui/ShareModal';
import { pollsApi, votesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWeb3 } from '@/lib/web3Context';

export function PollVoteClient({ poll: initialPoll, votes: initialVotes }) {
  const router = useRouter();
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const { pollsContract, isConnected } = useWeb3();
  const [poll, setPoll] = useState(initialPoll);
  const [votes, setVotes] = useState(initialVotes);
  const [selectedOption, setSelectedOption] = useState(0);
  const [votingState, setVotingState] = useState('idle'); 
  // States: idle, onchain, confirming, complete
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch updated poll data and votes
  const fetchPollData = async () => {
    try {
      setIsRefreshing(true);
      const [pollData, votesData] = await Promise.all([
        pollsApi.getPoll(poll.id),
        votesApi.getVotes({ poll_id: poll.id, limit: 10 })
      ]);
      
      if (pollData?.poll) {
        setPoll(pollData.poll);
      }
      
      if (votesData?.votes) {
        setVotes(votesData.votes);
      }
    } catch (err) {
      console.error('Error fetching poll data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Periodic refresh every 5 seconds for voting page
  useEffect(() => {
    const interval = setInterval(fetchPollData, 5000);
    return () => clearInterval(interval);
  }, [poll.id]);

  // Check if user has already voted (use database, not onchain)
  useEffect(() => {
    const checkVotingStatus = async () => {
      if (!isAuthenticated) return;
      
      try {
        // Use API helper to check if user voted (requires auth)
        const data = await pollsApi.getUserVote(poll.id, getAuthHeaders());
        setHasVoted(data.hasVoted);
        if (data.hasVoted && data.userVote) {
          setUserVote(data.userVote);
          setSelectedOption(data.userVote.option_index);
        }
      } catch (error) {
        console.error('Failed to check voting status:', error);
      }
    };

    checkVotingStatus();
  }, [isAuthenticated, poll.id, getAuthHeaders]);

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

      {hasVoted && (
        <div className="px-4 py-2">
          <div className="bg-mint-50 border border-mint-200 rounded-lg p-3 text-center">
            <p className="text-forest-900 font-medium">✅ You've already voted on this poll</p>
            <p className="text-forest-600 text-sm mt-1">Your choice: {poll.options[userVote?.option_index]?.text}</p>
          </div>
        </div>
      )}

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

      {/* Refresh indicator */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-mint-100">
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <div className="w-4 h-4 border-2 border-forest-300 border-t-forest-600 rounded-full animate-spin"></div>
          )}
          <span className="text-sm text-forest-600">
            {isRefreshing ? 'Refreshing...' : 'Auto-refreshes every 5s'}
          </span>
        </div>
        <button
          onClick={fetchPollData}
          disabled={isRefreshing}
          className="text-sm text-forest-600 hover:text-forest-900 disabled:opacity-50"
        >
          Refresh now
        </button>
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