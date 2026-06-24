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

export const autocompleteService = async (input: string, sessionToken?: string) => {
  const key = requireKey();

  const body: Record<string, unknown> = { input };
  if (sessionToken) body['sessionToken'] = sessionToken;

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
  const components = json.addressComponents ?? [];
  const get = (type: string) =>
    components.find((c) => c.types?.includes(type))?.longText;

  const addressLine1 = [get('street_number'), get('route')].filter(Boolean).join(' ');

  return {
    addressLine1: addressLine1 || json.formattedAddress?.split(',')[0] || '',
    city:
      get('locality') ||
      get('postal_town') ||
      get('sublocality') ||
      get('administrative_area_level_2') ||
      '',
    state: get('administrative_area_level_1') || '',
    country: get('country') || '',
    postalCode: get('postal_code') || '',
    latitude: json.location?.latitude ?? null,
    longitude: json.location?.longitude ?? null,
    formattedAddress: json.formattedAddress ?? '',
  };
};
