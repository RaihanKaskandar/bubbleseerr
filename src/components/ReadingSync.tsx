'use client';
import { ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';

import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import { apiSend, errorMessage, fetcher } from '@app/lib/api';
import { formatDate } from '@app/lib/text';
import type { ReadingSyncStatus } from '@app/lib/types';

/** Connecting a League of Comic Geeks read list, on the profile page */
export default function ReadingSync() {
  const { data: status, mutate } = useSWR<ReadingSyncStatus>('/api/v1/reading-sync', fetcher, {
    // A sync waits 30 seconds between requests, so it can take a while
    refreshInterval: (latest) => (latest?.running ? 5000 : 0),
  });
  const [profile, setProfile] = useState('');
  const [saving, setSaving] = useState(false);

  if (!status) {
    return null;
  }

  const send = async (method: 'PUT' | 'POST' | 'DELETE', body?: unknown) => {
    setSaving(true);
    try {
      await mutate(await apiSend<ReadingSyncStatus>('/api/v1/reading-sync', method, body), { revalidate: false });
      setProfile('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const result = status.lastResult;

  return (
    <div className="section">
      <div className="form-row">
        <span className="text-label">League of Comic Geeks</span>
        <div className="form-input-area">
          {status.locgUsername ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge badgeType="success">Connected ({status.locgUsername})</Badge>
              <Button type="button" disabled={saving || status.running || !status.kavitaReady} onClick={() => void send('POST')}>
                <ArrowPathIcon />
                <span>{status.running ? 'Syncing...' : 'Sync Now'}</span>
              </Button>
              <Button type="button" buttonType="danger" disabled={saving || status.running} onClick={() => void send('DELETE')}>
                <span>Disconnect</span>
              </Button>
            </div>
          ) : (
            <Badge badgeType="default">Not connected</Badge>
          )}
        </div>
      </div>

      {!status.kavitaReady && (
        <p className="description">
          Connect Kavita above first: comics are marked as read in your own Kavita account.
        </p>
      )}

      {status.running && (
        <p className="description">
          Syncing. League of Comic Geeks asks for 30 seconds between requests, so this can take a few minutes. You can
          leave this page.
        </p>
      )}

      {!status.running && status.lastError && <p className="description text-red-400">{status.lastError}</p>}

      {!status.running && !status.lastError && result && status.lastSync && (
        <div className="description">
          <p>
            Last sync {formatDate(status.lastSync)}: {result.marked} {result.marked === 1 ? 'issue' : 'issues'} marked as
            read. {result.matched} of the {result.series} series on your read list are in Kavita.
            {result.series === 0 && ' Your read list looks empty; is your profile public?'}
          </p>
          {result.unsure.length > 0 && (
            <>
              <p className="mt-2">Left alone, as it isn&apos;t certain these are the same comic:</p>
              <ul className="mt-1 list-disc pl-5">
                {result.unsure.map((s) => (
                  <li key={`${s.title}-${s.year}`}>
                    {s.title}
                    {s.year ? ` (${s.year})` : ''}: {s.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {!status.locgUsername && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send('PUT', { profile });
          }}
        >
          <div className="form-row">
            <label htmlFor="locg-profile" className="text-label">
              Profile
              <span className="label-tip">Your profile link or name. Your read list has to be public.</span>
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <input
                  id="locg-profile"
                  type="text"
                  value={profile}
                  placeholder="https://leagueofcomicgeeks.com/profile/yourname"
                  autoComplete="off"
                  onChange={(e) => setProfile(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="actions">
            <div className="flex justify-end">
              <Button buttonType="primary" type="submit" disabled={saving || !profile.trim() || !status.kavitaReady}>
                <CheckIcon />
                <span>{saving ? 'Connecting...' : 'Connect'}</span>
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
