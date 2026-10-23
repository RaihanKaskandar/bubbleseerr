'use client';
/** Release calendar, in Seerr's style: month grid on large screens, a list on phones */
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

import { usePublishers } from '@app/components/AppContext';
import Alert from '@app/components/Common/Alert';
import Badge, { type BadgeType } from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import { errorMessage, fetcher } from '@app/lib/api';
import { describePublishers } from '@app/lib/publishers';
import type { CalendarEntry } from '@app/server/discover';

const STATUS: Record<string, { label: string; badge: BadgeType; bar: string }> = {
  downloaded: { label: 'Available', badge: 'success', bar: 'border-green-500' },
  missing: { label: 'Requested', badge: 'primary', bar: 'border-indigo-500' },
  upcoming: { label: 'Upcoming', badge: 'warning', bar: 'border-yellow-500' },
  unmonitored: { label: 'Not Requested', badge: 'light', bar: 'border-gray-500' },
  not_added: { label: 'Not in Library', badge: 'dark', bar: 'border-gray-600' },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The days shown for a month: whole weeks, Monday to Sunday */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function Cover({ entry, className }: { entry: CalendarEntry; className: string }) {
  return entry.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.coverUrl} alt="" loading="lazy" className={`flex-shrink-0 rounded object-cover ${className}`} />
  ) : (
    <div className={`flex-shrink-0 rounded bg-gray-700 ${className}`} />
  );
}

function EntryRow({ entry }: { entry: CalendarEntry }) {
  const status = STATUS[entry.status] ?? STATUS.not_added;
  return (
    <Link
      href={`/comic/${entry.comicvineId}`}
      className={`flex items-center gap-3 rounded-lg border-l-4 bg-gray-800 p-2 pr-3 ring-1 ring-gray-700 transition hover:bg-gray-700 ${status.bar}`}
    >
      <Cover entry={entry} className="h-16 w-11" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">
          {entry.title} <span className="text-gray-300">#{entry.issueNumber}</span>
        </div>
        <div className="truncate text-xs text-gray-400">{[entry.issueTitle, entry.publisher].filter(Boolean).join(' · ')}</div>
      </div>
      <Badge badgeType={status.badge}>{status.label}</Badge>
    </Link>
  );
}

const dayHeading = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const monthHeading = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export default function Calendar() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [everything, setEverything] = useState(false);
  const publishers = usePublishers();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [selected, setSelected] = useState<string | null>(null);
  const today = iso(new Date());

  useEffect(() => {
    // Phones get the list, it doesn't fit a month grid
    if (window.matchMedia('(max-width: 767px)').matches) setView('list');
    try {
      if (localStorage.getItem('calendar-everything') === '1') setEverything(true);
    } catch {
      // No storage
    }
  }, []);

  const days = useMemo(() => monthGrid(month), [month]);
  const start = iso(days[0]);
  const end = iso(days[days.length - 1]);
  const { data, error } = useSWR<CalendarEntry[]>(
    `/api/v1/calendar?start=${start}&end=${end}${everything ? '&all=1' : ''}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of data ?? []) {
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return map;
  }, [data]);

  const move = (delta: number) => {
    setSelected(null);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const toggleEverything = (on: boolean) => {
    setEverything(on);
    try {
      localStorage.setItem('calendar-everything', on ? '1' : '0');
    } catch {
      // No storage
    }
  };

  const listDays = [...byDay.keys()]
    .filter((d) => d.slice(0, 7) === iso(month).slice(0, 7))
    .sort();

  return (
    <>
      <PageTitle title="Calendar" />
      <Header subtext="When new issues of your comics come out">Calendar</Header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeftIcon />
          </Button>
          <Button
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelected(today);
            }}
          >
            Today
          </Button>
          <Button onClick={() => move(1)} aria-label="Next month">
            <ChevronRightIcon />
          </Button>
          <h3 className="ml-2 text-xl font-bold text-white sm:text-2xl">{monthHeading.format(month)}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="!mb-0 flex cursor-pointer items-center gap-2 text-sm !font-medium !text-gray-200">
            <input type="checkbox" checked={everything} onChange={(e) => toggleEverything(e.target.checked)} className="!h-5 !w-5" />
            All new comics
          </label>
          <div className="inline-flex rounded-md shadow-sm" role="group" aria-label="View">
            {(['month', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`border border-gray-600 px-3 py-2 text-sm font-medium first:rounded-l-md last:rounded-r-md ${
                  view === v ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {v === 'month' ? 'Month' : 'List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        {Object.entries(STATUS)
          .filter(([k]) => everything || k !== 'not_added')
          .map(([k, s]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-1 rounded border-l-4 ${s.bar}`} />
              {s.label}
            </span>
          ))}
      </div>
      {everything && (
        <p className="mt-2 text-xs text-gray-500">
          New comics from {describePublishers(publishers)} (
          <Link href="/profile#publishers" className="text-indigo-400 hover:underline">change</Link>
          ). Comics that aren&apos;t in the library are only known for the last few weeks.
        </p>
      )}

      {error && (
        <div className="mt-6">
          <Alert type="error" title="Couldn't load the calendar">{errorMessage(error)}</Alert>
        </div>
      )}
      {!data && !error && <LoadingSpinner />}

      {data && view === 'month' && (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-700">
          <div className="grid grid-cols-7 bg-gray-700/80 text-center text-xs font-medium uppercase tracking-wider text-gray-200">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-700">
            {days.map((day) => {
              const key = iso(day);
              const entries = byDay.get(key) ?? [];
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(selected === key ? null : key)}
                  aria-label={`${dayHeading.format(day)}: ${entries.length} releases`}
                  className={`flex min-h-[7.5rem] flex-col gap-1 p-1.5 text-left transition ${
                    inMonth ? 'bg-gray-900' : 'bg-gray-900/60'
                  } ${selected === key ? 'ring-2 ring-inset ring-indigo-500' : 'hover:bg-gray-800'}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? 'bg-indigo-600 text-white' : inMonth ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {entries.slice(0, 3).map((e, i) => (
                    <span
                      key={`${e.comicvineId}-${e.issueNumber}-${i}`}
                      className={`flex items-center gap-1.5 truncate rounded border-l-2 bg-gray-800 py-0.5 pl-1 pr-1.5 text-xs text-gray-200 ${(STATUS[e.status] ?? STATUS.not_added).bar}`}
                    >
                      <Cover entry={e} className="h-6 w-4" />
                      <span className="truncate">
                        {e.title} #{e.issueNumber}
                      </span>
                    </span>
                  ))}
                  {entries.length > 3 && <span className="pl-1 text-xs font-medium text-indigo-300">+{entries.length - 3} more</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data && view === 'month' && selected && (
        <section className="mt-6">
          <h3 className="mb-3 text-lg font-bold text-white">{dayHeading.format(new Date(`${selected}T12:00:00`))}</h3>
          {(byDay.get(selected) ?? []).length === 0 ? (
            <p className="text-gray-400">Nothing comes out this day.</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {(byDay.get(selected) ?? []).map((e, i) => (
                <li key={`${e.comicvineId}-${e.issueNumber}-${i}`}>
                  <EntryRow entry={e} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && view === 'list' && (
        <div className="mt-6 space-y-6">
          {listDays.length === 0 && <p className="py-16 text-center text-lg text-gray-400">Nothing comes out this month.</p>}
          {listDays.map((d) => (
            <section key={d}>
              <h3 className={`mb-2 text-sm font-bold uppercase tracking-wider ${d === today ? 'text-indigo-400' : 'text-gray-400'}`}>
                {d === today ? 'Today · ' : ''}
                {dayHeading.format(new Date(`${d}T12:00:00`))}
              </h3>
              <ul className="grid gap-2 lg:grid-cols-2">
                {(byDay.get(d) ?? []).map((e, i) => (
                  <li key={`${e.comicvineId}-${e.issueNumber}-${i}`}>
                    <EntryRow entry={e} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
