import { redirect } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { getOptionalSession } from "@/lib/auth-session";
import { getOwnerSetupState } from "@/lib/owner";
import { MIN_OWNER_PASSWORD_LENGTH } from "@/lib/owner-signup-policy";
import SetupForm from "./setup-form";

export default async function SetupPage() {
  const setupState = getOwnerSetupState();
  if (setupState.initialized) {
    const session = await getOptionalSession();
    redirect(session ? "/" : "/login");
  }

  return (
    <div className="grid min-h-[calc(100vh-7rem)] place-items-center py-5 sm:py-10">
      <div className="w-full max-w-lg space-y-5">
        <AppLogo href="/setup" className="justify-center" showSubtitleOnMobile />
        <section className="surface overflow-hidden">
          <div className="border-b border-[#edf0ee] bg-[linear-gradient(135deg,#f2faf6,#fff9ef)] px-6 py-6 sm:px-8">
            <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">
              FIRST OWNER SETUP
            </p>
            <h1 className="mt-2 text-[25px] font-black tracking-[-0.045em]">
              개인 워크스페이스를 잠가볼까요?
            </h1>
            <p className="mt-2 text-[12px] leading-6 text-[#748078]">
              최초 한 번만 소유자 계정을 만듭니다. 이후에는 새 계정을 추가할 수 없어요.
            </p>
          </div>

          {setupState.configured ? (
            <SetupForm
              ownerEmail={setupState.ownerEmail}
              minimumPasswordLength={MIN_OWNER_PASSWORD_LENGTH}
            />
          ) : (
            <div className="space-y-4 px-6 py-7 sm:px-8">
              <div className="rounded-xl border border-[#f1d49d] bg-[#fff8e8] p-4 text-[11px] leading-6 text-[#7d5b22]">
                <strong className="block text-[12px]">서버 설정이 먼저 필요해요</strong>
                배포 환경에 <code className="font-bold">OWNER_EMAIL</code>과 24자 이상의{" "}
                <code className="font-bold">OWNER_SETUP_TOKEN</code>을 설정한 뒤 앱을 다시 시작하세요.
              </div>
              <p className="text-[10px] leading-5 text-[#8c9690]">
                설정 값은 화면에 저장되지 않으며, 최초 소유자 계정을 만든 뒤 설정 화면은 자동으로 닫힙니다.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
