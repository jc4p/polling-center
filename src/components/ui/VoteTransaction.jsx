'use client';

export function VoteTransaction({ user, transaction, avatar }) {
  return (
    <div className="flex items-center gap-4 bg-mint-50 px-4 min-h-[72px] py-2">
      <div
        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-fit"
        style={{ backgroundImage: `url("${avatar}")` }}
      ></div>
      <div className="flex flex-col justify-center">
        <p className="text-forest-900 text-base font-medium leading-normal line-clamp-1">{user}</p>
        <p className="text-forest-600 text-sm font-normal leading-normal line-clamp-2">{transaction}</p>
      </div>
    </div>
  );
}