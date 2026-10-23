'use client';
/** Choose publishers, as cards with their logo like Seerr's studio cards */
import { CheckCircleIcon } from '@heroicons/react/24/solid';

import { OTHER_PUBLISHERS, PUBLISHER_CHOICES, PUBLISHERS } from '@app/lib/publishers';

interface PublisherPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export default function PublisherPicker({ value, onChange, disabled }: PublisherPickerProps) {
  const toggle = (slug: string) => {
    const next = value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug];
    // In the order of the list, and never nothing
    if (next.length) {
      onChange(PUBLISHER_CHOICES.filter((s) => next.includes(s)));
    }
  };
  const options = [
    ...PUBLISHERS.map((p) => ({ slug: p.slug, name: p.name, logo: p.logo })),
    { slug: OTHER_PUBLISHERS, name: 'Other publishers', logo: null },
  ];
  const allChosen = PUBLISHER_CHOICES.every((s) => value.includes(s));

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {options.map((option) => {
          const checked = value.includes(option.slug);
          return (
            <li key={option.slug}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={option.name}
                disabled={disabled}
                onClick={() => toggle(option.slug)}
                className={`relative flex h-16 w-full items-center justify-center rounded-xl px-4 ring-1 transition ${
                  checked
                    ? 'bg-gray-700 ring-2 ring-indigo-500'
                    : 'bg-gray-800 opacity-60 ring-gray-700 hover:opacity-100'
                }`}
              >
                {option.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.logo} alt="" className="max-h-10 max-w-[75%] object-contain" />
                ) : (
                  <span className="text-center text-sm font-bold leading-tight text-white">{option.name}</span>
                )}
                {checked && <CheckCircleIcon className="absolute right-1.5 top-1.5 h-5 w-5 text-indigo-400" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-4 text-sm">
        <button
          type="button"
          className="text-indigo-400 hover:underline disabled:text-gray-500 disabled:no-underline"
          disabled={disabled || allChosen}
          onClick={() => onChange([...PUBLISHER_CHOICES])}
        >
          Select all
        </button>
      </div>
    </div>
  );
}
