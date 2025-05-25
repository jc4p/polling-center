'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import * as frame from '@farcaster/frame-sdk';

export function ShareModal({ isOpen, onClose, poll, shareUrl, shareType = 'poll' }) {
  const [copied, setCopied] = useState(false);
  const [isInFrame, setIsInFrame] = useState(false);

  useEffect(() => {
    // Check if we're in a frame context
    const checkFrameContext = async () => {
      try {
        const context = await frame.sdk.context;
        setIsInFrame(!!context?.user);
      } catch (err) {
        setIsInFrame(false);
      }
    };
    
    checkFrameContext();
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getShareText = () => {
    if (shareType === 'vote' && poll.userVote) {
      const selectedOption = poll.options[poll.userVote.option_index];
      return `I just voted for "${selectedOption.text}" on "${poll.question}"`;
    }
    if (shareType === 'results' && poll.status === 'expired') {
      const winningOption = poll.options.reduce((prev, current) => 
        prev.percentage > current.percentage ? prev : current
      );
      return `"${winningOption.text}" won with ${winningOption.percentage}% in "${poll.question}"`;
    }
    // For general polls, active polls from results, and any other case
    return `Check out this poll: "${poll.question}"`;
  };

  const handleShareToFarcaster = async () => {
    const text = getShareText();
    const targetText = encodeURIComponent(text);
    const targetURL = encodeURIComponent(shareUrl);
    const finalUrl = `https://warpcast.com/~/compose?text=${targetText}&embeds[]=${targetURL}`;

    if (isInFrame) {
      try {
        await frame.sdk.actions.openUrl({ url: finalUrl });
      } catch (err) {
        console.error('Failed to open Warpcast in frame:', err);
        // Fallback to window.open
        window.open(finalUrl, '_blank');
      }
    } else {
      window.open(finalUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-mint-50 rounded-xl p-6 max-w-sm mx-4 w-full">
        <h3 className="text-forest-900 text-lg font-bold mb-4">Share Poll</h3>
        
        <p className="text-forest-600 text-sm mb-4">
          "{poll.question}"
        </p>

        <div className="space-y-3">
          <Button 
            variant="primary" 
            size="medium" 
            className="w-full"
            onClick={handleShareToFarcaster}
          >
            Share to Farcaster
          </Button>
          
          <Button 
            variant="secondary" 
            size="medium" 
            className="w-full"
            onClick={handleCopyLink}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-mint-200">
          <Button 
            variant="secondary" 
            size="small"
            className="w-full"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}