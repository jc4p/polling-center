import { AppLayout } from '@/components/layout/AppLayout';
import { Header } from '@/components/layout/Header';
import { PollVoteClient } from './PollVoteClient';

const API_URL = process.env.API_URL || 'http://localhost:8787/api';

async function getPollData(id) {
  // During build time, return mock data
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/polls/${id}`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch poll');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching poll:', error);
    return null;
  }
}

async function getVotes(pollId) {
  // During build time, return empty votes
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_URL) {
    return { votes: [] };
  }

  try {
    const response = await fetch(`${API_URL}/votes?poll_id=${pollId}&limit=10`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch votes');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching votes:', error);
    return { votes: [] };
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

// Generate dynamic frame metadata
export async function generateMetadata({ params }) {
  const pollId = (await params).id;
  const pollResponse = await getPollData(pollId);
  const poll = pollResponse?.poll;

  if (poll) {
    const imageUrl = await getImageUrl(pollId, poll.image_url);

    return {
      title: `Poll: ${poll.question}`,
      description: `Vote on this poll with ${poll.total_votes} total votes`,
      other: {
        'fc:frame': JSON.stringify({
          version: "next",
          imageUrl: imageUrl,
          button: {
            title: "Vote on Poll",
            action: {
              type: "launch_frame",
              name: "Polling Center",
              url: `${process.env.NEXT_PUBLIC_FRAME_URL || 'https://polling.center'}/poll/${pollId}`,
              splashImageUrl: "https://images.polling.center/polling_center_square.png",
              splashBackgroundColor: "#E9FFD8"
            }
          }
        })
      }
    };
  }

  return {
    title: "Poll - Polling Center",
    description: "Onchain polling platform for Farcaster",
  };
}

export default async function PollVote({ params }) {
  const pollResponse = await getPollData(params.id);
  const votesResponse = await getVotes(params.id);

  if (!pollResponse || !pollResponse.poll) {
    return (
      <AppLayout>
        <div>
          <Header title="Poll" showBack={true} />
          <div className="flex items-center justify-center min-h-[400px] px-4">
            <div className="text-center">
              <h3 className="text-forest-900 text-lg font-medium mb-2">Poll not found</h3>
              <p className="text-forest-600">This poll may have been deleted or doesn't exist.</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const poll = pollResponse.poll;
  const votes = votesResponse.votes || [];

  return (
    <AppLayout>
      <div 
        style={{
          '--radio-dot-svg': 'url(\'data:image/svg+xml,%3csvg viewBox=%270 0 16 16%27 fill=%27rgb(74,183,20)%27 xmlns=%27http://www.w3.org/2000/svg%27%3e%3ccircle cx=%278%27 cy=%278%27 r=%273%27/%3e%3c/svg%3e\')'
        }}
      >
        <Header title="Poll" showBack={true} />
        
        <div className="flex items-center gap-4 bg-mint-50 px-4 min-h-[72px] py-2">
          <div 
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-10 w-fit"
            style={{ backgroundImage: `url("${poll.creator.pfp_url}")` }}
          ></div>
          <div className="flex flex-col justify-center flex-1">
            <p className="text-forest-900 text-base font-medium leading-normal line-clamp-1">
              {poll.question}
            </p>
            <p className="text-forest-600 text-sm font-normal leading-normal line-clamp-2">
              by {poll.creator.display_name} · {poll.time_ago} · {poll.total_votes} voters
            </p>
          </div>
        </div>

        <PollVoteClient poll={poll} votes={votes} />
      </div>
    </AppLayout>
  );
}