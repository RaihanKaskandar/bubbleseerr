// Adapted from Seerr's Common/Button (MIT, https://github.com/seerr-team/seerr)
import Link from 'next/link';
import React from 'react';
import { twMerge } from 'tailwind-merge';

export type ButtonType = 'default' | 'primary' | 'danger' | 'warning' | 'success' | 'ghost';

type Props = {
  buttonType?: ButtonType;
  buttonSize?: 'default' | 'lg' | 'md' | 'sm';
  /** Render as a link */
  href?: string;
  external?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function buttonClasses(
  buttonType: ButtonType = 'default',
  buttonSize: Props['buttonSize'] = 'default',
  className?: string
): string {
  const style = [
    'inline-flex items-center justify-center border leading-5 font-medium rounded-md focus:outline-none transition ease-in-out duration-150 cursor-pointer disabled:opacity-50 whitespace-nowrap',
  ];
  switch (buttonType) {
    case 'primary':
      style.push('text-white border border-indigo-500 bg-indigo-600/80 hover:bg-indigo-600 hover:border-indigo-500 focus:border-indigo-700 active:bg-indigo-600 active:border-indigo-700');
      break;
    case 'danger':
      style.push('text-white bg-red-600/80 border-red-500 hover:bg-red-600 hover:border-red-500 focus:border-red-700 active:bg-red-700 active:border-red-700');
      break;
    case 'warning':
      style.push('text-white border border-yellow-500 bg-yellow-500/80 hover:bg-yellow-500 hover:border-yellow-400 focus:border-yellow-700 active:bg-yellow-500 active:border-yellow-700');
      break;
    case 'success':
      style.push('text-white bg-green-500/80 border-green-500 hover:bg-green-500 hover:border-green-400 focus:border-green-700 active:bg-green-500 active:border-green-700');
      break;
    case 'ghost':
      style.push('text-white bg-transparent border-gray-600 hover:border-gray-200 focus:border-gray-100 active:border-gray-100');
      break;
    default:
      style.push('text-gray-200 bg-gray-800/80 border-gray-600 hover:text-white hover:bg-gray-700 hover:border-gray-600 focus:border-blue-300 active:text-gray-200 active:bg-gray-700 active:border-gray-600');
  }
  switch (buttonSize) {
    case 'sm':
      style.push('px-2.5 py-1.5 text-xs button-sm');
      break;
    case 'lg':
      style.push('px-6 py-3 text-base button-lg');
      break;
    default:
      style.push('px-4 py-2 text-sm button-md');
  }
  return twMerge(style.join(' '), className);
}

const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { buttonType, buttonSize, className, children, href, external, type = 'button', ...props },
  ref
) {
  const classes = buttonClasses(buttonType, buttonSize, className);
  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        <span className="flex items-center">{children}</span>
      </a>
    ) : (
      <Link href={href} className={classes}>
        <span className="flex items-center">{children}</span>
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} {...props}>
      <span className="flex items-center">{children}</span>
    </button>
  );
});

export default Button;
