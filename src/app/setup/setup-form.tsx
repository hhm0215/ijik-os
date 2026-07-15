"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type SetupResponse = {
  error?: string;
  code?: string;
};

export default function SetupForm({
  ownerEmail,
  minimumPasswordLength,
}: {
  ownerEmail: string;
  minimumPasswordLength: number;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearSecrets() {
    setPassword("");
    setConfirmPassword("");
    setSetupToken("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password, setupToken }),
      });
      const result = (await response.json()) as SetupResponse;

      if (response.status === 409 || result.code === "OWNER_EXISTS") {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "소유자 계정을 만들지 못했습니다.");

      const signInResult = await authClient.signIn.email({
        email: ownerEmail,
        password,
        rememberMe: true,
      });
      if (signInResult.error) {
        router.replace("/login?setup=complete");
        router.refresh();
        return;
      }

      router.replace("/?welcome=1");
      router.refresh();
    } catch (caught) {
      clearSecrets();
      setError(caught instanceof Error ? caught.message : "초기 설정을 완료하지 못했어요.");
      setBusy(false);
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
      <div className="rounded-xl bg-[#f2f6f4] p-3 text-[10px] leading-5 text-[#65736b]">
        로그인 이메일 <strong className="ml-1 text-[#35443c]">{ownerEmail}</strong>
        <br />이 주소는 서버 설정으로 고정되며 이 화면에서는 바꿀 수 없습니다.
      </div>
      <div>
        <label htmlFor="setup-name" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
          표시 이름
        </label>
        <input
          ref={nameRef}
          id="setup-name"
          autoComplete="name"
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          className="field"
          placeholder="워크스페이스에서 사용할 이름"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="setup-password" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
            비밀번호
          </label>
          <input
            id="setup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={minimumPasswordLength}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            className="field"
            placeholder={`${minimumPasswordLength}자 이상`}
          />
        </div>
        <div>
          <label htmlFor="setup-password-confirm" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
            비밀번호 확인
          </label>
          <input
            id="setup-password-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={minimumPasswordLength}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            className="field"
            placeholder="한 번 더 입력하세요"
          />
        </div>
      </div>
      <div>
        <label htmlFor="setup-token" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
          초기 설정 코드
        </label>
        <p className="mb-2 text-[10px] leading-5 text-[#8c9690]">
          서버의 <code className="font-semibold">OWNER_SETUP_TOKEN</code> 값을 입력하세요.
        </p>
        <input
          id="setup-token"
          type="password"
          autoComplete="off"
          required
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          disabled={busy}
          className="field"
          placeholder="초기 설정 코드"
        />
      </div>
      <div className="rounded-xl bg-[#fff8e9] p-3 text-[10px] leading-5 text-[#80602d]">
        경험 카드와 공고에는 민감한 개인 정보가 포함될 수 있습니다. 소유자 계정과 설정 코드를 다른 사람과 공유하지 마세요.
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] leading-5 text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !name.trim() || !password || !confirmPassword || !setupToken.trim()}
        className="w-full rounded-xl bg-[#167b57] py-3 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949] disabled:cursor-not-allowed disabled:bg-[#dfe5e1] disabled:text-[#96a099] disabled:shadow-none"
      >
        {busy ? "개인 워크스페이스를 만들고 있어요…" : "소유자 계정 만들기 →"}
      </button>
    </form>
  );
}
