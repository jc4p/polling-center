'use client';

import { ArrowLeft, X } from 'phosphor-react';
import { useRouter } from 'next/navigation';

export function Header({ title, showBack = false, showClose = false, onBack, onClose }) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.push('/');
    }
  };

  return (showBack || showClose) && (
    <div className="flex items-center bg-mint-50 p-4 pb-2 justify-between">
      <div className="text-forest-900 flex size-12 shrink-0 items-center">
        {showBack && (
          <button onClick={handleBack}>
            <ArrowLeft size={24} weight="regular" />
          </button>
        )}
        {showClose && (
          <button onClick={handleClose}>
            <X size={24} weight="regular" />
          </button>
        )}
      </div>
    </div>
  )
}