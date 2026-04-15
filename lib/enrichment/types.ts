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

export type EnrichedLeadContext = {
  opensky?: OpenSkyContext | null;
  googlePlaces?: GooglePlacesContext | null;
  confirmed?: {
    website?: string;
    phone?: string;
    businessType?: string;
    notes?: string[];
  };
};