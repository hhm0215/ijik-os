"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  createdAt: Date | string;
};

type BanTarget = Pick<ManagedUser, "id" | "name" | "email">;

const PAGE_SIZE = 20;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function hasRole(user: ManagedUser, role: string) {
  return (user.role ?? "user")
    .split(",")
    .map((value) => value.trim())
    .includes(role);
}

export default function UsersClient({
  currentUserId,
  signupOpen,
}: {
  currentUserId: string;
  signupOpen: boolean;
}) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<"email" | "name">("email");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<BanTarget | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<"permanent" | "86400" | "604800" | "2592000">("permanent");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          sortBy: "createdAt",
          sortDirection: "desc",
          ...(search
            ? {
                searchValue: search,
                searchField,
                searchOperator: "contains" as const,
              }
            : {}),
        },
      });
      if (result.error) throw new Error(result.error.message);
      setUsers((result.data?.users ?? []) as ManagedUser[]);
      setTotal(result.data?.total ?? 0);
    } catch {
      setError("사용자 목록을 불러오지 못했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [page, search, searchField]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeLabel = useMemo(() => {
    if (!total) return "0명";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return `${start}–${end} / ${total}명`;
  }, [page, total]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setNotice(null);
    setSearch(searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft("");
    setSearch("");
    setPage(1);
  }

  async function submitBan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!banTarget || banTarget.id === currentUserId || actionBusy) return;
    const reason = banReason.trim();
    if (!reason) return;

    setActionBusy(banTarget.id);
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.admin.banUser({
        userId: banTarget.id,
        banReason: reason,
        ...(banDuration === "permanent"
          ? {}
          : { banExpiresIn: Number(banDuration) }),
      });
      if (result.error) throw new Error(result.error.message);
      setNotice(`${banTarget.name || banTarget.email} 계정의 사용을 중지했어요.`);
      setBanTarget(null);
      setBanReason("");
      setBanDuration("permanent");
      await loadUsers();
    } catch {
      setError("계정 사용을 중지하지 못했어요.");
    } finally {
      setActionBusy(null);
    }
  }

  async function unbanUser(user: ManagedUser) {
    if (user.id === currentUserId || actionBusy) return;
    if (!window.confirm(`${user.name || user.email} 계정의 사용 중지를 해제할까요?`)) return;

    setActionBusy(user.id);
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.admin.unbanUser({ userId: user.id });
      if (result.error) throw new Error(result.error.message);
      setNotice(`${user.name || user.email} 계정을 다시 사용할 수 있어요.`);
      await loadUsers();
    } catch {
      setError("계정 사용 중지를 해제하지 못했어요.");
    } finally {
      setActionBusy(null);
    }
  }

  async function revokeSessions(user: ManagedUser) {
    if (user.id === currentUserId || actionBusy) return;
    if (!window.confirm(`${user.name || user.email} 계정의 모든 로그인 세션을 종료할까요?`)) return;

    setActionBusy(user.id);
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.admin.revokeUserSessions({ userId: user.id });
      if (result.error) throw new Error(result.error.message);
      setNotice(`${user.name || user.email} 계정의 로그인 세션을 모두 종료했어요.`);
    } catch {
      setError("로그인 세션을 종료하지 못했어요.");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#edf0ee] p-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.1em] text-[#8a958f]">REGISTERED USERS</p>
            <h2 className="mt-1 text-[18px] font-extrabold tracking-[-0.035em]">
              가입 계정 <span className="text-[#167b57]">{total}</span>
            </h2>
          </div>
          <form onSubmit={submitSearch} className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
            <select
              aria-label="검색 기준"
              value={searchField}
              onChange={(event) => {
                setSearchField(event.target.value as "email" | "name");
                setPage(1);
              }}
              className="field sm:w-28"
            >
              <option value="email">이메일</option>
              <option value="name">이름</option>
            </select>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              className="field min-w-0 flex-1"
              placeholder={searchField === "email" ? "이메일 검색" : "이름 검색"}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#172d22] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#167b57] disabled:opacity-40"
            >
              검색
            </button>
            {(search || searchDraft) && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl border border-[#dce3df] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#66736c] hover:bg-[#f4f6f5]"
              >
                초기화
              </button>
            )}
          </form>
        </div>

        <div className="border-b border-[#edf0ee] bg-[#fafcfb] px-5 py-3 text-[10px] leading-5 text-[#738078] sm:px-6">
          공개 가입은 현재 <strong className={signupOpen ? "text-[#167b57]" : "text-[#5f6b65]"}>{signupOpen ? "열림" : "닫힘"}</strong> 상태입니다. 변경하려면 서버의 <code className="font-bold">SIGNUP_MODE</code>를 수정하고 앱을 다시 시작하세요.
        </div>

        {notice && (
          <p role="status" className="m-5 rounded-xl bg-[#edf8f2] p-3 text-[11px] text-[#176b4d] sm:mx-6">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-700 sm:mx-6">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid min-h-64 place-items-center p-8 text-[12px] font-semibold text-[#7b8780]">
            사용자 목록을 불러오는 중…
          </div>
        ) : users.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef3f0] text-xl">◎</span>
              <h3 className="mt-4 text-[14px] font-bold text-[#35423b]">
                {search ? "검색 결과가 없어요" : "아직 가입한 사용자가 없어요"}
              </h3>
              {search && (
                <button type="button" onClick={clearSearch} className="mt-3 text-[11px] font-bold text-[#167b57]">
                  전체 사용자 보기
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[#edf0ee]">
            {users.map((user) => {
              const isCurrent = user.id === currentUserId;
              const isAdmin = hasRole(user, "admin");
              const isBusy = actionBusy === user.id;
              return (
                <li key={user.id} className="grid gap-4 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_160px_180px_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-[12px] font-black ${user.banned ? "bg-red-50 text-red-700" : "bg-[#e9f7f0] text-[#167b57]"}`}>
                      {Array.from(user.name.trim() || user.email)[0]?.toUpperCase() ?? "U"}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="truncate text-[13px] text-[#2f3c34]">{user.name || "이름 없음"}</strong>
                        {isCurrent && (
                          <span className="rounded-full bg-[#edf3f0] px-2 py-0.5 text-[8px] font-bold text-[#5f6b65]">현재 계정</span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[#849089]">{user.email}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 lg:block">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black ${isAdmin ? "bg-[#172d22] text-white" : "bg-[#eef1ef] text-[#66736c]"}`}>
                      {isAdmin ? "ADMIN" : "USER"}
                    </span>
                    <span className={`ml-0 inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold lg:ml-1 ${user.banned ? "bg-red-50 text-red-700" : "bg-[#e4f5ec] text-[#167b57]"}`}>
                      {user.banned ? "사용 중지" : "정상"}
                    </span>
                  </div>
                  <div className="text-[10px] leading-5 text-[#7d8982]">
                    <span className="block">가입 {formatDate(user.createdAt)}</span>
                    {user.banned && (
                      <span className="block truncate text-red-600" title={user.banReason ?? "사유 없음"}>
                        {user.banReason || "사유 없음"}
                        {user.banExpires ? ` · ${formatDate(user.banExpires)}까지` : " · 무기한"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {user.banned ? (
                      <button
                        type="button"
                        disabled={isCurrent || isBusy}
                        onClick={() => void unbanUser(user)}
                        className="rounded-xl border border-[#a9cdbb] bg-white px-3 py-2 text-[10px] font-bold text-[#167b57] hover:bg-[#edf8f2] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isBusy ? "처리 중…" : "중지 해제"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isCurrent || isBusy}
                        onClick={() => {
                          setBanTarget(user);
                          setBanReason("");
                          setNotice(null);
                        }}
                        className="rounded-xl border border-[#dfc5c1] bg-white px-3 py-2 text-[10px] font-semibold text-[#9b5149] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        사용 중지
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isCurrent || isBusy || Boolean(user.banned)}
                      onClick={() => void revokeSessions(user)}
                      className="rounded-xl border border-[#dce3df] bg-white px-3 py-2 text-[10px] font-semibold text-[#66736c] hover:bg-[#f4f6f5] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      세션 종료
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-[#edf0ee] px-5 py-4 text-[10px] text-[#7f8b84] sm:px-6">
          <span>{rangeLabel}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-xl border border-[#dce3df] bg-white px-3 py-2 font-semibold text-[#66736c] hover:bg-[#f4f6f5] disabled:opacity-35"
            >
              ← 이전
            </button>
            <span className="grid min-w-16 place-items-center rounded-xl bg-[#f2f5f3] px-3 font-bold text-[#526159]">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={loading || page >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              className="rounded-xl border border-[#dce3df] bg-white px-3 py-2 font-semibold text-[#66736c] hover:bg-[#f4f6f5] disabled:opacity-35"
            >
              다음 →
            </button>
          </div>
        </footer>
      </section>

      {banTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#17211b]/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitBan}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ban-dialog-title"
            className="surface w-full max-w-md overflow-hidden"
          >
            <div className="border-b border-[#edf0ee] px-6 py-5">
              <p className="text-[10px] font-black tracking-[0.1em] text-red-600">SUSPEND ACCESS</p>
              <h2 id="ban-dialog-title" className="mt-1 text-[18px] font-extrabold tracking-[-0.035em]">
                사용자 계정 중지
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-[#748078]">
                <strong>{banTarget.name || banTarget.email}</strong> 사용자는 즉시 로그아웃되고 중지 기간에는 다시 로그인할 수 없습니다.
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="ban-reason" className="mb-2 block text-[11px] font-bold text-[#3d4a42]">중지 사유</label>
                <textarea
                  id="ban-reason"
                  required
                  maxLength={200}
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                  className="field min-h-24 resize-y"
                  placeholder="관리 기록에 남길 사유를 입력하세요"
                />
              </div>
              <div>
                <label htmlFor="ban-duration" className="mb-2 block text-[11px] font-bold text-[#3d4a42]">중지 기간</label>
                <select
                  id="ban-duration"
                  value={banDuration}
                  onChange={(event) => setBanDuration(event.target.value as typeof banDuration)}
                  className="field"
                >
                  <option value="permanent">무기한</option>
                  <option value="86400">24시간</option>
                  <option value="604800">7일</option>
                  <option value="2592000">30일</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf0ee] px-6 py-4">
              <button
                type="button"
                disabled={Boolean(actionBusy)}
                onClick={() => setBanTarget(null)}
                className="rounded-xl border border-[#dce3df] bg-white px-4 py-2.5 text-[11px] font-semibold text-[#66736c] hover:bg-[#f4f6f5] disabled:opacity-40"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={Boolean(actionBusy) || !banReason.trim()}
                className="rounded-xl bg-red-700 px-5 py-2.5 text-[11px] font-bold text-white hover:bg-red-800 disabled:opacity-40"
              >
                {actionBusy ? "중지 중…" : "계정 사용 중지"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
