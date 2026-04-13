// /lib/intelligence/opensky.ts

export async function fetchOpenSkyByIcao24(icao24: string) {
  const res = await fetch(
    `https://opensky-network.org/api/states/all?icao24=${icao24}`,
    {
      headers: {
        Authorization: `Basic ${btoa(process.env.OPENSKY_USER + ":" + process.env.OPENSKY_PASS)}`
      }
    }
  );

  const data = await res.json();

  if (!data?.states?.length) return null;

  const s = data.states[0];

  return {
    icao24: s[0],
    callsign: s[1]?.trim(),
    country: s[2],
    lastSeen: s[4],
    lon: s[5],
    lat: s[6],
    altitude: s[7],
    onGround: s[8],
    velocity: s[9],
    heading: s[10],
  };
}