import { NextResponse } from "next/server";
import { handleSendEmail } from "@/lib/send-email-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

async function respond(request: Request) {
  const result = await handleSendEmail(request);
  return NextResponse.json(result.body, { status: result.status });
}

export const GET = respond;
export const POST = respond;
export const PUT = respond;
export const PATCH = respond;
export const DELETE = respond;
export const OPTIONS = respond;
export const HEAD = respond;
