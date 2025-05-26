'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Header } from '@/components/layout/Header';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { DurationSelector } from '@/components/ui/DurationSelector';
import { pollsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWeb3 } from '@/lib/web3Context';

export default function CreatePoll() {
  const router = useRouter();
  const { getAuthHeaders, isAuthenticated, isLoading } = useAuth();
  const { pollsContract, isConnected } = useWeb3();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState('1 day');
  const [creationState, setCreationState] = useState('idle'); 
  // States: idle, creating, onchain, verifying, complete
  const [error, setError] = useState('');
  const [currentPollId, setCurrentPollId] = useState(null);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleCreatePoll = async () => {
    setError('');
    
    // Validation
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    
    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    if (!isAuthenticated) {
      setError('Authentication required to create polls');
      return;
    }

    if (!isConnected || !pollsContract) {
      setError('Web3 connection required for onchain polls');
      return;
    }

    try {
      // Extract duration number from string like "1 day" -> "1"
      const durationDays = duration.split(' ')[0];
      
      const pollData = {
        question: question.trim(),
        options: validOptions.map(opt => opt.trim()),
        duration: durationDays
      };

      // Step 1: Create poll in database first
      setCreationState('creating');
      const response = await pollsApi.createPoll(pollData, getAuthHeaders());
      const { poll } = response;

      // Get user profile for FID
      const profileResponse = await pollsApi.getUserProfile(getAuthHeaders());
      const userFid = profileResponse.user.fid;

      // Step 2: Submit to smart contract
      setCreationState('onchain');
      const txHash = await pollsContract.createPoll(
        poll.id,
        userFid,
        parseInt(durationDays),
        validOptions.length
      );

      // Step 3: Verify the transaction with backend
      setCreationState('verifying');
      await pollsApi.verifyPollCreation(poll.id, txHash, getAuthHeaders());

      setCreationState('complete');
      
      // Redirect to the created poll
      router.push(`/poll/${poll.id}`);
      
    } catch (err) {
      console.error('Poll creation failed:', err);
      setCreationState('idle');
      
      if (err.message.includes('Web3 connection')) {
        setError('Web3 connection required. Please check your wallet.');
      } else if (err.message.includes('Invalid poll creation')) {
        setError('Onchain verification failed. Please try again.');
      } else {
        setError('Poll creation failed. Please try again.');
      }
    }
  };

  return (
    <AppLayout showBottomNav={false}>
      <div>
        <Header title="Create Poll" showClose={true} />
        
        <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
          <label className="flex flex-col min-w-40 flex-1">
            <FormInput
              placeholder="Ask a question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={280}
            />
          </label>
        </div>

        {options.map((option, index) => (
          <div key={index} className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
            <label className="flex flex-col min-w-40 flex-1">
              <FormInput
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                maxLength={100}
              />
            </label>
            {options.length > 2 && (
              <button
                onClick={() => removeOption(index)}
                className="text-forest-600 hover:text-forest-900 px-2"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <div className="flex px-4 py-3 justify-start">
          <Button 
            variant="secondary" 
            size="small" 
            onClick={addOption}
            disabled={options.length >= 10}
          >
            Add Option
          </Button>
        </div>

        <h3 className="text-forest-900 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">
          Poll Duration
        </h3>
        
        <div className="p-4">
          <DurationSelector value={duration} onChange={setDuration} />
        </div>

        {error && (
          <div className="px-4 py-2">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {creationState !== 'idle' && (
          <div className="px-4 py-2">
            <p className="text-forest-600 text-sm">
              {creationState === 'creating' && 'Creating poll...'}
              {creationState === 'onchain' && 'Creating poll onchain...'}
              {creationState === 'verifying' && 'Verifying transaction...'}
              {creationState === 'complete' && 'Poll created successfully!'}
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="flex px-4 py-3">
          <Button 
            size="medium" 
            className="flex-1" 
            onClick={handleCreatePoll}
            disabled={creationState !== 'idle'}
          >
            {creationState !== 'idle' ? 'Creating...' : 'Create Poll'}
          </Button>
        </div>
        <div className="h-5 bg-mint-50"></div>
      </div>
    </AppLayout>
  );
}