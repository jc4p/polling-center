'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { RadioOption } from '@/components/ui/RadioGroup';
import { VoteTransaction } from '@/components/ui/VoteTransaction';
import { ShareModal } from '@/components/ui/ShareModal';
import { pollsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function PollVoteClient({ poll, votes }) {
  const router = useRouter();
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const [selectedOption, setSelectedOption] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState(null);

  const handleVote = async () => {
    setError('');
    setIsVoting(true);
    
    try {
      if (!isAuthenticated) {
        setError('Authentication required to vote');
        return;
      }

      const voteData = {
        option_index: selectedOption
      };

      const response = await pollsApi.vote(poll.id, voteData, getAuthHeaders());
      
      // Store vote data for sharing
      setHasVoted(true);
      setUserVote({ option_index: selectedOption });
      
      // Show share modal after successful vote
      setShowShareModal(true);
      
    } catch (err) {
      console.error('Error voting:', err);
      setError('Failed to submit vote. Please try again.');
    } finally {
      setIsVoting(false);
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
          disabled={isVoting || poll.status === 'expired' || !isAuthenticated}
        >
          {isVoting ? 'Voting...' : poll.status === 'expired' ? 'Poll Expired' : !isAuthenticated ? 'Authentication Required' : 'Vote'}
        </Button>
      </div>

      {error && (
        <div className="px-4 py-2">
          <p className="text-red-600 text-sm text-center">{error}</p>
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

      {isVoting && (
        <p className="text-forest-600 text-sm font-normal leading-normal pb-3 pt-1 px-4 text-center">
          Voting onchain...
        </p>
      )}

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