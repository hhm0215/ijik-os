import { redirect } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { getOptionalSession } from "@/lib/auth-session";
import { isPublicSignupEnabled } from "@/lib/signup-policy";
import SignupForm from "./signup-form";

export default async function SignupPage() {
  const session = await getOptionalSession();
  if (session) redirect("/");

  return (
    <div className="grid min-h-[calc(100vh-7rem)] place-items-center py-5 sm:py-10">
      <div className="w-full max-w-lg space-y-5">
        <AppLogo href="/signup" className="justify-center" showSubtitleOnMobile />
        <section className="surface overflow-hidden">
          <div className="border-b border-[#edf0ee] bg-[linear-gradient(135deg,#f2faf6,#fff9ef)] px-6 py-6 sm:px-8">
            <p className="text-[10px] font-black tracking-[0.12em] text-[#167b57]">
              CREATE ACCOUNT
            </p>
            <h1 className="mt-2 text-[25px] font-black tracking-[-0.045em]">
              내 커리어 워크스페이스 시작하기
            </h1>
            <p className="mt-2 text-[12px] leading-6 text-[#748078]">
              계정을 만든 뒤 경험을 기록하고 관심 공고와 연결해보세요.
            </p>
          </div>
          <SignupForm initiallyOpen={isPublicSignupEnabled()} />
        </section>
        <p className="text-center text-[10px] leading-5 text-[#8c9690]">
          경험과 공고 데이터는 로그인한 계정의 워크스페이스에 저장됩니다.
        </p>
      </div>
    </div>
  );
}
