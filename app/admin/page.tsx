/**
 * The client's editor. Password-gated: signed out visitors get the login form,
 * signed in ones get the media manager.
 *
 * This page is explicitly dynamic and reads the manifest with `fresh: true`, so
 * the editor always shows the true current state rather than the cached copy
 * the public page is happy to serve.
 */

import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { AdminEditor } from "@/components/admin-editor";
import { LoginForm } from "@/components/login-form";
import { isSignedIn } from "@/lib/auth";
import { getManifest } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isSignedIn())) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <LoginForm />
      </main>
    );
  }

  const manifest = await getManifest({ fresh: true });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium">Carousel</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-ink/60 underline-offset-4 hover:underline">
            View site
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-ink/60 underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/*
        Keyed on the saved order so that a refresh after an upload, delete or
        reorder remounts the editor with the new server state — client state
        would otherwise keep showing the list as it was on first render.
      */}
      <AdminEditor
        key={manifest.slides.map((slide) => slide.id).join(",")}
        manifest={manifest}
      />
    </main>
  );
}
