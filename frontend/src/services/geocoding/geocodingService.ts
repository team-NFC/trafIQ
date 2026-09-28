export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  formattedAddress: string;
  isCurrentLocation?: boolean;
}

export class GeocodingService {
  // Parse raw coordinate strings (e.g. "10.7905, 78.7047" or "10.7905 N 78.7047 E")
  public static parseCoordinates(query: string): { lat: number; lon: number } | null {
    const trimmed = query.trim();
    const coordMatch = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+)[\s,]+([-+]?[0-9]*\.?[0-9]+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }
    return null;
  }

  // Forward search (Photon OSM engine + coordinate parser)
  public static async search(query: string): Promise<GeocodingResult[]> {
    if (!query || query.trim().length < 2) return [];

    const trimmed = query.trim();

    // 1. Direct coordinates
    const coord = this.parseCoordinates(trimmed);
    if (coord) {
      return [
        {
          name: `${coord.lat.toFixed(5)}°, ${coord.lon.toFixed(5)}°`,
          latitude: coord.lat,
          longitude: coord.lon,
          formattedAddress: `GPS Coordinates: ${coord.lat.toFixed(5)}° N, ${coord.lon.toFixed(5)}° E`
        }
      ];
    }

    // 2. Photon (OpenStreetMap) Geocoding API (free, open, CORS-friendly)
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          return data.features.map((f: any) => {
            const props = f.properties || {};
            const coords = f.geometry?.coordinates || [0, 0];
            const name = props.name || props.city || props.street || trimmed;
            const parts = [
              props.name,
              props.street,
              props.city,
              props.state,
              props.country
            ].filter(Boolean);
            const formatted = parts.length > 0 ? parts.join(', ') : name;

            return {
              name: name,
              latitude: coords[1],
              longitude: coords[0],
              country: props.country,
              formattedAddress: formatted
            };
          });
        }
      }
    } catch (e) {
      console.warn('Photon geocoding error:', e);
    }

    return [];
  }

  // Reverse geocode via BigDataCloud client-side reverse API (free, no token needed)
  public static async reverseGeocode(lat: number, lon: number): Promise<GeocodingResult> {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const parts = [
          data.locality || data.city,
          data.principalSubdivision,
          data.countryName
        ].filter(Boolean);
        const name = data.locality || data.city || data.principalSubdivision || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        return {
          name,
          latitude: lat,
          longitude: lon,
          country: data.countryName,
          formattedAddress: parts.join(', ') || `Coordinates: ${lat.toFixed(5)}°, ${lon.toFixed(5)}°`
        };
      }
    } catch (e) {
      console.warn('Reverse geocoding error:', e);
    }

    return {
      name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`,
      latitude: lat,
      longitude: lon,
      formattedAddress: `Coordinates: ${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E`
    };
  }

  // Get User's browser GPS coordinates
  public static getCurrentLocation(): Promise<{ lat: number; lon: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }
}
