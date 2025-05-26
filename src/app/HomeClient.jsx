'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { pollsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function HomeClient({ initialPolls, initialError }) {
  const { getAuthHeaders, isAuthenticated, isLoading } = useAuth();
  const [polls, setPolls] = useState(initialPolls || []);
  const [error, setError] = useState(initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [hasInitiallyFetched, setHasInitiallyFetched] = useState(false);

  const fetchPolls = async (isAutoRefresh = false) => {
    try {
      setIsRefreshing(true);
      setRefreshError(null);
      const authHeaders = isAuthenticated ? getAuthHeaders() : null;
      const data = await pollsApi.getPolls({ limit: 10 }, authHeaders);
      setPolls(data.polls || []);
      setError(null); // Clear any previous errors on success
    } catch (err) {
      console.error('Error fetching polls:', err);
      if (isAutoRefresh) {
        // For auto-refresh, don't replace the whole page with error
        // Just show a temporary refresh error
        setRefreshError(err.message);
        // Clear refresh error after 5 seconds
        setTimeout(() => setRefreshError(null), 5000);
      } else {
        // For manual refresh or initial load, show full error
        setError(err.message);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial fetch after auth completes
  useEffect(() => {
    if (!isLoading && !hasInitiallyFetched) {
      setHasInitiallyFetched(true);
      fetchPolls(false);
    }
  }, [isLoading, hasInitiallyFetched]);

  // Periodic refresh every 30 seconds (only after initial fetch)
  useEffect(() => {
    if (!hasInitiallyFetched) return;
    
    const interval = setInterval(() => fetchPolls(true), 30000);
    return () => clearInterval(interval);
  }, [hasInitiallyFetched]);

  // Manual refresh function
  const handleRefresh = () => {
    fetchPolls(false);
  };

  // Show loading state while auth is in progress
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 border-2 border-forest-300 border-t-forest-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-forest-600">Loading...</p>
      </div>
    );
  }

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
            {refreshError && (
              <span className="text-xs text-red-600 ml-2">
                (Refresh failed)
              </span>
            )}
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
          {polls.map((poll) => {
            const href = poll.has_voted ? `/poll/${poll.id}/results` : `/poll/${poll.id}`;
            return (
              <Link key={poll.id} href={href}>
                <div className="bg-white border border-mint-200 rounded-xl p-4 hover:border-mint-300 transition-colors mb-4">
                  <h3 className="text-forest-900 font-medium mb-2 line-clamp-2">
                    {poll.question}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-forest-600">
                    <span>{poll.total_votes} votes</span>
                    <span>{poll.time_ago}</span>
                  </div>
                  {poll.has_voted && (
                    <div className="mt-2 text-xs text-forest-500">
                      ✅ You voted
                    </div>
                  )}
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
            )
          })}
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