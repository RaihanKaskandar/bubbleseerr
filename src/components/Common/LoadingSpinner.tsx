// Adapted from Seerr's Common/LoadingSpinner (MIT, https://github.com/seerr-team/seerr)
function Spinner({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 38 38" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" aria-hidden="true">
      <g fill="none" fillRule="evenodd">
        <g transform="translate(1 1)" strokeWidth="2">
          <circle strokeOpacity=".5" cx="18" cy="18" r="18" />
          <path d="M36 18c0-9.94-8.06-18-18-18">
            <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
          </path>
        </g>
      </g>
    </svg>
  );
}

export function SmallLoadingSpinner() {
  return (
    <div className="inset-0 flex h-full w-full items-center justify-center text-gray-200" role="status" aria-label="Loading">
      <Spinner className="h-10 w-10" />
    </div>
  );
}

export function InlineSpinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Spinner className={className} />;
}

export default function LoadingSpinner() {
  return (
    <div className="inset-0 flex h-64 items-center justify-center text-gray-200" role="status" aria-label="Loading">
      <Spinner className="h-16 w-16" />
    </div>
  );
}
