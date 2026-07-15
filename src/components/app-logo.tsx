import Link from "next/link";

export default function AppLogo({
  href = "/",
  className = "",
  showSubtitleOnMobile = false,
}: {
  href?: string;
  className?: string;
  showSubtitleOnMobile?: boolean;
}) {
  return (
    <Link href={href} className={`group flex shrink-0 items-center gap-3 ${className}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-[#167b57] text-[15px] font-black text-white shadow-[0_6px_18px_rgba(22,123,87,.24)] group-hover:-translate-y-0.5">
        I
      </span>
      <span>
        <span className="block text-[15px] font-extrabold tracking-[-0.04em]">
          이직 OS
        </span>
        <span
          className={`${showSubtitleOnMobile ? "block" : "hidden sm:block"} text-[10px] font-medium tracking-[0.08em] text-[#87928c]`}
        >
          CAREER WORKSPACE
        </span>
      </span>
    </Link>
  );
}
