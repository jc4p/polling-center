'use client';

import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export function HomeClient({ polls, error }) {
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
      <div className="space-y-4">
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