/* eslint-disable @next/next/no-img-element */
/** The logo: the icon and the app title as a white, lowercase wordmark, like Seerr's */
export default function Logo({ title = 'Bubbleseerr', size = 'md' }: { title?: string; size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-3">
      <img src="/logo.png" alt="" className={size === 'lg' ? 'h-20 w-20' : 'h-12 w-12'} />
      <span className={`font-display font-bold lowercase leading-none text-white ${size === 'lg' ? 'text-4xl' : 'text-[1.8rem]'}`}>
        {title}
      </span>
    </span>
  );
}
