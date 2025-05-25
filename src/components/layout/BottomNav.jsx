'use client';

import { House, Plus, User } from 'phosphor-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: House, weight: pathname === '/' ? 'fill' : 'regular', label: 'Home' },
    { href: '/create', icon: Plus, weight: 'regular', label: 'Create' },
    { href: '/profile', icon: User, weight: 'regular', label: 'Profile' },
  ];

  return (
    <div>
      <div className="flex gap-2 border-t border-mint-100 bg-mint-50 px-4 pb-3 pt-2">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          
          return (
            <Link 
              key={index}
              href={item.href}
              className={`just flex flex-1 flex-col items-center justify-end gap-1 rounded-full ${
                isActive ? 'text-forest-900' : 'text-forest-600'
              }`}
            >
              <div className={`flex h-8 items-center justify-center ${
                isActive ? 'text-forest-900' : 'text-forest-600'
              }`}>
                <IconComponent size={24} weight={item.weight} />
              </div>
            </Link>
          );
        })}
      </div>
      <div className="h-5 bg-mint-50"></div>
    </div>
  );
}