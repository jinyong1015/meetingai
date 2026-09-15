import { NextResponse } from "next/server";
import { getLocalEngineDefaultsFromEnv } from "@/lib/localEngines/defaults";

export const runtime = "nodejs";

/**
 * Returns non-secret local-engine URL/model defaults from server env.
 * Used to seed browser IndexedDB settings. Never includes API keys.
 */
export async function GET() {
  return NextResponse.json(getLocalEngineDefaultsFromEnv());
}
