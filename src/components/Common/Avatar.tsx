/** A round avatar with initials (Seerr uses Gravatar; this works offline) */
const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-600',
];

export default function Avatar({ name, className = 'h-10 w-10 text-sm' }: { name: string; className?: string }) {
  const initials =
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?';
  let hash = 0;
  for (const c of name) {
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${GRADIENTS[hash % GRADIENTS.length]} ${className}`}
    >
      {initials}
    </span>
  );
}
