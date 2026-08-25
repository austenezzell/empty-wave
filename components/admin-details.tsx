"use client";

/**
 * The site's own copy: the title and description.
 *
 * These feed the browser tab, link previews, the structured-data block and
 * llms.txt, so they are worth letting the client change without a deploy.
 * Managing the reel itself lives on its own page — see components/admin-media.tsx.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setSiteMetaAction } from "@/app/actions";
import type { Manifest } from "@/lib/slides";

export function AdminDetails({
  manifest,
  storageConfigured,
}: {
  manifest: Manifest;
  storageConfigured: boolean;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(manifest.meta.title);
  const [description, setDescription] = useState(manifest.meta.description);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Nothing can be saved without a secret key, so a disconnected editor is
  // simply permanently busy.
  const busy = pending || !storageConfigured;

  const unchanged =
    title === manifest.meta.title && description === manifest.meta.description;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setSiteMetaAction({ title, description });
        setStatus("Site details saved.");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save.");
      }
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      {(status || error) && (
        <p className={`text-sm ${error ? "text-red-700" : "text-ink/60"}`}>
          {error ?? status}
        </p>
      )}

      <p className="text-xs text-ink/40">
        Used for the browser tab, link previews when the site is shared, and how
        search engines and AI assistants describe the site.
      </p>

      <label className="flex flex-col gap-1 text-sm text-ink/70">
        Title
        <input
          type="text"
          value={title}
          maxLength={120}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-md border border-ink/15 bg-ink/5 px-3 py-2 text-ink outline-none focus:border-ink/40"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-ink/70">
        Description
        <textarea
          value={description}
          maxLength={300}
          rows={3}
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
          className="resize-y rounded-md border border-ink/15 bg-ink/5 px-3 py-2 text-ink outline-none focus:border-ink/40"
        />
        <span className="text-xs text-ink/35">
          {description.length}/300 — search results usually cut off near 160.
        </span>
      </label>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={busy || !title.trim() || !description.trim() || unchanged}
          className="rounded-md border border-ink/20 px-3 py-1.5 text-sm transition hover:bg-ink/10 disabled:opacity-40"
        >
          Save details
        </button>
      </div>
    </div>
  );
}
