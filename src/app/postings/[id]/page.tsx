import PostingDetail from "./posting-detail";

export default async function PostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostingDetail postingId={Number(id)} />;
}
