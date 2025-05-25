'use client';

export function DurationSelector({ value, onChange, options = ['1 day', '3 days', '7 days'] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label
          key={option}
          className={`text-sm font-medium leading-normal flex items-center justify-center rounded-xl border px-4 h-11 text-forest-900 cursor-pointer transition-all ${
            value === option
              ? 'border-[3px] border-forest-700 px-3.5'
              : 'border border-mint-200'
          }`}
        >
          {option}
          <input
            type="radio"
            className="invisible absolute"
            name="duration"
            value={option}
            checked={value === option}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}