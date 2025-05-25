'use client';

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'medium',
  className = '',
  disabled = false,
  onClick,
  ...props 
}) {
  const baseClasses = 'flex cursor-pointer items-center justify-center overflow-hidden rounded-full font-bold leading-normal tracking-[0.015em] transition-all';
  
  const variants = {
    primary: 'bg-forest-700 text-forest-900',
    secondary: 'bg-mint-100 text-forest-900',
  };
  
  const sizes = {
    small: 'h-10 px-4 text-sm',
    medium: 'h-12 px-5 text-base',
  };
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      <span className="truncate">{children}</span>
    </button>
  );
}