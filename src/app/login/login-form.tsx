"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginForm({
  initialEmail,
  nextPath,
  notice,
}: {
  initialEmail: string;
  nextPath: string;
  notice: string | null;
}) {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });
      if (result.error) throw new Error(result.error.message);
      router.replace(nextPath);
      router.refresh();
    } catch {
      setPassword("");
      setError("이메일 또는 비밀번호를 확인해 주세요.");
      setBusy(false);
      requestAnimationFrame(() => passwordRef.current?.focus());
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
      {notice && (
        <p role="status" className="rounded-xl bg-[#edf8f2] p-3 text-[11px] leading-5 text-[#176b4d]">
          {notice}
        </p>
      )}
      <div>
        <label htmlFor="login-email" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
          로그인 이메일
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          className="field"
          placeholder="owner@example.com"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
          비밀번호
        </label>
        <input
          ref={passwordRef}
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          className="field"
          placeholder="비밀번호를 입력하세요"
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] font-medium text-[#66736c]">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          disabled={busy}
          className="size-4 accent-[#167b57]"
        />
        이 브라우저에서 로그인 상태 유지
      </label>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email.trim() || !password}
        className="w-full rounded-xl bg-[#167b57] py-3 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949] disabled:cursor-not-allowed disabled:bg-[#dfe5e1] disabled:text-[#96a099] disabled:shadow-none"
      >
        {busy ? "로그인하고 있어요…" : "워크스페이스 로그인 →"}
      </button>
    </form>
  );
}
