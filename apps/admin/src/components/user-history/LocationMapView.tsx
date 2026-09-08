/**
 * Location Map View Component
 * Displays an interactive Google Map with the user's accurate location
 */

import React from "react";
import { ExternalLink } from "lucide-react";
import { MetricRow, StatusPill } from "@/components/console";

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
      : city || country || "Unknown location";

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[0.9375rem] font-semibold text-foreground">
            Location on the map
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {locationName}
          </p>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ExternalLink className="size-4" strokeWidth={2} />
          Open in Google Maps
        </a>
      </header>

      <div className="h-72 w-full border-b border-border bg-muted sm:h-96">
        <iframe
          src={googleMapsEmbedUrl}
          className="h-full w-full"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          title={`Google map showing ${locationName}`}
        />
      </div>

      <div className="min-w-0 divide-y divide-border px-4 py-1">
        <MetricRow
          label="Coordinates"
          value={<span className="id-chip">{coordinates}</span>}
        />
        <MetricRow
          label="Place"
          value={
            <span className="block max-w-[18rem] truncate" title={locationName}>
              {locationName}
            </span>
          }
        />
        <MetricRow
          label="Precision"
          value={<StatusPill tone="info">Street level</StatusPill>}
        />
      </div>
    </section>
  );
}
