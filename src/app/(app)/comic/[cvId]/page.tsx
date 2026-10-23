import ComicDetails from '@app/components/ComicDetails';

export default async function ComicPage({ params }: { params: Promise<{ cvId: string }> }) {
  const { cvId } = await params;
  return <ComicDetails comicvineId={Number(cvId)} />;
}
