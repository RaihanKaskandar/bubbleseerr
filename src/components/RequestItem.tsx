'use client';
// Adapted from Seerr's RequestList/RequestItem (MIT, https://github.com/seerr-team/seerr)
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { useUser } from '@app/components/AppContext';
import Avatar from '@app/components/Common/Avatar';
import Button from '@app/components/Common/Button';
import Modal from '@app/components/Common/Modal';
import StatusBadge from '@app/components/StatusBadge';
import { apiSend, errorMessage } from '@app/lib/api';
import { coverSrc } from '@app/lib/cover';
import { Permission } from '@app/lib/permissions';
import { displayStatus } from '@app/lib/status';
import { formatDate, timeAgo } from '@app/lib/text';
import type { RequestItem as Request } from '@app/lib/types';

interface RequestItemProps {
  request: Request;
  onChange: () => void;
}

export default function RequestItem({ request, onChange }: RequestItemProps) {
  const { user, hasPermission } = useUser();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canManage = request.requestedBy === user?.id || hasPermission(Permission.MANAGE_REQUESTS);
  const status = displayStatus(request.libraryStatus, request.status);

  const retry = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/v1/requests/${request.id}/retry`, 'POST');
      toast.success(`Searching for ${request.title} again`);
      onChange();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await apiSend(`/api/v1/requests/${request.id}`, 'DELETE');
      toast.success('Request removed');
      setConfirmDelete(false);
      onChange();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-2 text-gray-400 shadow-md ring-1 ring-gray-700 xl:h-28 xl:flex-row">
      <Modal
        show={confirmDelete}
        title="Remove Request"
        onCancel={() => setConfirmDelete(false)}
        onOk={remove}
        okText="Remove"
        okButtonType="danger"
        loading={busy}
      >
        Remove the request for {request.title}? Issues that were already downloaded stay in the library.
      </Modal>
      {request.coverUrl && (
        <div className="absolute inset-0 z-0 w-full overflow-hidden xl:w-2/3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverSrc(request.coverUrl)} alt="" className="h-full w-full scale-125 object-cover blur-sm" />
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'linear-gradient(90deg, rgba(31, 41, 55, 0.47) 0%, rgba(31, 41, 55, 1) 100%)' }}
          />
        </div>
      )}
      <div className="relative flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="relative z-10 flex w-full items-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          <Link
            href={`/comic/${request.comicvineId}`}
            className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105"
          >
            {request.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc(request.coverUrl)} alt="" className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="aspect-[2/3] w-full bg-gray-700" />
            )}
          </Link>
          <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
            <div className="pt-0.5 text-xs font-medium text-white sm:pt-1">
              {[request.year, request.publisher].filter(Boolean).join(' · ')}
            </div>
            <Link
              href={`/comic/${request.comicvineId}`}
              className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl"
            >
              {request.title}
            </Link>
            <div className="card-field">
              <span className="card-field-name">Issues</span>
              <span className="truncate text-sm text-gray-300">{request.issuesLabel}</span>
            </div>
          </div>
        </div>
        <div className="z-10 ml-4 mt-4 flex w-full flex-col justify-center gap-1 overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          <div className="card-field">
            <span className="card-field-name">Status</span>
            <StatusBadge status={status === 'none' ? 'processing' : status} />
          </div>
          {request.error && (
            <div className="card-field">
              <span className="truncate text-xs text-red-300">{request.error}</span>
            </div>
          )}
          <div className="card-field">
            <span className="card-field-name">Requested</span>
            <span className="flex truncate text-sm text-gray-300" title={formatDate(request.createdAt)}>
              {timeAgo(request.createdAt)} by
              <span className="ml-1.5 flex items-center truncate">
                <Avatar name={request.requestedByUser.displayName} className="mr-1 h-5 w-5 text-[9px]" />
                <span className="truncate text-sm font-semibold">{request.requestedByUser.displayName}</span>
              </span>
            </span>
          </div>
        </div>
      </div>
      {canManage && (
        <div className="z-10 mt-4 flex w-full flex-col justify-center space-y-2 pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
          {(status === 'failed' || status === 'processing' || status === 'partially_available') && (
            <Button className="w-full xl:w-auto" buttonType="primary" onClick={retry} disabled={busy}>
              <ArrowPathIcon />
              <span>Search Again</span>
            </Button>
          )}
          <Button className="w-full xl:w-auto" buttonType="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
            <TrashIcon />
            <span>Remove</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function RequestItemPlaceholder() {
  return <div className="h-64 w-full animate-pulse rounded-xl bg-gray-800 xl:h-28" />;
}
