import { AppLayout } from '@/components/layout/AppLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { HomeClient } from './HomeClient';
import Link from 'next/link';

export async function generateMetadata() {
  const appUrl = process.env.NEXT_PUBLIC_FRAME_URL || "http://localhost:3000";

  return {
    title: "Polling Center",
    description: "Onchain polling platform for Farcaster",
    other: {
      'fc:frame': JSON.stringify({
        version: "next",
        imageUrl: "https://images.polling.center/polling_center_rectangle.png",
        button: {
          title: "Open Polling Center",
          action: {
            type: "launch_frame",
            name: "Polling Center",
            url: appUrl,
            splashImageUrl: "https://images.polling.center/polling_center_square.png",
            splashBackgroundColor: "#E9FFD8"
          }
        }
      })
    }
  };
}

const API_URL = process.env.API_URL || 'http://localhost:8787/api';

async function getPolls() {
  // During build time, don't try to fetch from API
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
    return { polls: [], error: null };
  }

  try {
    const response = await fetch(`${API_URL}/polls?limit=10`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch polls');
    }
    
    const data = await response.json();
    return { polls: data.polls || [], error: null };
  } catch (error) {
    console.error('Error fetching polls:', error);
    return { polls: [], error: error.message };
  }
}

export default async function Home() {
  const { polls, error } = await getPolls();

  return (
    <AppLayout>
      <div>
        <Header title="Polling Center" />
        
        <div className="px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-forest-900 text-xl font-bold">Recent Polls</h2>
            <Link href="/create">
              <Button size="small">Create Poll</Button>
            </Link>
          </div>

          <HomeClient initialPolls={polls} initialError={error} />
        </div>
      </div>
    </AppLayout>
  );
}
