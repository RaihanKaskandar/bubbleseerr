// Adapted from Seerr's StatusBadge and StatusBadgeMini (MIT, https://github.com/seerr-team/seerr)
import {
  ArrowDownTrayIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MinusSmallIcon,
} from '@heroicons/react/24/solid';

import Badge, { type BadgeType } from '@app/components/Common/Badge';
import { STATUS_LABELS, type DisplayStatus } from '@app/lib/status';

const MINI: Record<Exclude<DisplayStatus, 'none'>, { className: string; Icon: typeof ClockIcon }> = {
  available: { className: 'bg-green-500/80 border-green-400 ring-green-400 text-green-100', Icon: CheckCircleIcon },
  partially_available: { className: 'bg-green-500/80 border-green-400 ring-green-400 text-green-100', Icon: MinusSmallIcon },
  downloading: { className: 'bg-indigo-500/80 border-indigo-400 ring-indigo-400 text-indigo-100', Icon: ArrowDownTrayIcon },
  processing: { className: 'bg-indigo-500/80 border-indigo-400 ring-indigo-400 text-indigo-100', Icon: ClockIcon },
  upcoming: { className: 'bg-yellow-500/80 border-yellow-400 ring-yellow-400 text-yellow-100', Icon: CalendarIcon },
  failed: { className: 'bg-red-500/80 border-red-400 ring-red-400 text-red-100', Icon: ExclamationTriangleIcon },
};

/** The small round status icon in the corner of a poster card */
export function StatusBadgeMini({ status }: { status: DisplayStatus }) {
  if (status === 'none') {
    return null;
  }
  const { className, Icon } = MINI[status];
  return (
    <div className="relative inline-flex whitespace-nowrap rounded-full border-gray-700 text-xs font-semibold leading-5 ring-gray-700" title={STATUS_LABELS[status]}>
      <div className={`w-4 rounded-full border p-0 shadow-md sm:w-5 ${className}`}>
        <Icon />
      </div>
      <span className="sr-only">{STATUS_LABELS[status]}</span>
    </div>
  );
}

const BADGE_TYPES: Record<Exclude<DisplayStatus, 'none'>, BadgeType> = {
  available: 'success',
  partially_available: 'success',
  downloading: 'primary',
  processing: 'primary',
  upcoming: 'warning',
  failed: 'danger',
};

/** The status pill on a detail page or request card */
export default function StatusBadge({ status, href }: { status: DisplayStatus; href?: string }) {
  if (status === 'none') {
    return null;
  }
  return (
    <Badge badgeType={BADGE_TYPES[status]} href={href}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
