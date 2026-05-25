import { NextResponse } from "next/server";
import { getValidatedServerSession } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getValidatedServerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Not authenticated." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { userId: session.user.id },
  });
}
