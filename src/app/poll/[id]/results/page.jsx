import { AppLayout } from '@/components/layout/AppLayout';
import { Header } from '@/components/layout/Header';
import { ResultsClient } from './ResultsClient';

const API_URL = process.env.API_URL || 'http://localhost:8787/api';

async function getPollResults(id) {
  // During build time, return null
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/polls/${id}/results`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch poll results');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching poll results:', error);
    return null;
  }
}

async function getImageUrl(pollId, existingImageUrl) {
  if (existingImageUrl) {
    return existingImageUrl;
  }

  try {
    const response = await fetch(`${API_URL}/polls/${pollId}/image`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate image');
    }
    
    const data = await response.json();
    return data.image_url;
  } catch (error) {
    console.error('Error generating image:', error);
    return `${process.env.NEXT_PUBLIC_FRAME_URL || 'https://polling.center'}/api/polls/${pollId}/image`;
  }
}

// Generate dynamic frame metadata for results
export async function generateMetadata({ params }) {
  const resultsResponse = await getPollResults(params.id);
  const poll = resultsResponse?.poll;

  if (poll) {
    const winningOption = poll.options.reduce((prev, current) => 
      prev.percentage > current.percentage ? prev : current
    );

    const imageUrl = await getImageUrl(params.id, poll.image_url);

    return {
      title: `Poll Results: ${poll.question}`,
      description: `${winningOption.text} is leading with ${winningOption.percentage}% of ${poll.total_votes} votes`,
      other: {
        'fc:frame': JSON.stringify({
          version: "next",
          imageUrl: imageUrl,
          button: {
            title: "View Full Results",
            action: {
              type: "launch_frame",
              name: "Polling Center",
              url: `${process.env.NEXT_PUBLIC_FRAME_URL || 'https://polling.center'}/poll/${params.id}/results`,
              splashImageUrl: "https://images.polling.center/polling_center_square.png",
              splashBackgroundColor: "#E9FFD8"
            }
          }
        })
      }
    };
  }

  return {
    title: "Poll Results - Polling Center",
    description: "Onchain polling platform for Farcaster",
  };
}

export default async function PollResults({ params }) {
  const resultsResponse = await getPollResults(params.id);

  if (!resultsResponse || !resultsResponse.poll) {
    return (
      <AppLayout>
        <div>
          <Header title="Poll Results" showBack={true} />
          <div className="flex items-center justify-center min-h-[400px] px-4">
            <div className="text-center">
              <h3 className="text-forest-900 text-lg font-medium mb-2">Results not found</h3>
              <p className="text-forest-600">This poll may have been deleted or doesn't exist.</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const poll = resultsResponse.poll;
  const recentVotes = resultsResponse.recent_votes || [];

  return (
    <AppLayout>
      <div>
        <Header title="Poll Results" showBack={true} />
        <ResultsClient poll={poll} recentVotes={recentVotes} />
      </div>
    </AppLayout>
  );
}