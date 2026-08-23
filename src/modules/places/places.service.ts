import { env } from '../../common/config/env.js';
import { AppError } from '../../common/middleware/error-handler.js';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';

function requireKey(): string {
  const key = env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) throw new AppError('Maps is not configured on the server', 503);
  return key;
}

// ─── Autocomplete ──────────────────────────────────────────────────────────────

interface GooglePrediction {
  placePrediction?: {
    placeId: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

// How far around the user we ask Google to prefer results. It is a bias, not a
// filter — places outside the circle still come back, just ranked lower.
const BIAS_RADIUS_METRES = 50_000;

export const autocompleteService = async (
  input: string,
  sessionToken?: string,
  origin?: { lat: number; lng: number },
) => {
  const key = requireKey();

  const body: Record<string, unknown> = { input };
  if (sessionToken) body['sessionToken'] = sessionToken;
  if (origin) {
    body['locationBias'] = {
      circle: {
        center: { latitude: origin.lat, longitude: origin.lng },
        radius: BIAS_RADIUS_METRES,
      },
    };
  }

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError(`Places autocomplete failed: ${detail.slice(0, 200)}`, 502);
  }

  const json = (await res.json()) as { suggestions?: GooglePrediction[] };
  return (json.suggestions ?? [])
    .filter((s) => s.placePrediction?.placeId)
    .map((s) => {
      const p = s.placePrediction!;
      return {
        placeId: p.placeId,
        description: p.text?.text ?? '',
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
      };
    });
};

// ─── Place details ─────────────────────────────────────────────────────────────

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GoogleDetails {
  addressComponents?: GoogleAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
}

// Shared by place details and reverse geocode — both end up with the same
// component list, only the field names Google uses for it differ.
const toAddress = (
  components: GoogleAddressComponent[],
  formattedAddress: string,
  latitude: number | null,
  longitude: number | null,
) => {
  const get = (type: string) => components.find((c) => c.types?.includes(type))?.longText;

  const addressLine1 = [get('street_number'), get('route')].filter(Boolean).join(' ');

  return {
    addressLine1: addressLine1 || formattedAddress.split(',')[0] || '',
    city:
      get('locality') ||
      get('postal_town') ||
      get('sublocality') ||
      get('administrative_area_level_2') ||
      '',
    state: get('administrative_area_level_1') || '',
    country: get('country') || '',
    postalCode: get('postal_code') || '',
    latitude,
    longitude,
    formattedAddress,
  };
};

export const placeDetailsService = async (placeId: string, sessionToken?: string) => {
  const key = requireKey();

  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

  const res = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'addressComponents,location,formattedAddress',
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError(`Place details failed: ${detail.slice(0, 200)}`, 502);
  }

  const json = (await res.json()) as GoogleDetails;

  return toAddress(
    json.addressComponents ?? [],
    json.formattedAddress ?? '',
    json.location?.latitude ?? null,
    json.location?.longitude ?? null,
  );
};

// ─── Reverse geocode ───────────────────────────────────────────────────────────

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface LegacyGeocodeResult {
  address_components?: { long_name?: string; types?: string[] }[];
  formatted_address?: string;
}

// Dropping the pin on the map has no place ID, so this goes through the
// Geocoding API instead of Places. Same output shape as placeDetailsService.
export const reverseGeocodeService = async (lat: number, lng: number) => {
  const key = requireKey();

  const url = new URL(GEOCODE_URL);
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', key);

  const res = await fetch(url.toString());

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AppError(`Reverse geocode failed: ${detail.slice(0, 200)}`, 502);
  }

  const json = (await res.json()) as { status?: string; results?: LegacyGeocodeResult[] };

  // ZERO_RESULTS is normal out at sea or in unmapped areas — the pin still stands.
  if (json.status !== 'OK' || !json.results?.length) {
    return toAddress([], '', lat, lng);
  }

  const first = json.results[0]!;
  const components = (first.address_components ?? []).map((c) => ({
    longText: c.long_name,
    types: c.types,
  }));

  return toAddress(components, first.formatted_address ?? '', lat, lng);
};
