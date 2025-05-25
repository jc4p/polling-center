'use client';

import { Heart, Smiley, SmileyNervous } from 'phosphor-react';

export function EmojiReactions({ reactions = [] }) {
  const defaultReactions = [
    { icon: Heart, count: 0 },
    { icon: Smiley, count: 0 },
    { icon: SmileyNervous, count: 0 },
    { icon: Smiley, count: 0 },
  ];

  const displayReactions = reactions.length > 0 ? reactions : defaultReactions;

  return (
    <div className="flex flex-wrap gap-4 px-4 py-2">
      {displayReactions.map((reaction, index) => {
        const IconComponent = reaction.icon;
        return (
          <div key={index} className="flex items-center justify-center gap-2 px-3 py-2">
            <div className="text-forest-600">
              <IconComponent size={24} weight="regular" />
            </div>
          </div>
        );
      })}
    </div>
  );
}