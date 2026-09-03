/**
 * Location Map View Component
 * Displays an interactive Google Map with the user's accurate location
 */

import React from "react";

interface LocationMapViewProps {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

export default function LocationMapView({
  latitude,
  longitude,
  city,
  country,
}: LocationMapViewProps) {
  const formatCoordinates = (lat: number, lng: number): string => {
    const latDir = lat >= 0 ? "N" : "S";
    const lngDir = lng >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(6)}°${latDir}, ${Math.abs(lng).toFixed(6)}°${lngDir}`;
  };

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  // Google Maps embed with high zoom for accuracy (zoom=15 is street level)
  const googleMapsEmbedUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&output=embed`;

  const coordinates = formatCoordinates(latitude, longitude);
  const locationName =
    city && country
      ? `${city}, ${country}`
      : city || country || "Unknown Location";

  return (
    <div className="bg-sky-50 rounded-lg p-5">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">🗺️</span>
        Google Maps - Accurate Location
      </h3>

      {/* Map Container */}
      <div className="relative w-full h-96 bg-white rounded-lg overflow-hidden border border-sky-200 mb-4">
        <iframe
          src={googleMapsEmbedUrl}
          className="w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          title={`Google Map showing location: ${locationName}`}
        />

        {/* Overlay buttons */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 backdrop-blur-sm"
          >
            <span>📍</span>
            Open in Google Maps
          </a>
        </div>
      </div>

      {/* Coordinates Display */}
      <div className="bg-white rounded-lg p-4 border border-sky-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-slate-500 text-xs uppercase mb-1">
              📍 Coordinates
            </div>
            <div className="text-slate-900 font-mono text-sm">
              {coordinates}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs uppercase mb-1">
              🌍 Location
            </div>
            <div className="text-slate-900 text-sm font-medium">
              {locationName}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs uppercase mb-1">
              🎯 Precision
            </div>
            <div className="text-slate-900 text-sm">
              <span className="inline-block px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs font-semibold">
                Street Level (Zoom 15)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
