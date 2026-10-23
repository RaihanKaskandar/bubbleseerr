'use client';
import { ArrowPathIcon, BeakerIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Toggle from '@app/components/Common/Toggle';
import PermissionEdit from '@app/components/PermissionEdit';
import PublisherPicker from '@app/components/PublisherPicker';
import BubblarrForm from '@app/components/Settings/BubblarrForm';
import KavitaForm from '@app/components/Settings/KavitaForm';
import { useSettings } from '@app/components/Settings/useSettings';
import WebhookInfo from '@app/components/Settings/WebhookInfo';
import { apiSend, errorMessage } from '@app/lib/api';
import { formatDate, timeAgo } from '@app/lib/text';

function Section({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="mb-6">
        <h3 className="heading">{title}</h3>
        {description && <p className="description">{description}</p>}
      </div>
      <div className="section">{children}</div>
    </>
  );
}

function SaveButton({ saving }: { saving: boolean }) {
  return (
    <div className="actions">
      <div className="flex justify-end">
        <Button buttonType="primary" type="submit" disabled={saving}>
          <CheckIcon />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </Button>
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const { data, error, mutate } = useSettings();
  const [title, setTitle] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.appTitle);
      setAppUrl(data.appUrl);
    }
  }, [data]);

  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await mutate(apiSend('/api/v1/settings', 'PUT', { appTitle: title, appUrl }), { revalidate: false });
      toast.success('Settings saved. Reload to see a new title everywhere.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="General Settings" description="How the app is called and where people reach it.">
      <form onSubmit={save}>
        <div className="form-row">
          <label htmlFor="app-title" className="text-label">Application Title</label>
          <div className="form-input-area">
            <div className="form-input-field">
              <input id="app-title" type="text" required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="app-url" className="text-label">
            Application URL
            <span className="label-tip">The address people use, e.g. https://comics.example.com. Used for the webhook URL.</span>
          </label>
          <div className="form-input-area">
            <div className="form-input-field">
              <input id="app-url" type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://bubbleseerr.example.com" />
            </div>
          </div>
        </div>
        <SaveButton saving={saving} />
      </form>
    </Section>
  );
}

export function BubblarrSettings() {
  const { data, error, mutate } = useSettings();
  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;
  return (
    <Section title="Bubblarr" description="Bubblarr finds and downloads the requested comics.">
      <BubblarrForm initial={data} onSaved={() => void mutate()} />
    </Section>
  );
}

export function KavitaSettings() {
  const { data, error, mutate } = useSettings();
  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;
  return (
    <Section title="Kavita" description='Optional: show a "Read in Kavita" button on comics that are available. Leave empty to turn it off.'>
      <KavitaForm initial={data} onSaved={() => void mutate()} />
    </Section>
  );
}

export function UserSettings() {
  const { data, error, mutate } = useSettings();
  const [permissions, setPermissions] = useState(0);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setPermissions(data.defaultPermissions);
      setPublishers(data.defaultPublishers);
    }
  }, [data]);

  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await mutate(apiSend('/api/v1/settings', 'PUT', { defaultPermissions: permissions, defaultPublishers: publishers }), { revalidate: false });
      toast.success('User defaults saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="User Settings" description="The defaults for users. You can change them per user in the user list.">
      <form onSubmit={save}>
        <div className="form-row">
          <span className="group-label">
            Default Publishers
            <span className="label-tip">
              What Discover, the calendar and search show users who didn&apos;t choose their own publishers in their profile
            </span>
          </span>
          <div className="form-input-area">
            <PublisherPicker value={publishers} onChange={setPublishers} />
          </div>
        </div>
        <div className="form-row">
          <span className="group-label">Default Permissions</span>
          <div className="form-input-area">
            {/* Admin can't be a default, so it is locked here */}
            <PermissionEdit value={permissions} onChange={setPermissions} actorIsAdmin={false} />
          </div>
        </div>
        <SaveButton saving={saving} />
      </form>
    </Section>
  );
}

const SIGN_IN_OPTIONS = [
  { value: 'none', label: 'Only Bubbleseerr accounts' },
  { value: 'kavita', label: 'Kavita accounts too' },
  { value: 'komga', label: 'Komga accounts too' },
] as const;

/** Signing in with Kavita or Komga accounts, like Seerr does with Plex */
export function SignInSettings() {
  const { data, error, mutate } = useSettings();
  const [mode, setMode] = useState<'none' | 'kavita' | 'komga'>('none');
  const [komgaUrl, setKomgaUrl] = useState('');
  const [createUsers, setCreateUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) {
      setMode(data.mediaServerLogin);
      setKomgaUrl(data.komgaUrl);
      setCreateUsers(data.mediaServerCreateUsers);
    }
  }, [data]);

  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;

  const serverUrl = mode === 'kavita' ? data.kavitaUrl : komgaUrl;
  const serverName = mode === 'kavita' ? 'Kavita' : 'Komga';

  const test = async () => {
    setTesting(true);
    try {
      const result = await apiSend<{ success: boolean; message?: string }>('/api/v1/settings/media-server/test', 'POST', {
        server: mode,
        url: serverUrl,
      });
      if (result.success) {
        toast.success(`${serverName} is reachable`);
      } else {
        toast.error(result.message ?? "Couldn't connect");
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTesting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await mutate(
        apiSend('/api/v1/settings', 'PUT', { mediaServerLogin: mode, komgaUrl, mediaServerCreateUsers: createUsers }),
        { revalidate: false }
      );
      toast.success('Sign-in settings saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Sign In"
      description="Let people sign in with the account they already have on your reading server. Their password is checked by that server and never stored here."
    >
      <form onSubmit={save}>
        <div className="form-row">
          <label htmlFor="sign-in-mode" className="text-label">Sign in with</label>
          <div className="form-input-area">
            <div className="form-input-field">
              <select id="sign-in-mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                {SIGN_IN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {mode === 'kavita' && !data.kavitaUrl && (
          <div className="mb-6">
            <Alert type="warning" title="Kavita isn't set up yet">Enter Kavita's URL on the Kavita tab first.</Alert>
          </div>
        )}
        {mode === 'kavita' && data.kavitaUrl && (
          <div className="form-row">
            <span className="group-label">Kavita URL<span className="label-tip">From the Kavita tab</span></span>
            <div className="form-input-area flex items-center text-sm text-gray-300">{data.kavitaUrl}</div>
          </div>
        )}
        {mode === 'komga' && (
          <div className="form-row">
            <label htmlFor="komga-url" className="text-label">
              Komga URL
              <span className="label-tip">E.g. http://192.168.1.10:25600. People sign in with their Komga email address.</span>
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <input id="komga-url" type="url" value={komgaUrl} onChange={(e) => setKomgaUrl(e.target.value)} placeholder="http://komga:25600" />
              </div>
            </div>
          </div>
        )}
        {mode !== 'none' && (
          <div className="form-row">
            <span className="group-label">
              New accounts
              <span className="label-tip">
                On the first sign-in, create the account here with the default permissions. When off, only {serverName} users you
                already let in can sign in.
              </span>
            </span>
            <div className="form-input-area flex items-center">
              <Toggle label="Create accounts on first sign-in" checked={createUsers} onChange={setCreateUsers} />
            </div>
          </div>
        )}
        <div className="actions">
          <div className="flex justify-end gap-3">
            {mode !== 'none' && (
              <Button type="button" buttonType="warning" disabled={testing || !serverUrl} onClick={() => void test()}>
                <BeakerIcon />
                <span>{testing ? 'Testing...' : 'Test'}</span>
              </Button>
            )}
            <Button buttonType="primary" type="submit" disabled={saving || (mode === 'kavita' && !data.kavitaUrl) || (mode === 'komga' && !komgaUrl)}>
              <CheckIcon />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </div>
      </form>
    </Section>
  );
}

export function WebhookSettings() {
  const { data, error } = useSettings();
  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;
  return (
    <Section title="Webhook">
      <WebhookInfo secret={data.webhookSecret} appUrl={data.appUrl} />
    </Section>
  );
}

export function AboutSettings() {
  const { data, error, mutate } = useSettings();
  const [syncing, setSyncing] = useState(false);
  if (error) return <Alert type="error" title="Couldn't load the settings">{errorMessage(error)}</Alert>;
  if (!data) return <LoadingSpinner />;

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await apiSend<{ changed: number; lastSyncError: string | null }>('/api/v1/settings/sync', 'POST');
      if (result.lastSyncError) {
        toast.error(result.lastSyncError);
      } else {
        toast.success(`Synced: ${result.changed} request(s) changed`);
      }
      void mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between border-b border-gray-700 px-4 py-3 text-sm last:border-b-0">
      <span className="font-bold text-gray-300">{label}</span>
      <span className="ml-4 text-right text-gray-400">{value}</span>
    </div>
  );

  return (
    <Section title="About Bubbleseerr" description="A request app for Bubblarr, in the style of Seerr.">
      <div className="max-w-2xl overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow">
        {row('Version', '0.1.0')}
        {row('Bubblarr', data.bubblarrUrl || 'Not connected')}
        {row('Kavita', data.kavitaUrl || 'Not connected')}
        {row(
          'Last Status Sync',
          data.lastSync ? <span title={formatDate(data.lastSync)}>{timeAgo(data.lastSync)}</span> : 'Never'
        )}
        {data.lastSyncError && row('Last Sync Error', <span className="text-red-400">{data.lastSyncError}</span>)}
        {row('Based on', <a href="https://github.com/seerr-team/seerr" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Seerr (MIT)</a>)}
      </div>
      <div className="mt-6">
        <Button onClick={() => void sync()} disabled={syncing}>
          <ArrowPathIcon className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Syncing...' : 'Sync Request Statuses Now'}</span>
        </Button>
      </div>
    </Section>
  );
}
