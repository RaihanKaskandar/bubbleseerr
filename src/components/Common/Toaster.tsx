'use client';
import { Toaster as HotToaster } from 'react-hot-toast';

/** Toasts in Seerr's style: dark, bottom right on desktop */
export default function Toaster() {
  return (
    <HotToaster
      position="bottom-right"
      containerStyle={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      toastOptions={{
        className: '!bg-gray-800/90 !text-gray-100 !ring-1 !ring-gray-700 !backdrop-blur !shadow-lg !rounded-lg !text-sm',
        success: { iconTheme: { primary: '#22c55e', secondary: '#1f2937' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#1f2937' } },
      }}
    />
  );
}
