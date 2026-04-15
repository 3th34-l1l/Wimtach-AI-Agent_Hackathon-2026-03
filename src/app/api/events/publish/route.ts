import { publishEvent } from "@/lib/kafka-producer";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (process.env.NODE_ENV !== "production") {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "dev_mode",
        topic: body?.topic ?? null,
      });
    }

    if (!body?.topic || !body?.event) {
      return Response.json(
        {
          ok: false,
          error: "Missing topic or event",
        },
        { status: 400 }
      );
    }

    await publishEvent(body.topic, body.event);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Kafka publish failed", err);

    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Kafka publish failed",
      },
      { status: 500 }
    );
  }
}