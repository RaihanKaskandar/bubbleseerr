/* eslint-disable @next/next/no-img-element */
/** The logo: the icon and the app title in Seerr's gradient */
export default function Logo({ title = 'Bubbleseerr', size = 'md' }: { title?: string; size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-3">
      <img src="/logo.svg" alt="" className={size === 'lg' ? 'h-20 w-20' : 'h-12 w-12'} />
      <span className={`text-overseerr font-extrabold tracking-tight ${size === 'lg' ? 'text-4xl' : 'text-2xl'}`}>
        {title}
      </span>
    </span>
  );
}
