import PublisherPage from '@app/components/PublisherPage';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <PublisherPage slug={(await params).slug} />;
}
