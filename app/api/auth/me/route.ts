import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ role: null, scope: null });
  }
  return NextResponse.json({ role: session.role, scope: session.scope });
}
