'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api';

export function ProfileClient() {
  const [activeTab, setActiveTab] = useState('polls');
  const [user, setUser] = useState(null);
  const [userPolls, setUserPolls] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated, getAuthHeaders, isLoading: authLoading } = useAuth();

  useEffect(() => {
    async function fetchUserData() {
      if (!isAuthenticated || authLoading) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch user profile
        const profileResponse = await fetch(`${API_URL}/profile`, {
          headers: getAuthHeaders(),
        });
        
        if (!profileResponse.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const profileData = await profileResponse.json();
        setUser(profileData.user);
        
        // Fetch user's polls
        const pollsResponse = await fetch(`${API_URL}/polls?creator_fid=${profileData.user.fid}&limit=50`, {
          headers: getAuthHeaders(),
        });
        
        if (pollsResponse.ok) {
          const pollsData = await pollsResponse.json();
          setUserPolls(pollsData.polls || []);
        }
        
        // Fetch user's votes
        const votesResponse = await fetch(`${API_URL}/votes?voter_fid=${profileData.user.fid}&limit=50`, {
          headers: getAuthHeaders(),
        });
        
        if (votesResponse.ok) {
          const votesData = await votesResponse.json();
          setUserVotes(votesData.votes || []);
        }
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [isAuthenticated, authLoading, getAuthHeaders]);

  if (authLoading || loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-forest-700 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-forest-600">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-forest-900 text-lg font-medium mb-2">Unable to load profile</h3>
        <p className="text-forest-600 mb-6">Error: {error}</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="text-center py-12">
        <h3 className="text-forest-900 text-lg font-medium mb-2">Not logged in</h3>
        <p className="text-forest-600 mb-6">You need to be authenticated to view your profile.</p>
        <p className="text-forest-600 text-sm">This will work automatically when accessed through a Farcaster frame.</p>
      </div>
    );
  }

  return (
    <div>
      {/* User Info */}
      <div className="flex items-center gap-4 bg-mint-50 px-4 py-6">
        <img 
          src={user.pfp_url} 
          alt={user.display_name}
          className="w-16 h-16 rounded-full"
        />
        <div className="flex flex-col">
          <h2 className="text-forest-900 text-xl font-bold">{user.display_name}</h2>
          <p className="text-forest-600">@{user.username}</p>
          <p className="text-forest-600 text-sm">FID: {user.fid}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-mint-200">
        <button
          onClick={() => setActiveTab('polls')}
          className={`flex-1 py-3 px-4 text-center font-medium ${
            activeTab === 'polls'
              ? 'text-forest-900 border-b-2 border-forest-700'
              : 'text-forest-600'
          }`}
        >
          My Polls ({userPolls.length})
        </button>
        <button
          onClick={() => setActiveTab('votes')}
          className={`flex-1 py-3 px-4 text-center font-medium ${
            activeTab === 'votes'
              ? 'text-forest-900 border-b-2 border-forest-700'
              : 'text-forest-600'
          }`}
        >
          My Votes ({userVotes.length})
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'polls' ? (
          userPolls.length > 0 ? (
            <div className="space-y-4">
              {userPolls.map((poll) => (
                <Link key={poll.id} href={`/poll/${poll.id}`}>
                  <div className="bg-white border border-mint-200 rounded-xl p-4 hover:border-mint-300 transition-colors mb-4">
                    <h3 className="text-forest-900 font-medium mb-2 line-clamp-2">
                      {poll.question}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-forest-600">
                      <span>{poll.total_votes} votes</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        poll.status === 'active' 
                          ? 'bg-mint-100 text-forest-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {poll.status}
                      </span>
                    </div>
                    <p className="text-forest-600 text-sm mt-1">{poll.time_ago}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-forest-900 text-lg font-medium mb-2">No polls created yet</h3>
              <p className="text-forest-600 mb-6">Create your first poll to get started!</p>
              <Link href="/create">
                <Button>Create Poll</Button>
              </Link>
            </div>
          )
        ) : (
          userVotes.length > 0 ? (
            <div className="space-y-4">
              {userVotes.map((vote) => (
                <Link key={vote.id} href={`/poll/${vote.poll_id}`}>
                  <div className="bg-white border border-mint-200 rounded-xl p-4 hover:border-mint-300 transition-colors mb-4">
                    <h3 className="text-forest-900 font-medium mb-2 line-clamp-2">
                      {vote.poll_question}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-forest-600 mb-2">
                      <span>Voted: <strong>{vote.option_text}</strong></span>
                      {vote.transaction_hash && (
                        <span className="text-xs bg-mint-100 px-2 py-1 rounded">
                          {vote.short_tx_hash || 'On-chain'}
                        </span>
                      )}
                    </div>
                    <p className="text-forest-600 text-xs">
                      {new Date(vote.voted_at * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-forest-900 text-lg font-medium mb-2">No votes cast yet</h3>
              <p className="text-forest-600 mb-6">Start voting on polls to see your activity here!</p>
              <Link href="/">
                <Button variant="secondary">Browse Polls</Button>
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}