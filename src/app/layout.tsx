import type { Metadata } from "next";
import WorkspaceHeader from "@/components/workspace-header";
import { getOptionalSession } from "@/lib/auth-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "이직 OS",
  description: "내 경험을 근거로 지원 전략을 만드는 개인 커리어 워크스페이스",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getOptionalSession();

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full text-[14px]">
        {session && (
          <WorkspaceHeader
            user={{ name: session.user.name, email: session.user.email }}
          />
        )}
        <main className="mx-auto max-w-[1460px] px-4 py-6 sm:px-7 sm:py-9">{children}</main>
      </body>
    </html>
  );
}
