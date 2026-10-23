'use client';
// Adapted from Seerr's PermissionEdit and PermissionOption (MIT, https://github.com/seerr-team/seerr)
import { hasPermission, Permission, PERMISSION_OPTIONS } from '@app/lib/permissions';

interface PermissionEditProps {
  value: number;
  onChange: (value: number) => void;
  /** Whether the person editing is an admin (only admins may give Admin) */
  actorIsAdmin: boolean;
  disabled?: boolean;
}

export default function PermissionEdit({ value, onChange, actorIsAdmin, disabled }: PermissionEditProps) {
  return (
    <div className="space-y-4">
      {PERMISSION_OPTIONS.map((option) => {
        const isAdmin = (value & Permission.ADMIN) === Permission.ADMIN;
        const implied = !!option.parent && hasPermission(option.parent, value) && option.permission !== Permission.ADMIN;
        const checked = (value & option.permission) === option.permission || (isAdmin && option.permission !== Permission.ADMIN) || implied;
        const locked =
          disabled ||
          (option.permission === Permission.ADMIN && !actorIsAdmin) ||
          (option.permission !== Permission.ADMIN && (isAdmin || implied));
        return (
          <div key={option.permission} className={`relative flex items-start ${locked ? 'opacity-50' : ''}`}>
            <div className="flex h-6 items-center">
              <input
                id={`permission-${option.permission}`}
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={(e) => onChange(e.target.checked ? value | option.permission : value & ~option.permission)}
              />
            </div>
            <div className="ml-3 text-sm leading-6">
              <label htmlFor={`permission-${option.permission}`} className="!mb-0 block font-medium !text-white">
                {option.name}
                <span className="block font-normal text-gray-400">{option.description}</span>
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
