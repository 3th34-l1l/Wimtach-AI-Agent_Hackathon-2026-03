function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}


export type OpenSkyContext = {
  tailNumber?: string;
  icao24?: string;
  callsign?: string;
  latitude?: number;
  longitude?: number;
  baroAltitude?: number;
  velocity?: number;
  onGround?: boolean;
  lastContactUnix?: number;
  source: "opensky";
};



function normalizeTail(value?: string): string {
  return (value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeIcao24(value?: string): string {
  return (value || "").trim().toLowerCase();
}

function normalizeCallsign(value?: string): string {
  return (value || "").trim().toUpperCase().replace(/\s+/g, "");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getOpenSkyAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = requireEnv("OPENSKY_CLIENT_ID");
  const clientSecret = requireEnv("OPENSKY_CLIENT_SECRET");
  
  const tokenRes = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    }
  );

  if (!tokenRes.ok) {
    throw new Error(`OpenSky token request failed (${tokenRes.status})`);
  }

  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token as string | undefined;
  const expiresIn = Number(tokenJson.expires_in || 1800);

  if (!accessToken) {
    throw new Error("OpenSky token response missing access_token");
  }

  cachedToken = {
    value: accessToken,
    expiresAt: now + Math.max(60, expiresIn - 30) * 1000,
  };

  return accessToken;
}

function mapStateRow(
  row: any[],
  tailNumber?: string
  
): OpenSkyContext {
    
  return {
    tailNumber,
    icao24: typeof row?.[0] === "string" ? row[0] : undefined,
    callsign: String(row?.[1] || "").trim() || undefined,
    longitude: typeof row?.[5] === "number" ? row[5] : undefined,
    latitude: typeof row?.[6] === "number" ? row[6] : undefined,
    baroAltitude: typeof row?.[7] === "number" ? row[7] : undefined,
    onGround: typeof row?.[8] === "boolean" ? row[8] : undefined,
    velocity: typeof row?.[9] === "number" ? row[9] : undefined,
    lastContactUnix: typeof row?.[4] === "number" ? row[4] : undefined,
    source: "opensky",
    
  };
  
}



export async function fetchOpenSkyByTail(
  tailNumber: string,
  icao24?: string
): Promise<OpenSkyContext | null> {
  const normalizedTail = normalizeTail(tailNumber);
  const normalizedIcao24 = normalizeIcao24(icao24);
   console.log("OPENSKY LOOKUP", {
        tailNumber,
        icao24,
        });

        if (normalizedIcao24 && !/^[0-9a-f]{6}$/.test(normalizedIcao24)) {
            console.warn("Invalid ICAO24 for OpenSky lookup", {
                tailNumber,
                icao24,
            });
            return null;
            }
  if (!normalizedTail && !normalizedIcao24) return null;

  try {
    const accessToken = await getOpenSkyAccessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      // Best path: direct filter by ICAO24
      if (normalizedIcao24) {
        const url = new URL("https://opensky-network.org/api/states/all");
        url.searchParams.set("icao24", normalizedIcao24);

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`OpenSky states request failed (${res.status})`);
        }

        const json = await res.json();
        const states = Array.isArray(json?.states) ? json.states : [];
        if (!states.length) return null;

        const exact = states.find(
          (row: any[]) => normalizeIcao24(String(row?.[0] || "")) === normalizedIcao24
        );

        return exact ? mapStateRow(exact, tailNumber) : null;
      }

      // Fallback path: broad scan by callsign only when ICAO24 unavailable
      const res = await fetch("https://opensky-network.org/api/states/all", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenSky states request failed (${res.status})`);
      }

      const json = await res.json();
      const states = Array.isArray(json?.states) ? json.states : [];
      if (!states.length) return null;

      const match = states.find((row: any[]) => {
        const callsign = normalizeCallsign(String(row?.[1] || ""));
        return (
          callsign === normalizedTail ||
          callsign.endsWith(normalizedTail) ||
          callsign.includes(normalizedTail)
        );
      });

      return match ? mapStateRow(match, tailNumber) : null;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.warn("OpenSky lookup failed", error);
    return null;
  }
}