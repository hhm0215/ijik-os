import SettingsClient from "./settings-client";
import { requirePageSession } from "@/lib/auth-session";
import { llmProviderInfo } from "@/lib/llm";
import { MIN_PASSWORD_LENGTH } from "@/lib/signup-policy";

export default async function SettingsPage() {
  const session = await requirePageSession();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="surface overflow-hidden p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#167b57] text-lg font-black text-white shadow-[0_8px_20px_rgba(22,123,87,.2)]">
            {Array.from(session.user.name.trim() || session.user.email)[0]?.toUpperCase() ?? "I"}
          </span>
          <div>
            <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">
              WORKSPACE SETTINGS
            </p>
            <h1 className="mt-1 text-[24px] font-black tracking-[-0.045em]">
              계정과 워크스페이스 설정
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#748078]">
              표시 이름과 비밀번호를 관리하고, 로그인된 기기와 AI 데이터 처리 경로를 확인하세요.
            </p>
          </div>
        </div>
      </header>

      <SettingsClient
        initialUser={{ name: session.user.name, email: session.user.email }}
        currentSessionToken={session.session.token}
        provider={llmProviderInfo()}
        minimumPasswordLength={MIN_PASSWORD_LENGTH}
      />
    </div>
  );
}
