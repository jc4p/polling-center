'use client';

export function FormInput({ 
  placeholder, 
  value, 
  onChange, 
  className = '',
  ...props 
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-forest-900 focus:outline-0 focus:ring-0 border border-mint-200 bg-mint-50 focus:border-mint-200 h-14 placeholder:text-forest-600 p-[15px] text-base font-normal leading-normal ${className}`}
      {...props}
    />
  );
}