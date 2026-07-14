import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "이직 OS",
  description: "경험 뱅크 기반 지원 전략 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-800 text-[14px]">
        <header className="sticky top-0 z-10 flex items-center gap-6 border-b border-neutral-200 bg-white px-5 py-3">
          <Link href="/" className="font-bold text-[15px]">
            ■ 이직 OS
          </Link>
          <nav className="flex gap-4 text-neutral-500">
            <Link href="/" className="hover:text-neutral-900">
              공고 피드
            </Link>
            <Link href="/cards" className="hover:text-neutral-900">
              경험 뱅크
            </Link>
            <Link href="/#how-it-works" className="hover:text-neutral-900">
              사용 방법
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl p-5">{children}</main>
      </body>
    </html>
  );
}
