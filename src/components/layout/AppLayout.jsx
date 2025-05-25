'use client';

import { BottomNav } from './BottomNav';

export function AppLayout({ children, showBottomNav = true }) {
  return (
    <div 
      className="relative flex size-full min-h-screen flex-col bg-mint-50 justify-between group/design-root overflow-x-hidden"
      style={{ fontFamily: '"Space Grotesk", "Noto Sans", sans-serif' }}
    >
      {children}
      {showBottomNav && <BottomNav />}
    </div>
  );
}