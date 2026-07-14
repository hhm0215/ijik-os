import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "이직 OS",
  description: "내 경험을 근거로 지원 전략을 만드는 개인 커리어 워크스페이스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full text-[14px]">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f7f9f7]/85 backdrop-blur-xl">
          <div className="mx-auto flex h-[68px] max-w-[1460px] items-center gap-5 px-4 sm:px-7">
            <Link href="/" className="group flex shrink-0 items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#167b57] text-[15px] font-black text-white shadow-[0_6px_18px_rgba(22,123,87,.24)] group-hover:-translate-y-0.5">
                I
              </span>
              <span>
                <span className="block text-[15px] font-extrabold tracking-[-0.04em]">이직 OS</span>
                <span className="hidden text-[10px] font-medium tracking-[0.08em] text-[#87928c] sm:block">CAREER WORKSPACE</span>
              </span>
            </Link>

            <nav className="ml-auto flex items-center rounded-xl border border-[#e3e9e5] bg-white/75 p-1 text-[12px] font-semibold text-[#65716a] shadow-sm sm:text-[13px]">
              <Link href="/" className="rounded-lg px-3 py-2 hover:bg-[#eef7f2] hover:text-[#126a4a] sm:px-4">
                공고 피드
              </Link>
              <Link href="/cards" className="rounded-lg px-3 py-2 hover:bg-[#eef7f2] hover:text-[#126a4a] sm:px-4">
                경험 뱅크
              </Link>
              <Link href="/#how-it-works" className="hidden rounded-lg px-4 py-2 hover:bg-[#eef7f2] hover:text-[#126a4a] md:block">
                사용 방법
              </Link>
            </nav>

            <span className="hidden items-center gap-1.5 rounded-full border border-[#dce8e1] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5c6962] lg:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Private workspace
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1460px] px-4 py-6 sm:px-7 sm:py-9">{children}</main>
      </body>
    </html>
  );
}
