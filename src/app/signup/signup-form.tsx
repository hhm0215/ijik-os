"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SignupResponse = {
  error?: string;
  code?: "SIGNUP_CLOSED" | "INVALID_REQUEST" | "SIGNUP_FAILED" | string;
};

const MIN_PASSWORD_LENGTH = 12;

export default function SignupForm({ initiallyOpen }: { initiallyOpen: boolean }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [signupOpen, setSignupOpen] = useState(initiallyOpen);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearPasswords() {
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !signupOpen) return;
    if (password !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않아요.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const result = (await response.json()) as SignupResponse;

      if (result.code === "SIGNUP_CLOSED") {
        clearPasswords();
        setSignupOpen(false);
        setBusy(false);
        return;
      }
      if (!response.ok) {
        throw new Error(
          result.error ?? "계정을 만들 수 없습니다. 입력 정보를 확인해 주세요."
        );
      }

      router.replace("/login?signup=complete");
      router.refresh();
    } catch (caught) {
      clearPasswords();
      setError(
        caught instanceof Error
          ? caught.message
          : "계정을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
      );
      setBusy(false);
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }

  if (!signupOpen) {
    return (
      <div className="space-y-5 px-6 py-7 sm:px-8 sm:py-8">
        <div className="rounded-2xl border border-[#e1e7e3] bg-[#f7f9f8] p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e9efec] text-xl text-[#647169]">
            ⌁
          </span>
          <h2 className="mt-4 text-[16px] font-extrabold tracking-[-0.03em]">
            현재 신규 가입을 받지 않고 있어요
          </h2>
          <p className="mt-2 text-[11px] leading-6 text-[#7c8881]">
            이미 계정이 있다면 로그인해 워크스페이스를 이어가세요.
          </p>
        </div>
        <Link
          href="/login"
          className="block w-full rounded-xl bg-[#167b57] py-3 text-center text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949]"
        >
          로그인으로 이동 →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
      <div>
        <label htmlFor="signup-name" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
          표시 이름
        </label>
        <input
          ref={nameRef}
          id="signup-name"
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
      <div>
        <label htmlFor="signup-email" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
          이메일
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          className="field"
          placeholder="you@example.com"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="signup-password" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
            비밀번호
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            className="field"
            placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
          />
        </div>
        <div>
          <label htmlFor="signup-password-confirm" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
            비밀번호 확인
          </label>
          <input
            id="signup-password-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            className="field"
            placeholder="한 번 더 입력하세요"
          />
        </div>
      </div>
      <div className="rounded-xl bg-[#fff8e9] p-3 text-[10px] leading-5 text-[#80602d]">
        경험 카드와 공고에는 민감한 개인 정보가 포함될 수 있습니다. 공용 기기에서는 로그인 상태를 남기지 마세요.
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] leading-5 text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !name.trim() || !email.trim() || !password || !confirmPassword}
        className="w-full rounded-xl bg-[#167b57] py-3 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949] disabled:cursor-not-allowed disabled:bg-[#dfe5e1] disabled:text-[#96a099] disabled:shadow-none"
      >
        {busy ? "계정을 만들고 있어요…" : "계정 만들기 →"}
      </button>
      <p className="text-center text-[11px] text-[#7b8780]">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-bold text-[#167b57] hover:text-[#0e6949]">
          로그인
        </Link>
      </p>
    </form>
  );
}
