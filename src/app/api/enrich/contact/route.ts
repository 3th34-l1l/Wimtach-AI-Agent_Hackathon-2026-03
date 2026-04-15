import { fetchOpenSkyByTail } from "@/lib/enrichment/opensky";
import { fetchSerpApiBusiness } from "@/lib/enrichment/serpapi";
import { fetchGooglePlacesBusiness } from "@/lib/enrichment/googlePlaces";

function uniqueNonEmpty(values: Array<string | undefined | null>) {
  return [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))];
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const tailNumber = body?.tailNumber as string | undefined;
    const ownerName = body?.ownerName as string | undefined;
    const icao24 = body?.icao24 as string | undefined;
    const city = body?.city as string | undefined;
    const province = body?.province as string | undefined;
    const country = body?.country as string | undefined;
    const queryParts = {
      ownerOnly: uniqueNonEmpty([ownerName]),
      ownerWithLocation: uniqueNonEmpty([ownerName, city, province, country]),
      aviationBusiness: uniqueNonEmpty([ownerName, city, province, country, "aviation"]),
      airportBusiness: uniqueNonEmpty([ownerName, city, province, country, "airport"]),
    };

    const serpQuery = queryParts.aviationBusiness.join(" ");
    const googleQueryPrimary = queryParts.ownerWithLocation.join(" ");
    const googleQuerySecondary = queryParts.airportBusiness.join(" ");

    const openskyPromise = tailNumber
      ? fetchOpenSkyByTail(tailNumber || "", icao24).catch((err) => {
          console.warn("OpenSky enrichment failed", err);
          return null;
        })
      : Promise.resolve(null);

    const serpapiPromise = ownerName
      ? fetchSerpApiBusiness(serpQuery).catch((err) => {
          console.warn("SerpAPI enrichment failed", err);
          return null;
        })
      : Promise.resolve(null);

    const googlePrimaryPromise = ownerName
      ? fetchGooglePlacesBusiness(googleQueryPrimary).catch((err) => {
          console.warn("Google Places primary enrichment failed", err);
          return null;
        })
      : Promise.resolve(null);

    const [opensky, serpapi, googlePlacesPrimary] = await Promise.all([
      openskyPromise,
      serpapiPromise,
      googlePrimaryPromise,
    ]);

    const googlePlaces =
      googlePlacesPrimary ||
      (ownerName
        ? await fetchGooglePlacesBusiness(googleQuerySecondary).catch((err) => {
            console.warn("Google Places secondary enrichment failed", err);
            return null;
          })
        : null);

    const normalizedBusiness = {
      displayName: firstString(
        (googlePlaces as any)?.displayName,
        (serpapi as any)?.title,
        ownerName
      ),
      phone: firstString(
        (googlePlaces as any)?.nationalPhoneNumber,
        (googlePlaces as any)?.internationalPhoneNumber,
        (serpapi as any)?.phone
      ),
      website: firstString(
        (googlePlaces as any)?.websiteUri,
        (serpapi as any)?.website
      ),
      address: firstString(
        (googlePlaces as any)?.formattedAddress,
        (serpapi as any)?.address,
        [city, province, country].filter(Boolean).join(", ")
      ),
      source:
        googlePlaces
          ? "google_places"
          : serpapi
          ? "serpapi"
          : "registry_fallback",
    };

    console.log("ENRICH REQUEST BODY", {
        tailNumber,
        icao24,
        ownerName,
        });

    return Response.json({
      ok: true,
      enrichment: {
        opensky,
        serpapi,
        googlePlaces,
        business: normalizedBusiness,
        queries: {
          serpapi: serpQuery || null,
          googlePrimary: googleQueryPrimary || null,
          googleSecondary: googleQuerySecondary || null,
          
        },
      },
    });

    
    
  } catch (err) {
    console.error("Enrichment failed", err);
    
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Enrichment failed",
        
      },
      { status: 500 }
    );
  }
}