/**
 * Chrome shared by every admin page: the sign-in gate, the sidebar, and the
 * notice shown when storage is not connected.
 *
 * Putting the gate here rather than on each page means a new admin page cannot
 * accidentally ship unprotected.
 */

import { AdminNav } from "@/components/admin-nav";
import { LoginForm } from "@/components/login-form";
import { isSignedIn, missingAuthConfig } from "@/lib/auth";
import { isStorageWritable } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  if (!(await isSignedIn())) {
    // Say so up front rather than letting the login attempt fail opaquely.
    const missing = missingAuthConfig();

    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        {missing.length > 0 ? (
          <div className="max-w-sm rounded-lg border border-ink/20 bg-ink/5 p-4 text-sm">
            <p className="font-medium">Sign-in is not configured here.</p>
            <p className="mt-1 text-ink/70">
              {missing.join(" and ")} {missing.length > 1 ? "are" : "is"} not set
              in this environment. Add {missing.length > 1 ? "them" : "it"} to
              the deployment&rsquo;s environment variables and redeploy.
            </p>
          </div>
        ) : (
          <LoginForm />
        )}
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <AdminNav />

      {/* Clears the fixed sidebar on desktop; it sits above the content below. */}
      <main className="px-6 py-10 lg:pl-60">
        {!isStorageWritable() && (
          <div className="mb-8 max-w-2xl rounded-lg border border-ink/20 bg-ink/5 p-4 text-sm">
            <p className="font-medium">Supabase is not connected.</p>
            <p className="mt-1 text-ink/70">
              Nothing here can be saved yet, and the site is showing its
              built-in placeholder photos. Add your Supabase URL and keys to{" "}
              <code>.env.local</code>, then restart the dev server.
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
