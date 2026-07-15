"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AccountUser = {
  name: string;
  email: string;
};

function getInitial(user: AccountUser) {
  const source = user.name.trim() || user.email.trim();
  return Array.from(source)[0]?.toUpperCase() ?? "I";
}

export default function AccountMenu({ user }: { user: AccountUser }) {
  const router = useRouter();
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="계정 메뉴 열기"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setError(null);
          setOpen((current) => !current);
        }}
        className="flex h-10 items-center gap-2 rounded-xl border border-[#dce8e1] bg-white px-1.5 text-left text-[11px] font-semibold text-[#526159] shadow-sm hover:border-[#b8d6c7] hover:bg-[#f7fbf9] sm:px-2"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-[#e9f7f0] font-black text-[#167b57]">
          {getInitial(user)}
        </span>
        <span className="hidden max-w-28 truncate pr-1 lg:block">
          {user.name || "소유자"}
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-40 w-64 overflow-hidden rounded-2xl border border-[#dfe7e2] bg-white p-2 shadow-[0_18px_50px_rgba(17,35,26,.14)]"
        >
          <div className="border-b border-[#edf0ee] px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#167b57] text-[13px] font-black text-white">
                {getInitial(user)}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[12px] text-[#26332c]">
                  {user.name || "소유자"}
                </strong>
                <span className="mt-0.5 block truncate text-[10px] text-[#87928c]">
                  {user.email}
                </span>
              </span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#6b7871]">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              개인 워크스페이스
            </p>
          </div>

          <div className="space-y-1 py-2">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[#536159] hover:bg-[#eef7f2] hover:text-[#126a4a]"
            >
              프로필 및 설정
            </Link>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={signOut}
              className="w-full rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-[#6c7771] hover:bg-red-50 hover:text-red-700 disabled:opacity-45"
            >
              {busy ? "로그아웃 중…" : "로그아웃"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mx-2 mb-2 rounded-lg bg-red-50 p-2 text-[10px] leading-4 text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
