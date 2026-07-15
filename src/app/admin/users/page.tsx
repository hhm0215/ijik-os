import { requireAdminPageSession } from "@/lib/auth-session";
import { isPublicSignupEnabled } from "@/lib/signup-policy";
import UsersClient from "./users-client";

export default async function AdminUsersPage() {
  const session = await requireAdminPageSession();

  return (
    <div className="space-y-6">
      <header className="surface flex flex-col justify-between gap-5 overflow-hidden p-6 sm:flex-row sm:items-end sm:p-8">
        <div>
          <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">
            USER ADMINISTRATION
          </p>
          <h1 className="mt-2 text-[28px] font-black tracking-[-0.05em]">
            사용자 관리
          </h1>
          <p className="mt-3 max-w-2xl text-[12px] leading-6 text-[#718078]">
            가입한 계정과 접근 상태를 확인하고, 필요한 경우 사용을 중지하거나 로그인 세션을 종료하세요.
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-black ${
            isPublicSignupEnabled()
              ? "bg-[#e4f5ec] text-[#167b57]"
              : "bg-[#eef1ef] text-[#69756e]"
          }`}
        >
          공개 가입 {isPublicSignupEnabled() ? "열림" : "닫힘"}
        </span>
      </header>

      <UsersClient
        currentUserId={session.user.id}
        signupOpen={isPublicSignupEnabled()}
      />
    </div>
  );
}
