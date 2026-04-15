function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export type SerpApiLocalResult = {
  title?: string;
  address?: string;
  phone?: string;
  type?: string;
  rating?: number;
  reviews?: number;
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  place_id?: string;
};

export type SerpApiContext = {
  query: string;
  result: SerpApiLocalResult | null;
  source: "serpapi";
};

export async function fetchSerpApiBusiness(
  query: string
): Promise<SerpApiContext | null> {
  const apiKey = requireEnv("SERPAPI_API_KEY");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_local");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`SerpApi request failed (${res.status})`);
  }

  const json = await res.json();
  const first = json?.local_results?.[0];

  if (!first) {
    return {
      query,
      result: null,
      source: "serpapi",
    };
  }

  return {
    query,
    result: {
      title: first.title,
      address: first.address,
      phone: first.phone,
      type: first.type,
      rating: first.rating,
      reviews: first.reviews,
      gps_coordinates: first.gps_coordinates,
      place_id: first.place_id,
    },
    source: "serpapi",
  };
}