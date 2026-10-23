// Adapted from Seerr's Common/Alert (MIT, https://github.com/seerr-team/seerr)
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';
import React from 'react';

interface AlertProps {
  title?: React.ReactNode;
  type?: 'warning' | 'info' | 'error';
  children?: React.ReactNode;
}

export default function Alert({ title, type = 'warning', children }: AlertProps) {
  const design = {
    warning: { bg: 'border border-yellow-500 backdrop-blur bg-yellow-400/20', title: 'text-yellow-100', text: 'text-yellow-300', Icon: ExclamationTriangleIcon },
    info: { bg: 'border border-indigo-500 backdrop-blur bg-indigo-400/20', title: 'text-gray-100', text: 'text-gray-300', Icon: InformationCircleIcon },
    error: { bg: 'bg-red-600', title: 'text-red-100', text: 'text-red-300', Icon: XCircleIcon },
  }[type];
  return (
    <div className={`mb-4 rounded-md p-4 ${design.bg}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="flex">
        <div className={`flex-shrink-0 ${design.title}`}>
          <design.Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          {title && <div className={`text-sm font-medium ${design.title}`}>{title}</div>}
          {children && <div className={`mt-2 text-sm first:mt-0 ${design.text}`}>{children}</div>}
        </div>
      </div>
    </div>
  );
}
