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
import { isSignedIn, missingAuthConfig } from "@/lib/auth";
import { getDisplayManifest } from "@/lib/media";
import { isStorageWritable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isSignedIn())) {
    // Say so up front rather than letting the login attempt fail opaquely.
    const missing = missingAuthConfig();

    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        {missing.length > 0 ? (
          <div className="max-w-sm rounded-lg border border-ink/20 bg-ink/5 p-4 text-sm">
            <p className="font-medium">Sign-in is not configured here.</p>
            <p className="mt-1 text-ink/70">
              {missing.join(" and ")} {missing.length > 1 ? "are" : "is"} not
              set in this environment. Add{" "}
              {missing.length > 1 ? "them" : "it"} to the deployment&rsquo;s
              environment variables and redeploy.
            </p>
          </div>
        ) : (
          <LoginForm />
        )}
      </main>
    );
  }

  // Mirrors what the public page is showing, placeholders included — an editor
  // reading "Nothing added yet" while photos are live is simply confusing.
  const { manifest: displayed } = await getDisplayManifest({ fresh: true });

  /*
   * Editable only when storage can actually be *written* to. A URL with no
   * secret key would otherwise unlock an editor whose every save throws.
   */
  const storageConfigured = isStorageWritable();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
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
        key={displayed.slides.map((slide) => slide.id).join(",")}
        manifest={displayed}
        storageConfigured={storageConfigured}
      />
    </main>
  );
}
