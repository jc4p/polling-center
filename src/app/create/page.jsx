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

export default function CreatePoll() {
  const router = useRouter();
  const { getAuthHeaders, isAuthenticated, isLoading } = useAuth();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState('1 day');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

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

    setIsCreating(true);

    try {
      if (!isAuthenticated) {
        setError('Authentication required to create polls');
        return;
      }

      // Extract duration number from string like "1 day" -> "1"
      const durationDays = duration.split(' ')[0];
      
      const pollData = {
        question: question.trim(),
        options: validOptions.map(opt => opt.trim()),
        duration: durationDays
      };

      const response = await pollsApi.createPoll(pollData, getAuthHeaders());
      
      // Redirect to the created poll
      router.push(`/poll/${response.poll.id}`);
      
    } catch (err) {
      console.error('Error creating poll:', err);
      setError('Failed to create poll. Please try again.');
    } finally {
      setIsCreating(false);
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
      </div>

      <div>
        <div className="flex px-4 py-3">
          <Button 
            size="medium" 
            className="flex-1" 
            onClick={handleCreatePoll}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Poll'}
          </Button>
        </div>
        <div className="h-5 bg-mint-50"></div>
      </div>
    </AppLayout>
  );
}