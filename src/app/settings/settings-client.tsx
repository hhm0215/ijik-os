"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type ActiveSession = {
  id: string;
  token: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function deviceLabel(userAgent: string | null | undefined) {
  if (!userAgent) return "알 수 없는 브라우저";

  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "브라우저";
  const device = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : userAgent.includes("Android")
      ? "Android"
      : userAgent.includes("Windows")
        ? "Windows"
        : userAgent.includes("Mac OS") || userAgent.includes("Macintosh")
          ? "macOS"
          : userAgent.includes("Linux")
            ? "Linux"
            : "기기 정보 없음";
  return `${browser} · ${device}`;
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] leading-5 text-red-700">
      {children}
    </p>
  );
}

function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-xl bg-[#edf8f2] p-3 text-[11px] leading-5 text-[#176b4d]">
      {children}
    </p>
  );
}

export default function SettingsClient({
  initialUser,
  currentSessionToken,
  provider,
  minimumPasswordLength,
}: {
  initialUser: { name: string; email: string };
  currentSessionToken: string;
  provider: string;
  minimumPasswordLength: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialUser.name);
  const [savedName, setSavedName] = useState(initialUser.name);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOnChange, setRevokeOnChange] = useState(true);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const result = await authClient.listSessions();
      if (result.error) throw new Error(result.error.message);
      setSessions((result.data ?? []) as ActiveSession[]);
    } catch {
      setSessionsError("로그인된 기기 목록을 불러오지 못했어요.");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshSessions();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshSessions]);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const aCurrent = a.token === currentSessionToken ? 1 : 0;
        const bCurrent = b.token === currentSessionToken ? 1 : 0;
        if (aCurrent !== bCurrent) return bCurrent - aCurrent;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [currentSessionToken, sessions]
  );
  const otherSessionCount = sessions.filter((item) => item.token !== currentSessionToken).length;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || profileBusy) return;

    setProfileBusy(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const result = await authClient.updateUser({ name: nextName });
      if (result.error) throw new Error(result.error.message);
      setName(nextName);
      setSavedName(nextName);
      setProfileSuccess("표시 이름을 저장했어요.");
      router.refresh();
    } catch {
      setProfileError("프로필을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;
    if (newPassword !== confirmPassword) {
      setPasswordSuccess(null);
      setPasswordError("새 비밀번호 확인이 일치하지 않아요.");
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: revokeOnChange,
      });
      if (result.error) throw new Error(result.error.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(
        revokeOnChange
          ? "비밀번호를 바꾸고 다른 기기에서 로그아웃했어요."
          : "비밀번호를 바꿨어요."
      );
      if (revokeOnChange) await refreshSessions();
    } catch {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("현재 비밀번호를 확인하고 다시 시도해 주세요.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function revokeSession(token: string) {
    if (token === currentSessionToken || revokingToken) return;
    setRevokingToken(token);
    setSessionsError(null);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) throw new Error(result.error.message);
      await refreshSessions();
    } catch {
      setSessionsError("선택한 기기에서 로그아웃하지 못했어요.");
    } finally {
      setRevokingToken(null);
    }
  }

  async function revokeOtherSessions() {
    if (revokingOthers || otherSessionCount === 0) return;
    setRevokingOthers(true);
    setSessionsError(null);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error(result.error.message);
      await refreshSessions();
    } catch {
      setSessionsError("다른 기기에서 로그아웃하지 못했어요.");
    } finally {
      setRevokingOthers(false);
    }
  }

  const usesExternalProvider = provider.startsWith("Claude");

  return (
    <>
      <section className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[190px_1fr]">
        <div>
          <span className="text-[10px] font-black tracking-[0.12em] text-[#9aa49e]">01</span>
          <h2 className="mt-2 text-[16px] font-extrabold tracking-[-0.03em]">프로필</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#87928b]">
            헤더와 워크스페이스에 표시되는 계정 이름을 관리해요.
          </p>
        </div>
        <form onSubmit={saveProfile} className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
              표시 이름
            </label>
            <input
              id="profile-name"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={profileBusy}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
              로그인 이메일
            </label>
            <input id="profile-email" value={initialUser.email} readOnly className="field" />
            <p className="mt-2 text-[10px] leading-5 text-[#8c9690]">
              로그인 이메일은 현재 이 화면에서 변경할 수 없어요.
            </p>
          </div>
          {profileError && <ErrorMessage>{profileError}</ErrorMessage>}
          {profileSuccess && <SuccessMessage>{profileSuccess}</SuccessMessage>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileBusy || !name.trim() || name.trim() === savedName}
              className="rounded-xl bg-[#167b57] px-6 py-2.5 text-[13px] font-bold text-white shadow-[0_7px_18px_rgba(22,123,87,.2)] hover:-translate-y-0.5 hover:bg-[#0e6949] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {profileBusy ? "저장하고 있어요…" : "프로필 저장"}
            </button>
          </div>
        </form>
      </section>

      <section className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[190px_1fr]">
        <div>
          <span className="text-[10px] font-black tracking-[0.12em] text-[#9aa49e]">02</span>
          <h2 className="mt-2 text-[16px] font-extrabold tracking-[-0.03em]">비밀번호</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#87928b]">
            현재 비밀번호를 확인한 뒤 새 비밀번호로 바꿔요.
          </p>
        </div>
        <form onSubmit={changePassword} className="space-y-5">
          <div>
            <label htmlFor="current-password" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
              현재 비밀번호
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={passwordBusy}
              className="field"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
                새 비밀번호
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={minimumPasswordLength}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={passwordBusy}
                className="field"
                placeholder={`${minimumPasswordLength}자 이상`}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-[12px] font-bold text-[#3d4a42]">
                새 비밀번호 확인
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={minimumPasswordLength}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={passwordBusy}
                className="field"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-[#66736c]">
            <input
              type="checkbox"
              checked={revokeOnChange}
              onChange={(event) => setRevokeOnChange(event.target.checked)}
              disabled={passwordBusy}
              className="size-4 accent-[#167b57]"
            />
            비밀번호를 바꾸면 다른 기기에서 로그아웃
          </label>
          {passwordError && <ErrorMessage>{passwordError}</ErrorMessage>}
          {passwordSuccess && <SuccessMessage>{passwordSuccess}</SuccessMessage>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
              className="rounded-xl bg-[#172d22] px-6 py-2.5 text-[13px] font-bold text-white shadow-[0_7px_18px_rgba(23,45,34,.15)] hover:-translate-y-0.5 hover:bg-[#167b57] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {passwordBusy ? "변경하고 있어요…" : "비밀번호 변경"}
            </button>
          </div>
        </form>
      </section>

      <section className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[190px_1fr]">
        <div>
          <span className="text-[10px] font-black tracking-[0.12em] text-[#9aa49e]">03</span>
          <h2 className="mt-2 text-[16px] font-extrabold tracking-[-0.03em]">로그인된 기기</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#87928b]">
            현재 계정으로 로그인된 브라우저 세션을 확인하고 종료해요.
          </p>
        </div>
        <div className="space-y-4">
          {sessionsLoading ? (
            <div className="rounded-2xl border border-[#e5eae7] bg-[#fafbfa] p-5 text-center text-[11px] text-[#7f8b84]">
              로그인된 기기를 불러오는 중…
            </div>
          ) : sortedSessions.length === 0 ? (
            <div className="rounded-2xl border border-[#e5eae7] bg-[#fafbfa] p-5 text-center text-[11px] text-[#7f8b84]">
              표시할 세션이 없습니다.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sortedSessions.map((item) => {
                const isCurrent = item.token === currentSessionToken;
                return (
                  <li
                    key={item.id}
                    className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${isCurrent ? "border-[#a7d6c0] bg-[#f2faf6]" : "border-[#e5eae7] bg-[#fafbfa]"}`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl text-[14px] ${isCurrent ? "bg-[#167b57] text-white" : "bg-[#edf1ef] text-[#69766f]"}`}>
                      {isCurrent ? "✓" : "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-[12px] text-[#34423a]">{deviceLabel(item.userAgent)}</strong>
                        {isCurrent && (
                          <span className="rounded-full bg-[#dff3e9] px-2 py-0.5 text-[9px] font-bold text-[#167b57]">
                            현재 기기
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[10px] leading-5 text-[#87928b]">
                        최근 사용 {formatDate(item.updatedAt)}
                        {item.ipAddress ? ` · ${item.ipAddress}` : ""}
                      </span>
                    </span>
                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={revokingToken === item.token || revokingOthers}
                        onClick={() => revokeSession(item.token)}
                        className="rounded-xl border border-[#dce3df] bg-white px-3 py-2 text-[10px] font-semibold text-[#6f7b74] hover:border-[#c9a6a1] hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                      >
                        {revokingToken === item.token ? "종료 중…" : "이 기기 로그아웃"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {sessionsError && <ErrorMessage>{sessionsError}</ErrorMessage>}
          <div className="flex flex-wrap justify-end gap-2">
            {sessionsError && (
              <button
                type="button"
                onClick={() => void refreshSessions()}
                className="rounded-xl border border-[#dce3df] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#647169] hover:border-[#9bcbb5] hover:text-[#167b57]"
              >
                다시 불러오기
              </button>
            )}
            <button
              type="button"
              disabled={sessionsLoading || revokingOthers || otherSessionCount === 0}
              onClick={revokeOtherSessions}
              className="rounded-xl border border-[#dce3df] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#6f7b74] hover:border-[#c9a6a1] hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {revokingOthers ? "다른 기기에서 로그아웃 중…" : `다른 기기 모두 로그아웃${otherSessionCount ? ` (${otherSessionCount})` : ""}`}
            </button>
          </div>
        </div>
      </section>

      <section className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[190px_1fr]">
        <div>
          <span className="text-[10px] font-black tracking-[0.12em] text-[#9aa49e]">04</span>
          <h2 className="mt-2 text-[16px] font-extrabold tracking-[-0.03em]">데이터 및 AI</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#87928b]">
            경험과 문서가 어디에 저장되고 처리되는지 확인해요.
          </p>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#e3e9e5] bg-[#fafcfb] p-4">
            <p className="text-[10px] font-black tracking-[0.08em] text-[#8a958f]">현재 AI 처리 경로</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <strong className="text-[13px] text-[#304037]">{provider}</strong>
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${usesExternalProvider ? "bg-[#fff0d7] text-[#996729]" : "bg-[#e4f5ec] text-[#167b57]"}`}>
                {usesExternalProvider ? "외부 제공자" : "배포 서버 내부"}
              </span>
            </div>
            <p className="mt-3 text-[10px] leading-5 text-[#748078]">
              {usesExternalProvider
                ? "공고와 경험 카드, 가져온 문서 내용이 AI 분석을 위해 외부 제공자에게 전송될 수 있습니다."
                : "AI 분석은 이 워크스페이스가 배포된 서버의 Ollama에서 처리됩니다."}
            </p>
          </div>
          <div className="rounded-xl bg-[#f2f6f4] p-3 text-[10px] leading-5 text-[#65736b]">
            경험 카드와 공고는 워크스페이스의 SQLite 데이터베이스에 저장됩니다. 가져온 원본 문서 파일은 카드 후보를 만든 뒤 보관하지 않습니다.
          </div>
        </div>
      </section>
    </>
  );
}
