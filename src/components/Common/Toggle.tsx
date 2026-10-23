// The switch from Seerr's request modal (MIT, https://github.com/seerr-team/seerr)
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

export default function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center pt-2 focus:outline-none disabled:cursor-not-allowed ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`${checked ? 'bg-indigo-500' : 'bg-gray-700'} absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out`}
      />
      <span
        aria-hidden="true"
        className={`${checked ? 'translate-x-5' : 'translate-x-0'} absolute left-0 inline-block h-5 w-5 rounded-full border border-gray-200 bg-white shadow transition-transform duration-200 ease-in-out`}
      />
    </button>
  );
}
