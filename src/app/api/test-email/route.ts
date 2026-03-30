import { NextResponse } from "next/server";
import { testSMTPConnection, sendTestEmail } from "../../../../lib/testSMTP";

export const runtime = "nodejs";

/**
 * POST /api/test-email
 * 
 * Send a test email via SMTP to verify configuration
 * 
 * Request body:
 * {
 *   "testConnection": true,  // Just test SMTP connection without sending
 *   "sendTo": "email@example.com"  // Send a test email to this address
 * }
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));

    // Option 1: Just test the connection
    if (payload?.testConnection === true) {
      const result = await testSMTPConnection();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    // Option 2: Send a test email
    if (typeof payload?.sendTo === "string" && payload.sendTo.trim()) {
      const toEmail = payload.sendTo.trim();
      const result = await sendTestEmail(toEmail);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    // No action specified
    return NextResponse.json(
      {
        ok: false,
        error: 'Provide either {"testConnection": true} or {"sendTo": "email@example.com"}',
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-email?action=test
 * Quick test via query parameter
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const email = searchParams.get("email");

  if (action === "test") {
    const result = await testSMTPConnection();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "send" && email) {
    const result = await sendTestEmail(email);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Use ?action=test for connection test, or ?action=send&email=user@example.com to send test email",
    },
    { status: 400 }
  );
}
