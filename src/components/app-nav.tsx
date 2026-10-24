"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "タスク", icon: "M5 13l4 4L19 7" },
  { href: "/plan", label: "計画作成", icon: "M12 4v16m8-8H4" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-[15px] font-bold tracking-tight">
            SAPIX 家庭学習
          </Link>
          <nav className="hidden gap-1 md:flex">
            {ITEMS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active(i.href) ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-2">
          {ITEMS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                active(i.href) ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={i.icon} />
              </svg>
              {i.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
