"use client";

// Design Ref: §3.1 — 모든 화면 위에 같은 이동 메뉴(홈·일정·기록·설정)를 둔다.
// 현재 보고 있는 화면을 강조하려고 주소(pathname)를 읽기 때문에 클라이언트 컴포넌트로 만든다.
import Link from "next/link";
import { usePathname } from "next/navigation";

// 메뉴 순서와 이름은 DESIGN.md 3.1 화면 목록과 같다.
const MENU_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/schedule", label: "일정" },
  { href: "/records", label: "기록" },
  { href: "/settings", label: "설정" },
] as const;

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="mt-4 flex gap-1 border-b border-foreground/15">
      {MENU_ITEMS.map((item) => {
        const isCurrent = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={
              isCurrent
                ? "-mb-px border-b-2 border-foreground px-4 py-2 text-sm font-semibold"
                : "-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-foreground/60 transition-colors hover:text-foreground"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
