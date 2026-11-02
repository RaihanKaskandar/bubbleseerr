'use client';
// Adapted from Seerr's UserList (MIT, https://github.com/seerr-team/seerr)
import { PencilIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';

import { useUser } from '@app/components/AppContext';
import Alert from '@app/components/Common/Alert';
import Avatar from '@app/components/Common/Avatar';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import Table, { TBody, TD, TH } from '@app/components/Common/Table';
import PermissionEdit from '@app/components/PermissionEdit';
import { sourceName } from '@app/components/Profile';
import PublisherPicker from '@app/components/PublisherPicker';
import { apiSend, errorMessage, fetcher } from '@app/lib/api';
import { hasPermission, Permission } from '@app/lib/permissions';
import { DEFAULT_PUBLISHERS, describePublishers } from '@app/lib/publishers';
import { formatDate } from '@app/lib/text';
import type { PublicUser } from '@app/lib/types';

type ListedUser = PublicUser & { requestCount: number; owner: boolean };

function roleOf(user: PublicUser): { label: string; type: 'success' | 'warning' | 'default' } {
  if (hasPermission(Permission.ADMIN, user.permissions)) {
    return { label: 'Admin', type: 'success' };
  }
  if (user.permissions & (Permission.MANAGE_USERS | Permission.MANAGE_SETTINGS | Permission.MANAGE_REQUESTS)) {
    return { label: 'Manager', type: 'warning' };
  }
  return { label: 'User', type: 'default' };
}

interface EditState {
  user: ListedUser | null;
  email: string;
  username: string;
  displayName: string;
  password: string;
  removePassword: boolean;
  permissions: number;
  /** null = the default */
  publishers: string[] | null;
}

export default function UserList() {
  const { user: me } = useUser();
  const { data, error, mutate } = useSWR<ListedUser[]>('/api/v1/users', fetcher);
  const { data: settings } = useSWR<{ defaultPermissions: number; defaultPublishers: string[] }>(
    me && hasPermission(Permission.MANAGE_SETTINGS, me.permissions) ? '/api/v1/settings' : null,
    fetcher
  );
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<ListedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const defaultPublishers = settings?.defaultPublishers ?? DEFAULT_PUBLISHERS;
  const actorIsAdmin = !!me && hasPermission(Permission.ADMIN, me.permissions);

  const openCreate = () =>
    setEdit({ user: null, email: '', username: '', displayName: '', password: '', removePassword: false, permissions: settings?.defaultPermissions ?? Permission.REQUEST, publishers: null });
  const openEdit = (u: ListedUser) =>
    setEdit({ user: u, email: u.email ?? '', username: u.username, displayName: u.displayName, password: '', removePassword: false, permissions: u.permissions, publishers: u.publishers });

  const save = async () => {
    if (!edit) {
      return;
    }
    setBusy(true);
    try {
      if (edit.user) {
        await apiSend(`/api/v1/users/${edit.user.id}`, 'PUT', {
          email: edit.email,
          username: edit.username,
          displayName: edit.displayName,
          ...(edit.removePassword ? { password: null } : edit.password ? { password: edit.password } : {}),
          ...(edit.user.id !== me?.id ? { permissions: edit.permissions } : {}),
          publishers: edit.publishers,
        });
        toast.success(`${edit.displayName || edit.username} was saved`);
      } else {
        await apiSend('/api/v1/users', 'POST', {
          email: edit.email,
          username: edit.username,
          displayName: edit.displayName || undefined,
          password: edit.password || undefined,
          permissions: edit.permissions,
          publishers: edit.publishers,
        });
        toast.success(`${edit.displayName || edit.username} can now sign in`);
      }
      setEdit(null);
      void mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) {
      return;
    }
    setBusy(true);
    try {
      await apiSend(`/api/v1/users/${deleting.id}`, 'DELETE');
      toast.success(`${deleting.displayName} was deleted`);
      setDeleting(null);
      void mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (key: 'email' | 'username' | 'displayName' | 'password', label: string, type: string, required: boolean, tip?: string) =>
    edit && (
      <div className="form-row">
        <label htmlFor={`user-${key}`} className="text-label">
          {label}
          {required && <span className="label-required">*</span>}
          {tip && <span className="label-tip">{tip}</span>}
        </label>
        <div className="form-input-area">
          <div className="form-input-field">
            <input
              id={`user-${key}`}
              type={type}
              autoComplete={key === 'password' ? 'new-password' : 'off'}
              autoCapitalize="none"
              value={edit[key]}
              onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
            />
          </div>
        </div>
      </div>
    );

  return (
    <>
      <PageTitle title="Users" />
      <Modal
        show={!!edit}
        title={edit?.user ? 'Edit User' : 'Create User'}
        subTitle={edit?.user ? edit.user.displayName : undefined}
        onCancel={() => setEdit(null)}
        onOk={() => void save()}
        okText={busy ? 'Saving...' : edit?.user ? 'Save Changes' : 'Create'}
        okDisabled={!edit?.username}
        loading={busy}
      >
        {edit && (
          <div className="-mt-2">
            {field('displayName', 'Display Name', 'text', false, 'Shown on requests; the username is used if empty')}
            {field('username', 'Username', 'text', true)}
            {field('email', 'Email', 'email', false)}
            {edit.user && edit.user.authSource !== 'local' ? null : field('password', edit.user ? 'New Password' : 'Password', 'password', false, edit.user ? (edit.user.hasPassword ? 'Leave empty to keep the current password' : 'This user has no password; anyone who can open this site can sign in as them') : 'Optional. Without one, anyone who can open this site can sign in as this user.')}
            {edit.user && edit.user.authSource === 'local' && edit.user.hasPassword && edit.user.id !== me?.id && (
              <div className="form-row">
                <span className="group-label">Remove Password</span>
                <div className="form-input-area">
                  <label className="flex cursor-pointer items-center gap-2 text-sm !font-medium !text-white">
                    <input
                      type="checkbox"
                      checked={edit.removePassword}
                      onChange={(e) => setEdit({ ...edit, removePassword: e.target.checked })}
                    />
                    Let this user sign in with just their username
                  </label>
                </div>
              </div>
            )}
            <div className="form-row">
              <span className="group-label">
                Publishers
                <span className="label-tip">What Discover, the calendar and search show this user</span>
              </span>
              <div className="form-input-area">
                <label className="!mb-3 flex cursor-pointer items-center gap-2 text-sm !font-medium !text-white">
                  <input
                    type="checkbox"
                    checked={edit.publishers === null}
                    onChange={(e) =>
                      setEdit({ ...edit, publishers: e.target.checked ? null : [...defaultPublishers] })
                    }
                  />
                  Use the default ({describePublishers(defaultPublishers)})
                </label>
                <PublisherPicker
                  value={edit.publishers ?? defaultPublishers}
                  disabled={edit.publishers === null}
                  onChange={(publishers) => setEdit({ ...edit, publishers })}
                />
              </div>
            </div>
            {edit.user?.id !== me?.id && (
              <div className="form-row">
                <span className="group-label">Permissions</span>
                <div className="form-input-area">
                  <PermissionEdit
                    value={edit.permissions}
                    actorIsAdmin={actorIsAdmin}
                    disabled={edit.user?.owner}
                    onChange={(permissions) => setEdit({ ...edit, permissions })}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal
        show={!!deleting}
        title="Delete User"
        onCancel={() => setDeleting(null)}
        onOk={() => void remove()}
        okText="Delete"
        okButtonType="danger"
        loading={busy}
      >
        Delete {deleting?.displayName}? Their requests are deleted too. Comics stay in the library.
      </Modal>

      <div className="flex flex-col justify-between lg:flex-row lg:items-end">
        <Header>User List</Header>
        <div className="mt-2 flex flex-grow flex-col lg:flex-grow-0 lg:flex-row">
          <Button buttonType="primary" onClick={openCreate}>
            <UserPlusIcon />
            <span>Create User</span>
          </Button>
        </div>
      </div>
      {error && <Alert type="error" title="Couldn't load the users">{errorMessage(error)}</Alert>}
      {!data && !error && <LoadingSpinner />}
      {data && (
        <Table>
          <thead>
            <tr>
              <TH>User</TH>
              <TH className="hidden sm:table-cell">Requests</TH>
              <TH>Role</TH>
              <TH className="hidden md:table-cell">Joined</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </thead>
          <TBody>
            {data.map((u) => {
              const role = roleOf(u);
              const protectedUser = u.owner || (!actorIsAdmin && hasPermission(Permission.ADMIN, u.permissions));
              return (
                <tr key={u.id}>
                  <TD>
                    <div className="flex items-center">
                      <Avatar name={u.displayName} className="h-10 w-10 text-sm" />
                      <div className="ml-4 min-w-0">
                        <div className="truncate text-base font-bold leading-5">{u.displayName}</div>
                        <div className="truncate text-sm leading-5 text-gray-300">{u.email ?? u.username}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden sm:table-cell">{u.requestCount}</TD>
                  <TD>
                    <Badge badgeType={role.type}>{u.owner ? 'Owner' : role.label}</Badge>
                    {u.authSource !== 'local' && (
                      <Badge badgeType="primary" className="ml-1">{sourceName(u.authSource)}</Badge>
                    )}
                  </TD>
                  <TD className="hidden md:table-cell">{formatDate(u.createdAt)}</TD>
                  <TD alignText="right">
                    <div className="grid grid-cols-1 gap-1 sm:inline-grid sm:grid-cols-2 sm:gap-2">
                      <Button buttonType="warning" buttonSize="sm" disabled={protectedUser && u.id !== me?.id} onClick={() => openEdit(u)}>
                        <PencilIcon />
                        <span>Edit</span>
                      </Button>
                      <Button buttonType="danger" buttonSize="sm" disabled={protectedUser || u.id === me?.id} onClick={() => setDeleting(u)}>
                        <TrashIcon />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </TD>
                </tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
