/**
 * Daily keep-alive ping, driven by the Vercel cron in `vercel.json`.
 *
 * Supabase pauses free projects after a week without activity, and a paused
 * project takes Storage down with it — which on a low-traffic site means the
 * carousel can go dark simply because nobody visited. One cheap read per day
 * keeps the project counted as active.
 */

import { NextResponse } from "next/server";

import { getManifest } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel sends this header when CRON_SECRET is configured. If the variable is
  // unset the route stays open, which is harmless — it only performs a read.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorised", { status: 401 });
  }

  const manifest = await getManifest({ fresh: true });
  return NextResponse.json({ ok: true, slides: manifest.slides.length });
}
