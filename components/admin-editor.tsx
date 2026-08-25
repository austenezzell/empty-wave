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
} from "@/app/actions";
import {
  kindFromMimeType,
  UPLOAD_ACCEPT,
  type Manifest,
  type Slide,
} from "@/lib/slides";
import { publicUrl } from "@/lib/storage-url";
import { browserStorage } from "@/lib/supabase-browser";

/** Supabase's free tier rejects anything larger, so catch it before uploading. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function AdminEditor({ manifest }: { manifest: Manifest }) {
  const router = useRouter();

  const [slides, setSlides] = useState<Slide[]>(manifest.slides);
  const [seconds, setSeconds] = useState(Math.round(manifest.imageDurationMs / 1000));
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

        await addSlideAction({ path: target.path, kind, name: file.name });
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

  const busy = uploading || pending;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-widest text-ink/50 uppercase">Add media</h2>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void uploadFiles(event.dataTransfer.files);
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
          {orderIsDirty && (
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
                draggable
                onDragStart={() => {
                  dragIndex.current = position;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex.current !== null) move(dragIndex.current, position);
                  dragIndex.current = null;
                }}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-ink/5 p-2"
              >
                <span className="w-6 shrink-0 cursor-grab text-center text-ink/30">
                  ⠿
                </span>

                <Thumbnail slide={slide} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{slide.name}</p>
                  <p className="text-xs text-ink/40">
                    {position + 1} · {slide.kind}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
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

function Thumbnail({ slide }: { slide: Slide }) {
  const src = publicUrl(slide.path);

  return (
    <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-black">
      {slide.kind === "video" ? (
        // `preload="metadata"` pulls just enough to paint a poster frame.
        <video src={src} className="h-full w-full object-cover" preload="metadata" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
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
