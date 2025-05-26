'use client';

export function VoteTransaction({ user, transaction, avatar, timestamp }) {
  // Helper function to format time ago
  const formatTimeAgo = (unixTimestamp) => {
    if (!unixTimestamp) return '';
    
    const now = Math.floor(Date.now() / 1000);
    const diff = now - unixTimestamp;
    
    if (diff < 3600) { // Less than 1 hour
      const minutes = Math.floor(diff / 60);
      return minutes <= 1 ? '1m ago' : `${minutes}m ago`;
    } else if (diff < 86400) { // Less than 1 day
      const hours = Math.floor(diff / 3600);
      return hours === 1 ? '1h ago' : `${hours}h ago`;
    } else { // 1 day or more
      const days = Math.floor(diff / 86400);
      return days === 1 ? '1d ago' : `${days}d ago`;
    }
  };

  return (
    <div className="flex items-center gap-4 bg-mint-50 px-4 min-h-[72px] py-2">
      <div
        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-fit"
        style={{ backgroundImage: `url("${avatar}")` }}
      ></div>
      <div className="flex flex-col justify-center flex-1">
        <p className="text-forest-900 text-base font-medium leading-normal line-clamp-1">{user}</p>
        <p className="text-forest-600 text-sm font-normal leading-normal line-clamp-2">{transaction}</p>
      </div>
      {timestamp && (
        <div className="text-forest-600 text-xs font-normal">
          {formatTimeAgo(timestamp)}
        </div>
      )}
    </div>
  );
}