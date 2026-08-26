"use client";

/**
 * The admin's floating sidebar, which collapses to an icon-width bar.
 *
 * The open/closed state lives in components/admin-shell.tsx, because the main
 * column's left padding has to move with it — see the note there.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/actions";
import { SITE } from "@/lib/site";

/**
 * Five icons is not worth a dependency, so they are drawn here.
 *
 * They inherit `currentColor`, which is what lets the current page's white-on-
 * ink pill work without a second set.
 */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      {children}
    </svg>
  );
}

/** A centre frame flanked by the edges of the slides either side of it. */
/** The sidebar itself: a panel with its rail picked out down the left edge. */
const SidebarIcon = (
  <Icon>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M9.5 5v14" />
  </Icon>
);

const CarouselIcon = (
  <Icon>
    <rect x="7" y="5" width="10" height="14" rx="2" />
    <path d="M3.5 8.5v7M20.5 8.5v7" />
  </Icon>
);

/** Lines of copy, which is what that page edits. */
const DetailsIcon = (
  <Icon>
    <path d="M4.5 6.5h15M4.5 12h9.5M4.5 17.5h12.5" />
  </Icon>
);

const ViewSiteIcon = (
  <Icon>
    <path d="M14 4.5h5.5V10M19.5 4.5 12 12" />
    <path d="M17 14v3.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2H10" />
  </Icon>
);

const SignOutIcon = (
  <Icon>
    <path d="M9.5 19.5h-3a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h3" />
    <path d="m15 15.5 3.5-3.5L15 8.5M18.5 12H9" />
  </Icon>
);

const PAGES = [
  { href: "/admin", label: "Carousel", icon: CarouselIcon },
  { href: "/admin/details", label: "Site details", icon: DetailsIcon },
] as const;

/** Shared by the links, the toggle and the sign-out button so the rows line up. */
const ROW = "flex items-center rounded-md py-2 text-sm transition";

export function AdminNav({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  // Every row shares this, the toggle included, so all five icons sit on one
  // left edge. Closed, the labels are gone and the icons centre in the bar.
  const align = collapsed ? "justify-center px-0" : "gap-2.5 px-3";

  return (
    <nav
      className={`fixed top-4 left-4 z-20 flex flex-col gap-1 rounded-xl border border-ink/10 bg-ink/5 p-3 backdrop-blur transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-44"
      }`}
    >
      {/*
        The monogram sits beside the toggle, and goes with the labels when the
        bar closes. It is a tight crop of the same artwork the carousel shows
        — see components/lockup.tsx — cut by scripts/split-lockup.sh, since the
        full lettering is unreadable at the width of a sidebar.
      */}
      {/* `mb-7` on top of the column's `gap-1` sets the header off by 32px —
          double the step the rest of the page spaces things with. */}
      <div className="mb-7 flex items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          title={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
          // Closed, it is the only thing in the row, so it fills it and matches
          // the links below exactly. Open, it holds its size against the mark.
          className={`${ROW} ${align} text-ink/40 hover:bg-ink/10 hover:text-ink/70 ${
            collapsed ? "w-full" : "shrink-0"
          }`}
        >
          {SidebarIcon}
        </button>

        {!collapsed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/brand/lockup-monogram.svg"
            alt={SITE.name}
            width={108}
            height={44}
            // Squares up with a nav row, which is this same 32px tall.
            className="h-8 w-auto"
          />
        )}
      </div>

      {PAGES.map((page) => {
        const current = pathname === page.href;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={current ? "page" : undefined}
            // Closed there is no visible text, so the row needs its own name.
            aria-label={collapsed ? page.label : undefined}
            title={collapsed ? page.label : undefined}
            className={`${ROW} ${align} ${
              current ? "bg-ink text-paper" : "text-ink/70 hover:bg-ink/10"
            }`}
          >
            {page.icon}
            {!collapsed && page.label}
          </Link>
        );
      })}

      <hr className="my-2 border-ink/10" />

      <Link
        href="/"
        aria-label={collapsed ? "View site" : undefined}
        title={collapsed ? "View site" : undefined}
        className={`${ROW} ${align} text-ink/60 hover:bg-ink/10`}
      >
        {ViewSiteIcon}
        {!collapsed && "View site"}
      </Link>

      <form action={signOutAction}>
        <button
          type="submit"
          aria-label={collapsed ? "Sign out" : undefined}
          title={collapsed ? "Sign out" : undefined}
          className={`${ROW} ${align} w-full text-left text-ink/60 hover:bg-ink/10`}
        >
          {SignOutIcon}
          {!collapsed && "Sign out"}
        </button>
      </form>
    </nav>
  );
}
