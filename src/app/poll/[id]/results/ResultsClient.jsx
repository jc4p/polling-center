'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmojiReactions } from '@/components/ui/EmojiReactions';
import { VoteTransaction } from '@/components/ui/VoteTransaction';
import { ShareModal } from '@/components/ui/ShareModal';

export function ResultsClient({ poll, recentVotes }) {
  const [showShareModal, setShowShareModal] = useState(false);

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