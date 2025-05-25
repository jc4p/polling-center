import { AppLayout } from '@/components/layout/AppLayout';
import { Header } from '@/components/layout/Header';
import { ProfileClient } from './ProfileClient';

const API_URL = process.env.API_URL || 'http://localhost:8787/api';

async function getUserProfile() {
  // During build time, return null
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
    return { user: null, userPolls: [], userVotes: [], error: null };
  }

  // In a real implementation, this would get the user FID from Frame context
  // For now, we'll return mock data or handle the unauthenticated case
  try {
    // This would normally use the JWT token from Frame authentication
    // const response = await fetch(`${API_URL}/profile`, {
    //   headers: { 'Authorization': `Bearer ${token}` }
    // });
    
    // For now, return null to show unauthenticated state
    return { user: null, userPolls: [], userVotes: [], error: null };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { user: null, userPolls: [], userVotes: [], error: error.message };
  }
}

async function getUserPolls(userFid) {
  if (!userFid || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL)) {
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/polls?creator_fid=${userFid}&limit=50`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user polls');
    }
    
    const data = await response.json();
    return data.polls || [];
  } catch (error) {
    console.error('Error fetching user polls:', error);
    return [];
  }
}

async function getUserVotes(userFid) {
  if (!userFid || (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL)) {
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/votes?voter_fid=${userFid}&limit=50`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user votes');
    }
    
    const data = await response.json();
    return data.votes || [];
  } catch (error) {
    console.error('Error fetching user votes:', error);
    return [];
  }
}

export default async function Profile() {
  const { user, error } = await getUserProfile();
  const userPolls = user ? await getUserPolls(user.fid) : [];
  const userVotes = user ? await getUserVotes(user.fid) : [];

  return (
    <AppLayout>
      <div>
        <Header title="Profile" />
        <ProfileClient 
          user={user}
          userPolls={userPolls}
          userVotes={userVotes}
          error={error}
        />
      </div>
    </AppLayout>
  );
}