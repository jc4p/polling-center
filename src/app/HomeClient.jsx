'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export function HomeClient({ initialPolls, initialError }) {
  const [polls, setPolls] = useState(initialPolls || []);
  const [error, setError] = useState(initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPolls = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/polls?limit=10');
      if (!response.ok) {
        throw new Error('Failed to fetch polls');
      }
      const data = await response.json();
      setPolls(data.polls || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching polls:', err);
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Periodic refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchPolls, 30000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleRefresh = () => {
    fetchPolls();
  };
  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-forest-900 text-lg font-medium mb-2">Failed to load polls</h3>
        <p className="text-forest-600 mb-6">Please check if the API server is running.</p>
        <Link href="/create">
          <Button>Create Poll</Button>
        </Link>
      </div>
    );
  }

  if (polls.length > 0) {
    return (
      <div>
        {/* Refresh indicator and button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isRefreshing && (
              <div className="w-4 h-4 border-2 border-forest-300 border-t-forest-600 rounded-full animate-spin"></div>
            )}
            <span className="text-sm text-forest-600">
              {isRefreshing ? 'Refreshing...' : 'Auto-refreshes every 30s'}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-sm text-forest-600 hover:text-forest-900 disabled:opacity-50"
          >
            Refresh now
          </button>
        </div>

        {/* Polls list with increased spacing */}
        <div className="space-y-6">
          {polls.map((poll) => (
            <Link key={poll.id} href={`/poll/${poll.id}`}>
              <div className="bg-white border border-mint-200 rounded-xl p-4 hover:border-mint-300 transition-colors">
                <h3 className="text-forest-900 font-medium mb-2 line-clamp-2">
                  {poll.question}
                </h3>
                <div className="flex items-center justify-between text-sm text-forest-600">
                  <span>{poll.total_votes} votes</span>
                  <span>{poll.time_ago}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <img 
                    src={poll.creator.pfp_url} 
                    alt={poll.creator.display_name}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm text-forest-600">
                    {poll.creator.display_name}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <h3 className="text-forest-900 text-lg font-medium mb-2">No polls yet</h3>
      <p className="text-forest-600 mb-6">Be the first to create a poll!</p>
      <Link href="/create">
        <Button>Create Poll</Button>
      </Link>
    </div>
  );
}