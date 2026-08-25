"use client";

/**
 * The client-facing editor: add media, drag to reorder, delete, and set how
 * long stills hold the screen.
 *
 * Uploads deliberately bypass the Next server. For each file the server mints a
 * one-shot signed URL and the browser PUTs straight to Supabase Storage, which
 * sidesteps Vercel's 4.5MB serverless request body cap. Only the small
 * bookkeeping call (`addSlideAction`) travels through the app.
 */

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import {
  addSlideAction,
  createUploadTargetAction,
  deleteSlideAction,
  saveOrderAction,
  setImageDurationAction,
  setSiteMetaAction,
  setSlideDurationAction,
} from "@/app/actions";
import {
  kindFromMimeType,
  MAX_SLIDE_SECONDS,
  MIN_SLIDE_SECONDS,
  naturalSize,
  UPLOAD_ACCEPT,
  type Manifest,
  type Slide,
} from "@/lib/slides";
import { publicUrl } from "@/lib/storage-url";
import { browserStorage } from "@/lib/supabase-browser";

/** Supabase's free tier rejects anything larger, so catch it before uploading. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * A video file's own length, read in the browser before upload.
 *
 * Becomes the slide's default hold, so a reel of clips of different lengths
 * behaves sensibly without anyone setting anything.
 */
function readVideoDurationMs(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");

    const finish = (value?: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };

    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      finish(Number.isFinite(probe.duration) ? probe.duration * 1000 : undefined);
    // A duration we cannot read is not worth failing an upload over.
    probe.onerror = () => finish(undefined);
    probe.src = url;
  });
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function AdminEditor({
  manifest,
  storageConfigured,
}: {
  manifest: Manifest;
  storageConfigured: boolean;
}) {
  const router = useRouter();

  const [slides, setSlides] = useState<Slide[]>(manifest.slides);
  const [seconds, setSeconds] = useState(Math.round(manifest.imageDurationMs / 1000));
  const [title, setTitle] = useState(manifest.meta.title);
  const [description, setDescription] = useState(manifest.meta.description);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const dragIndex = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const savedOrder = useMemo(
    () => manifest.slides.map((slide) => slide.id).join(","),
    [manifest.slides],
  );
  const orderIsDirty = slides.map((slide) => slide.id).join(",") !== savedOrder;

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const queue = Array.from(files);

      for (const [position, file] of queue.entries()) {
        setStatus(`Uploading ${position + 1} of ${queue.length} — ${file.name}`);

        const kind = kindFromMimeType(file.type);
        if (!kind) {
          throw new Error(
            `${file.name} is not a web format a browser can display. Convert it first with scripts/to-web.sh.`,
          );
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            `${file.name} is ${formatMegabytes(file.size)}. The limit is 50MB — compress it first.`,
          );
        }

        const target = await createUploadTargetAction(file.name);
        const upload = await browserStorage().uploadToSignedUrl(
          target.path,
          target.token,
          file,
          { contentType: file.type },
        );
        if (upload.error) throw new Error(upload.error.message);

        await addSlideAction({
          path: target.path,
          kind,
          name: file.name,
          durationMs: kind === "video" ? await readVideoDurationMs(file) : undefined,
        });
      }

      setStatus(`Added ${queue.length} ${queue.length === 1 ? "file" : "files"}.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed.");
      setStatus(null);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSlides(next);
  }

  function persistOrder() {
    setError(null);
    startTransition(async () => {
      try {
        await saveOrderAction(slides.map((slide) => slide.id));
        setStatus("Order saved.");
        router.refresh();
      } catch {
        setError("Could not save the new order.");
      }
    });
  }

  function remove(slide: Slide) {
    if (!window.confirm(`Remove ${slide.name}? This cannot be undone.`)) return;

    setError(null);
    startTransition(async () => {
      try {
        await deleteSlideAction(slide.id);
        setSlides((current) => current.filter((entry) => entry.id !== slide.id));
        setStatus(`Removed ${slide.name}.`);
        router.refresh();
      } catch {
        setError("Could not remove that slide.");
      }
    });
  }

  function persistMeta() {
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

  function persistSlideDuration(id: string, seconds: number | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setSlideDurationAction(id, seconds);
        setStatus(seconds === null ? "Timing cleared." : "Timing saved.");
        router.refresh();
      } catch {
        setError("Could not save that timing.");
      }
    });
  }

  function persistDuration() {
    setError(null);
    startTransition(async () => {
      try {
        await setImageDurationAction(seconds);
        setStatus("Timing saved.");
        router.refresh();
      } catch {
        setError("Could not save the timing.");
      }
    });
  }

  // Nothing can be saved without a secret key, so a disconnected editor is
  // simply permanently busy — folding the two means every control that already
  // respects `busy` is read-only for free.
  const locked = !storageConfigured;
  const busy = uploading || pending || locked;

  return (
    <div className="flex flex-col gap-8">
      {locked && (
        <div className="rounded-lg border border-ink/20 bg-ink/5 p-4 text-sm">
          <p className="font-medium">Supabase is not connected.</p>
          <p className="mt-1 text-ink/70">
            The site is showing {manifest.slides.length} built-in placeholder
            photos, listed below. They are part of the code rather than
            uploads, so they cannot be edited or removed here — and they
            disappear on their own as soon as real media exists.
          </p>
          <p className="mt-2 text-ink/70">
            Add your Supabase URL and keys to <code>.env.local</code>, then
            restart the dev server to start managing media.
          </p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-widest text-ink/50 uppercase">
          Site details
        </h2>
        <p className="text-xs text-ink/40">
          Used for the browser tab, link previews when the site is shared, and
          how search engines and AI assistants describe the site.
        </p>

        <label className="flex flex-col gap-1 text-sm text-ink/70">
          Title
          <input
            type="text"
            value={title}
            maxLength={120}
            disabled={locked}
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
            disabled={locked}
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
            onClick={persistMeta}
            disabled={
              busy ||
              !title.trim() ||
              !description.trim() ||
              (title === manifest.meta.title &&
                description === manifest.meta.description)
            }
            className="rounded-md border border-ink/20 px-3 py-1.5 text-sm transition hover:bg-ink/10 disabled:opacity-40"
          >
            Save details
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-widest text-ink/50 uppercase">Add media</h2>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!locked) void uploadFiles(event.dataTransfer.files);
          }}
          className="rounded-lg border border-dashed border-ink/25 p-6 text-center"
        >
          <p className="text-sm text-ink/60">Drop photos or videos here, or</p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
          >
            Choose files
          </button>
          <p className="mt-3 text-xs text-ink/35">
            JPEG, PNG, WebP, AVIF, MP4 or WebM — up to 50MB each.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            hidden
            onChange={(event) => void uploadFiles(event.target.files)}
          />
        </div>
      </section>

      {(status || error) && (
        <p className={`text-sm ${error ? "text-red-700" : "text-ink/60"}`}>
          {error ?? status}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs tracking-widest text-ink/50 uppercase">
            Order ({slides.length})
          </h2>
          {orderIsDirty && !locked && (
            <button
              type="button"
              onClick={persistOrder}
              disabled={busy}
              className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition hover:bg-ink/85 disabled:opacity-50"
            >
              Save order
            </button>
          )}
        </div>

        {slides.length === 0 ? (
          <p className="text-sm text-ink/40">Nothing added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {slides.map((slide, position) => (
              <li
                key={slide.id}
                draggable={!locked}
                onDragStart={() => {
                  dragIndex.current = position;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex.current !== null) move(dragIndex.current, position);
                  dragIndex.current = null;
                }}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-ink/5 p-2.5"
              >
                <span className="w-6 shrink-0 cursor-grab text-center text-ink/30">
                  ⠿
                </span>

                <SlidePreview slide={slide} position={position} />

                {slide.kind === "video" && (
                  <SlideDuration
                    slide={slide}
                    disabled={busy}
                    onSave={(seconds) => persistSlideDuration(slide.id, seconds)}
                  />
                )}

                <div
                  className={`flex shrink-0 items-center gap-1 ${locked ? "hidden" : ""}`}
                >
                  <IconButton
                    label="Move up"
                    disabled={position === 0 || busy}
                    onClick={() => move(position, position - 1)}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={position === slides.length - 1 || busy}
                    onClick={() => move(position, position + 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    label={`Remove ${slide.name}`}
                    disabled={busy}
                    onClick={() => remove(slide)}
                  >
                    ×
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-widest text-ink/50 uppercase">Timing</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink/70">
            Photos hold for
            <input
              type="number"
              min={1}
              max={60}
              value={seconds}
              onChange={(event) => setSeconds(Number(event.target.value))}
              className="w-20 rounded-md border border-ink/15 bg-ink/5 px-2 py-1 text-ink outline-none focus:border-ink/40"
            />
            seconds
          </label>
          <button
            type="button"
            onClick={persistDuration}
            disabled={busy || seconds === Math.round(manifest.imageDurationMs / 1000)}
            className="rounded-md border border-ink/20 px-3 py-1.5 text-sm transition hover:bg-ink/10 disabled:opacity-40"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-ink/35">
          Videos always play to the end, so this only affects photos.
        </p>
      </section>
    </div>
  );
}

/**
 * One row's preview and caption.
 *
 * The measured size is local state: it is read from the element's own load
 * event and used only for this row's caption, so lifting it to the parent
 * bought a record, a callback and a prop for nothing.
 */
function SlidePreview({ slide, position }: { slide: Slide; position: number }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const src = publicUrl(slide.path);
  const media = "max-h-full max-w-full object-contain";

  const measure = (node: HTMLImageElement | HTMLVideoElement) =>
    setSize(naturalSize(node));

  const shape = size
    ? `${slide.kind} · ${size.width}×${size.height} · ${orientationOf(size)}`
    : slide.kind;

  return (
    <>
      <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded border border-ink/10 bg-paper">
        {slide.kind === "video" ? (
          <>
            {/* `preload="metadata"` pulls just enough to paint the first frame. */}
            <video
              src={src}
              className={media}
              preload="metadata"
              muted
              playsInline
              onLoadedMetadata={(event) => measure(event.currentTarget)}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-1 bottom-1 rounded-sm bg-ink/70 px-1 text-[10px] leading-4 text-paper"
            >
              ▶
            </span>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className={media}
            // These are the full-size originals; a long reel would otherwise
            // pull every one at full resolution to fill an 80px box.
            loading="lazy"
            decoding="async"
            onLoad={(event) => measure(event.currentTarget)}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{slide.name}</p>
        <p className="text-xs text-ink/40">
          {position + 1} · {shape}
        </p>
      </div>
    </>
  );
}

/**
 * How long one clip holds the screen.
 *
 * Blank means "as long as the video runs" — the natural default, and what a
 * slide falls back to when the field is cleared.
 */
function SlideDuration({
  slide,
  disabled,
  onSave,
}: {
  slide: Slide;
  disabled?: boolean;
  onSave: (seconds: number | null) => void;
}) {
  const saved = slide.durationMs ? Math.round(slide.durationMs / 1000) : null;
  const [value, setValue] = useState(saved === null ? "" : String(saved));

  function commit() {
    const trimmed = value.trim();

    if (trimmed === "") {
      if (saved !== null) onSave(null);
      return;
    }

    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      setValue(saved === null ? "" : String(saved));
      return;
    }
    if (Math.round(seconds) === saved) return;

    onSave(seconds);
  }

  return (
    <label className="flex shrink-0 items-center gap-1 text-xs text-ink/50">
      <input
        type="number"
        inputMode="numeric"
        min={MIN_SLIDE_SECONDS}
        max={MAX_SLIDE_SECONDS}
        value={value}
        disabled={disabled}
        placeholder="auto"
        aria-label={`Seconds to show ${slide.name}`}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="w-14 rounded-md border border-ink/15 bg-ink/5 px-2 py-1 text-ink outline-none focus:border-ink/40"
      />
      s
    </label>
  );
}

/** Orientation label — friendlier than reading two numbers. */
function orientationOf({ width, height }: { width: number; height: number }) {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.02) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-md border border-ink/15 text-ink/70 transition hover:bg-ink/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
