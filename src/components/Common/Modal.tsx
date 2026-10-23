'use client';
// Adapted from Seerr's Common/Modal (MIT, https://github.com/seerr-team/seerr)
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import React from 'react';

import Button, { type ButtonType } from '@app/components/Common/Button';
import { InlineSpinner } from '@app/components/Common/LoadingSpinner';

interface ModalProps {
  show: boolean;
  title?: string;
  subTitle?: string;
  onCancel: () => void;
  onOk?: () => void;
  okText?: string;
  okButtonType?: ButtonType;
  okDisabled?: boolean;
  cancelText?: string;
  loading?: boolean;
  /** An image shown faded behind the top of the modal, like in Seerr */
  backdrop?: string | null;
  children?: React.ReactNode;
}

export default function Modal({
  show,
  title,
  subTitle,
  onCancel,
  onOk,
  okText = 'Ok',
  okButtonType = 'primary',
  okDisabled,
  cancelText = 'Cancel',
  loading,
  backdrop,
  children,
}: ModalProps) {
  return (
    <Dialog open={show} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-gray-800/70 transition-opacity" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="hide-scrollbar relative inline-block max-h-full w-full overflow-auto bg-gray-800 px-4 pb-4 pt-4 text-left align-bottom shadow-xl ring-1 ring-gray-700 transition-all sm:my-8 sm:max-w-3xl sm:rounded-lg sm:align-middle"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {backdrop && (
            <div className="absolute left-0 right-0 top-0 z-0 h-64 max-h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                className="absolute inset-0"
                style={{ backgroundImage: 'linear-gradient(180deg, rgba(31, 41, 55, 0.75) 0%, rgba(31, 41, 55, 1) 100%)' }}
              />
            </div>
          )}
          <div className="relative -mx-4 overflow-x-hidden px-4 pt-0.5 sm:flex sm:items-center">
            <div className="mt-3 truncate text-center text-white sm:mt-0 sm:text-left">
              {(title || subTitle) && (
                <div className="flex flex-col space-y-1">
                  {title && (
                    <DialogTitle className="text-overseerr truncate pb-0.5 text-2xl font-bold leading-6">
                      {title}
                    </DialogTitle>
                  )}
                  {subTitle && (
                    <span className="truncate text-lg font-semibold leading-6 text-gray-200">{subTitle}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {children && <div className="relative mt-4 text-sm leading-5 text-gray-300">{children}</div>}
          <div className="relative mt-5 flex flex-row-reverse justify-center sm:mt-4 sm:justify-start">
            {onOk && (
              <Button buttonType={okButtonType} onClick={onOk} className="ml-3" disabled={okDisabled || loading}>
                {loading && <InlineSpinner className="mr-2 h-4 w-4" />}
                {okText}
              </Button>
            )}
            <Button onClick={onCancel} className="ml-3 sm:ml-0">
              {cancelText}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
