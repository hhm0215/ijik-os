import Link from "next/link";
import AccountMenu from "@/components/account-menu";
import AppLogo from "@/components/app-logo";

export default function WorkspaceHeader({
  user,
}: {
  user: { name: string; email: string };
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f7f9f7]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1460px] items-center gap-2 px-4 sm:gap-5 sm:px-7">
        <AppLogo />

        <nav className="ml-auto flex items-center rounded-xl border border-[#e3e9e5] bg-white/75 p-1 text-[12px] font-semibold text-[#65716a] shadow-sm sm:text-[13px]">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-2 hover:bg-[#eef7f2] hover:text-[#126a4a] sm:px-4"
          >
            공고 피드
          </Link>
          <Link
            href="/cards"
            className="rounded-lg px-2.5 py-2 hover:bg-[#eef7f2] hover:text-[#126a4a] sm:px-4"
          >
            경험 뱅크
          </Link>
          <Link
            href="/#how-it-works"
            className="hidden rounded-lg px-4 py-2 hover:bg-[#eef7f2] hover:text-[#126a4a] md:block"
          >
            사용 방법
          </Link>
        </nav>

        <AccountMenu user={user} />
      </div>
    </header>
  );
}
