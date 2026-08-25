"use server";

/**
 * Server actions behind the /admin editor.
 *
 * Every mutating action calls `requireAdmin()` first — server actions compile
 * down to public HTTP endpoints, so the session check has to live in the action
 * itself rather than only in the page that renders the form.
 *
 * Uploads are handled as signed upload URLs rather than multipart posts: the
 * browser sends the file straight to Supabase, because Vercel rejects
 * serverless request bodies over 4.5MB and video files comfortably exceed that.
 */

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { endSession, passwordIsValid, requireAdmin, startSession } from "@/lib/auth";
import { getManifest, saveManifest } from "@/lib/media";
import { MANIFEST_TAG, type Slide, type SlideKind } from "@/lib/slides";
import { adminStorage } from "@/lib/supabase-admin";

/** Strip a filename down to something safe to use as an object path. */
function slugifyFilename(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "upload";
}

export async function signInAction(_prev: string | null, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!passwordIsValid(password)) return "That password is not right.";
  await startSession();
  redirect("/admin");
}

export async function signOutAction() {
  await endSession();
  redirect("/admin");
}

/**
 * Mint a one-shot signed upload URL. The returned token authorises exactly one
 * PUT to exactly this path, so it is safe to hand to the browser.
 */
export async function createUploadTargetAction(filename: string) {
  await requireAdmin();

  const path = `slides/${Date.now()}-${slugifyFilename(filename)}`;
  const { data, error } = await adminStorage().createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Could not start the upload: ${error?.message ?? "unknown error"}`);
  }
  return { path: data.path, token: data.token };
}

/** Record a finished upload in the manifest, appending it to the end. */
export async function addSlideAction(slide: {
  path: string;
  kind: SlideKind;
  name: string;
}) {
  await requireAdmin();

  const manifest = await getManifest({ fresh: true });
  const entry: Slide = {
    id: crypto.randomUUID(),
    path: slide.path,
    kind: slide.kind,
    name: slide.name,
  };

  await saveManifest({ ...manifest, slides: [...manifest.slides, entry] });
  revalidateTag(MANIFEST_TAG, "max");
}

/**
 * Apply a new order. Takes the full list of ids and reorders the existing
 * slides to match, ignoring any id that is no longer present.
 */
export async function saveOrderAction(orderedIds: string[]) {
  await requireAdmin();

  const manifest = await getManifest({ fresh: true });
  const bySlideId = new Map(manifest.slides.map((slide) => [slide.id, slide]));

  const reordered = orderedIds
    .map((id) => bySlideId.get(id))
    .filter((slide): slide is Slide => Boolean(slide));

  // Anything the client did not know about stays on the end rather than
  // vanishing, in case a second tab added a slide mid-drag.
  const untouched = manifest.slides.filter((slide) => !orderedIds.includes(slide.id));

  await saveManifest({ ...manifest, slides: [...reordered, ...untouched] });
  revalidateTag(MANIFEST_TAG, "max");
}

/** Remove a slide from the manifest and delete the underlying object. */
export async function deleteSlideAction(id: string) {
  await requireAdmin();

  const manifest = await getManifest({ fresh: true });
  const target = manifest.slides.find((slide) => slide.id === id);
  if (!target) return;

  await saveManifest({
    ...manifest,
    slides: manifest.slides.filter((slide) => slide.id !== id),
  });

  // Drop the file after the manifest, so a failure here leaves an orphaned
  // object rather than a slide pointing at nothing.
  await adminStorage().remove([target.path]);
  revalidateTag(MANIFEST_TAG, "max");
}

/** Change how long still images hold the screen. */
export async function setImageDurationAction(seconds: number) {
  await requireAdmin();

  const clamped = Math.min(60, Math.max(1, Math.round(seconds)));
  const manifest = await getManifest({ fresh: true });

  await saveManifest({ ...manifest, imageDurationMs: clamped * 1000 });
  revalidateTag(MANIFEST_TAG, "max");
}
