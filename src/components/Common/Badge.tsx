// Adapted from Seerr's Common/Badge (MIT, https://github.com/seerr-team/seerr)
import Link from 'next/link';
import React from 'react';

export type BadgeType = 'default' | 'primary' | 'danger' | 'warning' | 'success' | 'dark' | 'light';

interface BadgeProps {
  badgeType?: BadgeType;
  className?: string;
  href?: string;
  children: React.ReactNode;
}

export default function Badge({ badgeType = 'default', className, href, children }: BadgeProps) {
  const style = ['px-2 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap'];
  style.push(href ? 'transition cursor-pointer !no-underline' : 'cursor-default');

  switch (badgeType) {
    case 'danger':
      style.push('bg-red-600/80 border-red-500 border !text-red-100', href ? 'hover:bg-red-500' : '');
      break;
    case 'warning':
      style.push('bg-yellow-500/80 border-yellow-500 border !text-yellow-100', href ? 'hover:bg-yellow-500' : '');
      break;
    case 'success':
      style.push('bg-green-500/80 border border-green-500 !text-green-100', href ? 'hover:bg-green-500' : '');
      break;
    case 'dark':
      style.push('bg-gray-900 !text-gray-400', href ? 'hover:bg-gray-800' : '');
      break;
    case 'light':
      style.push('bg-gray-700 !text-gray-300', href ? 'hover:bg-gray-600' : '');
      break;
    default:
      style.push('bg-indigo-500/80 border border-indigo-500 !text-indigo-100', href ? 'hover:bg-indigo-500' : '');
  }
  if (className) {
    style.push(className);
  }
  const classes = style.filter(Boolean).join(' ');

  if (href?.includes('://')) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>{children}</a>;
  }
  if (href) {
    return <Link href={href} className={classes}>{children}</Link>;
  }
  return <span className={classes}>{children}</span>;
}
