// Adapted from Seerr's Common/Table (MIT, https://github.com/seerr-team/seerr)
import React from 'react';

export function TH({ className, ...props }: React.ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className={`truncate bg-gray-500 px-4 py-3 text-left text-xs font-medium uppercase leading-4 tracking-wider text-gray-200 ${className ?? ''}`}
      {...props}
    />
  );
}

export function TD({ className, alignText = 'left', ...props }: React.ComponentPropsWithoutRef<'td'> & { alignText?: 'left' | 'center' | 'right' }) {
  return <td className={`px-4 py-4 text-sm leading-5 text-white text-${alignText} ${className ?? ''}`} {...props} />;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-700 bg-gray-800">{children}</tbody>;
}

export default function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="-mx-4 my-2 overflow-x-auto md:mx-0 lg:mx-0">
        <div className="inline-block min-w-full py-2 align-middle">
          <div className="overflow-hidden rounded-lg shadow md:mx-0 lg:mx-0">
            <table className="min-w-full">{children}</table>
          </div>
        </div>
      </div>
    </div>
  );
}
