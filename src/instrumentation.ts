export async function register() {
  // Only in the Node.js server, not in the Edge runtime (middleware)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundJobs } = await import('@app/server/sync');
    startBackgroundJobs();
  }
}
