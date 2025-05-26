'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import * as frame from '@farcaster/frame-sdk';

export function ShareModal({ isOpen, onClose, poll, shareUrl, shareType = 'poll' }) {
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



  const getShareText = () => {
    if (shareType === 'vote' && poll.userVote) {
      const selectedOption = poll.options[poll.userVote.option_index];
      return `I just voted for "${selectedOption.text}" on "${poll.question}" 🗳️`;
    }
    if (shareType === 'results' && poll.status === 'expired') {
      const winningOption = poll.options.reduce((prev, current) => 
        prev.percentage > current.percentage ? prev : current
      );
      return `"${winningOption.text}" won with ${winningOption.percentage}% in "${poll.question}" 📊`;
    }
    // For general polls, active polls from results, and any other case
    return `What do you think? "${poll.question}" 🤔`;
  };

  const getModalContent = () => {
    if (shareType === 'vote' && poll.userVote) {
      return {
        title: "Vote Cast! 🎉",
        description: "Your vote has been recorded onchain. Share your choice with friends!",
        shareButtonText: "Share My Vote"
      };
    }
    if (shareType === 'results') {
      return {
        title: "Share Results 📊",
        description: "Show your friends how this poll turned out!",
        shareButtonText: "Share Results"
      };
    }
    return {
      title: "Share Poll 🗳️",
      description: "Get your friends to weigh in on this question!",
      shareButtonText: "Share Poll"
    };
  };

  const handleShareToFarcaster = async () => {
    const text = getShareText();
    const targetText = encodeURIComponent(text);
    const targetURL = encodeURIComponent(shareUrl);
    const finalUrl = `https://farcaster.xyz/~/compose?text=${targetText}&embeds[]=${targetURL}`;

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

  const modalContent = getModalContent();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-mint-50 rounded-xl p-6 max-w-sm mx-4 w-full">
        <h3 className="text-forest-900 text-lg font-bold mb-2">{modalContent.title}</h3>
        
        <p className="text-forest-600 text-sm mb-4">
          {modalContent.description}
        </p>

        <div className="bg-white rounded-lg p-3 mb-4 border border-mint-200">
          <p className="text-forest-900 text-sm font-medium line-clamp-2">
            "{poll.question}"
          </p>
        </div>

        <div className="space-y-3">
          <Button 
            variant="primary" 
            size="medium" 
            className="w-full"
            onClick={handleShareToFarcaster}
          >
            {modalContent.shareButtonText}
          </Button>
          
          <Button 
            variant="secondary" 
            size="medium" 
            className="w-full"
            onClick={onClose}
          >
            View Results
          </Button>
        </div>
      </div>
    </div>
  );
}