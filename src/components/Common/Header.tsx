// Adapted from Seerr's Common/Header (MIT, https://github.com/seerr-team/seerr)
import React from 'react';

interface HeaderProps {
  children: React.ReactNode;
  subtext?: React.ReactNode;
  extra?: React.ReactNode;
}

export default function Header({ children, subtext, extra }: HeaderProps) {
  return (
    <div className="mt-8 md:flex md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="mb-4 truncate text-2xl font-bold leading-7 text-gray-100 sm:overflow-visible sm:text-4xl sm:leading-9 md:mb-0">
          <span className="text-overseerr">{children}</span>
        </h2>
        {subtext && <div className="mt-2 text-gray-400">{subtext}</div>}
      </div>
      {extra && <div className="mt-4 flex flex-shrink-0 flex-wrap gap-2 md:ml-4 md:mt-0">{extra}</div>}
    </div>
  );
}
