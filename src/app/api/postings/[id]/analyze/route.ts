import { ownerRoute } from "@/lib/auth-session";
import { runPipeline } from "@/lib/pipeline/run";

export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export const POST = ownerRoute(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  try {
    await runPipeline(Number(id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
});
