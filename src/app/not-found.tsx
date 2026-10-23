import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="error-message">
      <div className="text-4xl font-bold text-white">404</div>
      <p className="mt-2 text-lg">This page doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 text-indigo-400 hover:underline">Back to Discover</Link>
    </div>
  );
}
