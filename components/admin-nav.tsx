"use client";

/**
 * The admin's floating sidebar.
 *
 * Client-side only for `usePathname`, which is what marks the current page —
 * everything else here is static.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/actions";

const PAGES = [
  { href: "/admin", label: "Carousel" },
  { href: "/admin/details", label: "Site details" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-6 left-6 z-20 flex w-44 flex-col gap-1 rounded-xl border border-ink/10 bg-ink/5 p-3 backdrop-blur">
      {PAGES.map((page) => {
        const current = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={current ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm transition ${
              current ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/10"
            }`}
          >
            {page.label}
          </Link>
        );
      })}

      <hr className="my-2 border-ink/10" />

      <Link
        href="/"
        className="rounded-md px-3 py-2 text-sm text-ink/60 transition hover:bg-ink/10"
      >
        View site
      </Link>

      <form action={signOutAction}>
        <button
          type="submit"
          className="w-full rounded-md px-3 py-2 text-left text-sm text-ink/60 transition hover:bg-ink/10"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
