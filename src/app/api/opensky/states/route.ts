import { NextRequest, NextResponse } from "next/server";

const OPENSKY_BASE = "https://opensky-network.org/api/states/all";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const lamin = searchParams.get("lamin");
    const lomin = searchParams.get("lomin");
    const lamax = searchParams.get("lamax");
    const lomax = searchParams.get("lomax");

    const upstreamUrl = new URL(OPENSKY_BASE);

    if (lamin) upstreamUrl.searchParams.set("lamin", lamin);
    if (lomin) upstreamUrl.searchParams.set("lomin", lomin);
    if (lamax) upstreamUrl.searchParams.set("lamax", lamax);
    if (lomax) upstreamUrl.searchParams.set("lomax", lomax);

    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (username && password) {
      const basic = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${basic}`;
    }

    const response = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: "OpenSky request failed",
          status: response.status,
          detail: text,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected OpenSky proxy error",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}