import { auth } from "@/auth";
import { generateCoachReply } from "@/lib/coach";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "APPLICANT") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.slice(0, 2000) : "";
  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  const reply = await generateCoachReply(session.user.id, message);
  return NextResponse.json(reply);
}
