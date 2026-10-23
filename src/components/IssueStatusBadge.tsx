import Badge from '@app/components/Common/Badge';
import type { IssueStatus } from '@app/lib/types';

const LABELS: Record<IssueStatus, { label: string; type: 'success' | 'primary' | 'warning' | 'default' | 'light' }> = {
  downloaded: { label: 'Available', type: 'success' },
  downloading: { label: 'Downloading', type: 'primary' },
  missing: { label: 'Requested', type: 'primary' },
  upcoming: { label: 'Upcoming', type: 'warning' },
  unmonitored: { label: 'Not Requested', type: 'light' },
};

export default function IssueStatusBadge({ status }: { status: IssueStatus | null | undefined }) {
  const { label, type } = status ? LABELS[status] : { label: 'Not Requested', type: 'light' as const };
  return <Badge badgeType={type}>{label}</Badge>;
}
