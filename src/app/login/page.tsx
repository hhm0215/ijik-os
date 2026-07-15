import { redirect } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { getOptionalSession } from "@/lib/auth-session";
import { getOwnerSetupState } from "@/lib/owner";
import LoginForm from "./login-form";

function safeNextPath(value: string | string[] | undefined) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value === "/login" || value === "/setup") return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    setup?: string | string[];
  }>;
}) {
  const setupState = getOwnerSetupState();
  if (!setupState.initialized) redirect("/setup");

  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const session = await getOptionalSession();
  if (session) redirect(nextPath);

  return (
    <div className="grid min-h-[calc(100vh-7rem)] place-items-center py-5 sm:py-10">
      <div className="w-full max-w-md space-y-5">
        <AppLogo href="/login" className="justify-center" showSubtitleOnMobile />
        <section className="surface overflow-hidden">
          <div className="border-b border-[#edf0ee] bg-[linear-gradient(135deg,#f2faf6,#fff9ef)] px-6 py-6 sm:px-8">
            <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">
              PRIVATE WORKSPACE
            </p>
            <h1 className="mt-2 text-[25px] font-black tracking-[-0.045em]">
              다시 만나서 반가워요
            </h1>
            <p className="mt-2 text-[12px] leading-6 text-[#748078]">
              소유자 계정으로 로그인해 커리어 워크스페이스를 이어가세요.
            </p>
          </div>
          <LoginForm
            initialEmail={setupState.ownerEmail}
            nextPath={nextPath}
            notice={params.setup === "complete" ? "소유자 계정을 만들었습니다. 로그인해 주세요." : null}
          />
        </section>
        <p className="text-center text-[10px] leading-5 text-[#8c9690]">
          경험과 공고 데이터는 이 개인 워크스페이스에 저장됩니다.
        </p>
      </div>
    </div>
  );
}
