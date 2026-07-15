import { requirePageSession } from "@/lib/auth-session";
import PostingDetail from "./posting-detail";

export default async function PostingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageSession();

  const { id } = await params;
  return <PostingDetail postingId={Number(id)} />;
}
