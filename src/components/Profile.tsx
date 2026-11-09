'use client';
// Adapted from Seerr's UserProfile and user settings (MIT, https://github.com/seerr-team/seerr)
import { CheckIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import useSWR, { useSWRConfig } from 'swr';

import { usePublishers, useUser } from '@app/components/AppContext';
import Avatar from '@app/components/Common/Avatar';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import PageTitle from '@app/components/Common/PageTitle';
import PublisherPicker from '@app/components/PublisherPicker';
import ReadingSync from '@app/components/ReadingSync';
import { apiSend, errorMessage, fetcher } from '@app/lib/api';
import { hasPermission, Permission } from '@app/lib/permissions';
import { formatDate } from '@app/lib/text';
import type { ReadingSyncStatus } from '@app/lib/types';

export function sourceName(source: string): string {
  return source === 'kavita' ? 'Kavita' : source === 'komga' ? 'Komga' : source;
}

export default function Profile() {
  const { user } = useUser();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [publishers, setPublishers] = useState(usePublishers());
  const [saving, setSaving] = useState<'profile' | 'password' | 'publishers' | 'kavita' | null>(null);
  const [kavita, setKavita] = useState({ login: '', password: '' });
  const { data: reading } = useSWR<ReadingSyncStatus>('/api/v1/reading-sync', fetcher);
  const { mutate } = useSWRConfig();

  if (!user) {
    return null;
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('profile');
    try {
      await apiSend(`/api/v1/users/${user.id}`, 'PUT', { displayName, email });
      toast.success('Profile saved');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const savePublishers = async (choice: string[] | null) => {
    setSaving('publishers');
    try {
      await apiSend(`/api/v1/users/${user.id}`, 'PUT', { publishers: choice });
      toast.success(choice ? 'Publishers saved' : 'Back to the default publishers');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      toast.error("The new passwords don't match");
      return;
    }
    setSaving('password');
    try {
      await apiSend(`/api/v1/users/${user.id}`, 'PUT', { password: passwords.next, currentPassword: passwords.current });
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success(user.hasPassword ? 'Password changed. Other devices are signed out.' : 'Password set. Other devices are signed out.');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const removePassword = async () => {
    setSaving('password');
    try {
      await apiSend(`/api/v1/users/${user.id}`, 'PUT', { password: null, currentPassword: passwords.current });
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password removed. Your username is now enough to sign in.');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const linkKavita = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving('kavita');
    try {
      await apiSend('/api/v1/auth/kavita', 'POST', kavita);
      setKavita({ login: '', password: '' });
      toast.success('Kavita account connected');
      void mutate('/api/v1/reading-sync');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const unlinkKavita = async () => {
    setSaving('kavita');
    try {
      await apiSend('/api/v1/auth/kavita', 'DELETE');
      toast.success('Kavita account disconnected');
      void mutate('/api/v1/reading-sync');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const input = (id: string, label: string, type: string, value: string, onChange: (v: string) => void, autoComplete: string) => (
    <div className="form-row">
      <label htmlFor={id} className="text-label">{label}</label>
      <div className="form-input-area">
        <div className="form-input-field">
          <input id={id} type={type} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageTitle title="Profile" />
      {/* Profile header, like Seerr's ProfileHeader */}
      <div className="relative z-40 mt-6 mb-12 lg:flex lg:items-end lg:justify-between lg:space-x-5">
        <div className="flex items-end justify-items-end space-x-5">
          <Avatar name={user.displayName} className="h-20 w-20 text-2xl ring-1 ring-gray-700 md:h-24 md:w-24 md:text-3xl" />
          <div className="pt-1.5">
            <h1 className="mb-1 flex flex-col sm:flex-row sm:items-center">
              <span className="text-overseerr text-lg font-bold sm:text-2xl">{user.displayName}</span>
              <span className="text-sm text-gray-400 sm:ml-2 sm:text-lg">({user.username})</span>
            </h1>
            <p className="text-sm font-medium text-gray-400">
              {user.email && `${user.email} · `}Joined {formatDate(user.createdAt)}
            </p>
            <div className="mt-2">
              <Badge badgeType={hasPermission(Permission.ADMIN, user.permissions) ? 'success' : 'default'}>
                {hasPermission(Permission.ADMIN, user.permissions) ? 'Admin' : 'User'}
              </Badge>
              {user.authSource !== 'local' && (
                <Badge badgeType="primary" className="ml-2">{sourceName(user.authSource)} account</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <h3 className="heading">General</h3>
      <form onSubmit={saveProfile} className="section">
        {input('profile-name', 'Display Name', 'text', displayName, setDisplayName, 'nickname')}
        {input('profile-email', 'Email', 'email', email, setEmail, 'email')}
        <div className="actions">
          <div className="flex justify-end">
            <Button buttonType="primary" type="submit" disabled={saving !== null}>
              <CheckIcon />
              <span>{saving === 'profile' ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </div>
      </form>

      <h3 id="publishers" className="heading scroll-mt-24">Publishers</h3>
      <p className="description">
        Discover, the calendar and search show comics from these publishers. In search you can still pick
        &quot;All publishers&quot; to find something else.
        {!user.publishers && ' You use the default choice of this server.'}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void savePublishers(publishers);
        }}
        className="section"
      >
        <PublisherPicker value={publishers} onChange={setPublishers} />
        <div className="actions">
          <div className="flex justify-end gap-3">
            {user.publishers && (
              <Button type="button" disabled={saving !== null} onClick={() => void savePublishers(null)}>
                <span>Use Default</span>
              </Button>
            )}
            <Button buttonType="primary" type="submit" disabled={saving !== null}>
              <CheckIcon />
              <span>{saving === 'publishers' ? 'Saving...' : 'Save Publishers'}</span>
            </Button>
          </div>
        </div>
      </form>

      <h3 id="linked-accounts" className="heading scroll-mt-24">Linked Accounts</h3>
      <p className="description">
        {user.authSource === 'local'
          ? user.kavitaLinkId
            ? 'This account is connected to a Kavita account. You can sign in with either its Bubbleseerr password or your Kavita login.'
            : 'Connect your Kavita account to sign in with it. Your Bubbleseerr password keeps working.'
          : `This account is connected to your ${sourceName(user.authSource)} account and signs in with it.`}
      </p>
      <div className="section">
        <div className="form-row">
          <span className="text-label">{sourceName('kavita')}</span>
          <div className="form-input-area">
            {user.authSource === 'kavita' || user.kavitaLinkId ? (
              <div className="flex items-center gap-3">
                <Badge badgeType="success">
                  Connected{(user.kavitaLinkId ?? user.externalId) ? ` (ID ${user.kavitaLinkId ?? user.externalId})` : ''}
                </Badge>
                {user.authSource === 'local' && (
                  <Button type="button" buttonType="danger" disabled={saving !== null} onClick={() => void unlinkKavita()}>
                    <span>Disconnect</span>
                  </Button>
                )}
              </div>
            ) : (
              <Badge badgeType="default">Not connected</Badge>
            )}
          </div>
        </div>
        {user.authSource === 'komga' && (
          <div className="form-row">
            <span className="text-label">{sourceName('komga')}</span>
            <div className="form-input-area">
              <Badge badgeType="success">Connected</Badge>
            </div>
          </div>
        )}
      </div>
      {user.authSource !== 'komga' && reading && !reading.kavitaReady && (
        <form onSubmit={linkKavita} className="section">
          {(user.authSource === 'kavita' || user.kavitaLinkId) && (
            <p className="description">Log in to Kavita once more, so comics can be marked as read in your account.</p>
          )}
          {input('kavita-login', 'Kavita Username', 'text', kavita.login, (v) => setKavita({ ...kavita, login: v }), 'off')}
          {input('kavita-password', 'Kavita Password', 'password', kavita.password, (v) => setKavita({ ...kavita, password: v }), 'off')}
          <div className="actions">
            <div className="flex justify-end">
              <Button buttonType="primary" type="submit" disabled={saving !== null || !kavita.login || !kavita.password}>
                <CheckIcon />
                <span>{saving === 'kavita' ? 'Connecting...' : 'Connect Kavita'}</span>
              </Button>
            </div>
          </div>
        </form>
      )}
      {user.authSource !== 'komga' && <ReadingSync />}

      {user.authSource !== 'local' ? (
        <>
          <h3 id="password" className="heading scroll-mt-24">Password</h3>
          <p className="description">
            You sign in with your {sourceName(user.authSource)} account. Change your password in {sourceName(user.authSource)}.
          </p>
        </>
      ) : (
      <>
      <h3 id="password" className="heading scroll-mt-24">Password</h3>
      <p className="description">
        {user.hasPassword
          ? 'Remove your password to sign in with just your username. Anyone who can open this site can then sign in as you.'
          : 'This account has no password, so anyone who can open this site can sign in as you. Set one to prevent that.'}
      </p>
      <form onSubmit={savePassword} className="section">
        {user.hasPassword && input('current-password', 'Current Password', 'password', passwords.current, (v) => setPasswords({ ...passwords, current: v }), 'current-password')}
        {input('new-password', 'New Password', 'password', passwords.next, (v) => setPasswords({ ...passwords, next: v }), 'new-password')}
        {input('confirm-password', 'Repeat New Password', 'password', passwords.confirm, (v) => setPasswords({ ...passwords, confirm: v }), 'new-password')}
        <div className="actions">
          <div className="flex justify-end gap-3">
            {user.hasPassword && (
              <Button type="button" buttonType="danger" disabled={saving !== null || !passwords.current} onClick={() => void removePassword()}>
                <span>Remove Password</span>
              </Button>
            )}
            <Button buttonType="primary" type="submit" disabled={saving !== null || !passwords.next}>
              <CheckIcon />
              <span>{saving === 'password' ? 'Saving...' : user.hasPassword ? 'Change Password' : 'Set Password'}</span>
            </Button>
          </div>
        </div>
      </form>
      </>
      )}
    </>
  );
}
