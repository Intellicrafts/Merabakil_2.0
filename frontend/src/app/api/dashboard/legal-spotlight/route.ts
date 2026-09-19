import { NextResponse } from "next/server";

import type { PrimaryRole } from "@/lib/dashboard-config";
import { getLegalSpotlight } from "@/lib/legal-spotlight/spotlight";

export const revalidate = 86_400;

const VALID_ROLES: PrimaryRole[] = ["admin", "enterprise", "law_firm", "advocate", "citizen"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get("role");
  const role: PrimaryRole = VALID_ROLES.includes(roleParam as PrimaryRole)
    ? (roleParam as PrimaryRole)
    : "citizen";

  try {
    const spotlight = await getLegalSpotlight(role);
    return NextResponse.json(spotlight, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load legal spotlight" }, { status: 502 });
  }
}
