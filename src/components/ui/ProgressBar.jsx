'use client';

export function ProgressBar({ percentage, label, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex gap-6 justify-between">
        <p className="text-forest-900 text-base font-medium leading-normal">{label}</p>
        <p className="text-forest-900 text-sm font-normal leading-normal">{percentage}%</p>
      </div>
      <div className="rounded bg-mint-200">
        <div 
          className="h-2 rounded bg-forest-700 transition-all duration-300" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}