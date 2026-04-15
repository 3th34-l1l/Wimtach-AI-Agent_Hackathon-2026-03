function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export type GooglePlacesContext = {
  query: string;
  placeId?: string;
  displayName?: string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  source: "google_places";
};

export async function fetchGooglePlacesBusiness(
  query: string
): Promise<GooglePlacesContext | null> {
  const apiKey = requireEnv("GOOGLE_PLACES_API_KEY");

  const textSearchRes = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.types",
      },
      body: JSON.stringify({
        textQuery: query,
      }),
      cache: "no-store",
    }
  );

  if (!textSearchRes.ok) {
    throw new Error(`Google Places Text Search failed (${textSearchRes.status})`);
  }

  const textSearchJson = await textSearchRes.json();
  const place = textSearchJson?.places?.[0];
  if (!place?.id) return null;

  const detailsRes = await fetch(
    `https://places.googleapis.com/v1/places/${place.id}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,types",
      },
      cache: "no-store",
    }
  );

  if (!detailsRes.ok) {
    throw new Error(`Google Places Details failed (${detailsRes.status})`);
  }

  const details = await detailsRes.json();

  return {
    query,
    placeId: details.id,
    displayName: details.displayName?.text,
    formattedAddress: details.formattedAddress,
    nationalPhoneNumber: details.nationalPhoneNumber,
    websiteUri: details.websiteUri,
    rating: details.rating,
    userRatingCount: details.userRatingCount,
    types: details.types,
    source: "google_places",
  };
}