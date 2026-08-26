"use client";

/**
 * Holds the one piece of admin chrome state: whether the sidebar is open.
 *
 * It lives here rather than inside the sidebar because the main column's left
 * padding has to move with it, and the two are siblings. `children` is still
 * server-rendered — it arrives as a prop, so nothing about the pages below
 * becomes a client component.
 *
 * The state is deliberately not persisted: the layout outlives client-side
 * navigation between the admin pages, so it already survives everything except
 * a full reload.
 */

import { useState, type ReactNode } from "react";

import { AdminNav } from "@/components/admin-nav";

export function AdminShell({
  notice,
  children,
}: {
  notice?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-dvh">
      <AdminNav collapsed={collapsed} onToggle={() => setCollapsed((open) => !open)} />

      {/*
        Clears the fixed sidebar on desktop; it sits above the content below.

        The sidebar is `top-4 left-4` and either `w-14` or `w-44`, so its right
        edge lands at 72px or 192px: the padding here is that plus the same 16px
        step used for every other margin and gutter on the page. `lg:py-4`
        starts the columns level with the sidebar's top edge.
      */}
      <main
        className={`px-4 py-10 transition-[padding] duration-200 lg:py-4 ${
          collapsed ? "lg:pl-22" : "lg:pl-52"
        }`}
      >
        {notice}
        {children}
      </main>
    </div>
  );
}
