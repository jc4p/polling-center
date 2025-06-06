'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmojiReactions } from '@/components/ui/EmojiReactions';
import { VoteTransaction } from '@/components/ui/VoteTransaction';
import { ShareModal } from '@/components/ui/ShareModal';
import { pollsApi } from '@/lib/api';

export function ResultsClient({ poll: initialPoll, recentVotes: initialRecentVotes }) {
  const params = useParams();
  const [poll, setPoll] = useState(initialPoll);
  const [recentVotes, setRecentVotes] = useState(initialRecentVotes);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchResults = async () => {
    try {
      setIsRefreshing(true);
      const data = await pollsApi.getResults(params.id);
      setPoll(data.poll);
      setRecentVotes(data.recent_votes || []);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Periodic refresh every 15 seconds for results (only if poll is active)
  useEffect(() => {
    if (poll.status === 'expired') {
      return; // Don't refresh if poll is over
    }
    
    const interval = setInterval(fetchResults, 15000);
    return () => clearInterval(interval);
  }, [params.id, poll.status]);

  // Manual refresh function
  const handleRefresh = () => {
    fetchResults();
  };

  const handleShare = () => {
    setShowShareModal(true);
  };

  const getShareUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_FRAME_URL || 'http://localhost:3000';
    const pollId = poll.id;
    // Share to voting page if poll is active, results page if expired
    return poll.status === 'expired' 
      ? `${baseUrl}/poll/${pollId}/results` 
      : `${baseUrl}/poll/${pollId}`;
  };

  return (
    <>
      <div className="flex items-center gap-4 px-4 pb-2">
        <div 
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-12 w-fit"
          style={{ backgroundImage: `url("${poll.creator.pfp_url}")` }}
        ></div>
        <div className="flex flex-col justify-center flex-1">
          <h3 className="text-forest-900 tracking-light text-2xl font-bold leading-tight">
            {poll.question}
          </h3>
          <p className="text-forest-600 text-sm font-normal leading-normal">
            by {poll.creator.display_name} · {poll.time_ago} · {poll.total_votes} voters
          </p>
        </div>
      </div>

      <div className="flex gap-3 px-4 py-3">
        <Button 
          variant="secondary" 
          size="small"
          onClick={handleShare}
        >
          Share Results
        </Button>
      </div>

      {/* Refresh indicator */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-mint-100">
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <div className="w-4 h-4 border-2 border-forest-300 border-t-forest-600 rounded-full animate-spin"></div>
          )}
          <span className="text-sm text-forest-600">
            {poll.status === 'expired' 
              ? 'Poll ended - Final results' 
              : isRefreshing 
                ? 'Refreshing results...' 
                : 'Auto-refreshes every 15s'
            }
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || poll.status === 'expired'}
          className="text-sm text-forest-600 hover:text-forest-900 disabled:opacity-50"
        >
          {poll.status === 'expired' ? 'Final' : 'Refresh'}
        </button>
      </div>

      <EmojiReactions />

      {poll.options.map((option, index) => (
        <ProgressBar
          key={index}
          label={option.text}
          percentage={option.percentage}
          className="p-4"
        />
      ))}

      <h3 className="text-forest-900 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
        Votes ({poll.total_votes} total)
      </h3>

      {recentVotes.length > 0 ? (
        recentVotes.map((vote, index) => (
          <VoteTransaction
            key={index}
            user={vote.voter.display_name}
            transaction={vote.short_tx_hash || vote.transaction_hash || `@${vote.voter.username}`}
            avatar={vote.voter.pfp_url}
            timestamp={vote.voted_at}
          />
        ))
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-forest-600">No votes recorded yet.</p>
        </div>
      )}

      <ShareModal 
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        poll={poll}
        shareUrl={getShareUrl()}
        shareType="results"
      />
    </>
  );
}