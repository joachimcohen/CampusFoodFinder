"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { ListingWithRelations } from "@/lib/types";
import { instanceConfig } from "@/lib/config";
import { formatPrice } from "@/lib/listings";

// Leaflet's default marker images resolve relative to the bundler's asset
// pipeline, which breaks under Next.js's build. Pointing at the same
// version's CDN copies sidesteps that entirely rather than fighting webpack
// asset resolution for three small PNGs.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(points, { padding: [32, 32] });
  }, [map, points]);
  return null;
}

/** Map toggle view (Section 7.1) — same filtered results as the list, shown as pins. No API key needed: OpenStreetMap tiles + Leaflet. */
export default function MapView({ listings }: { listings: ListingWithRelations[] }) {
  const points = useMemo(
    () =>
      listings
        .filter((l): l is ListingWithRelations & { lat: number; lng: number } => l.lat !== null && l.lng !== null)
        .map((l) => [l.lat, l.lng] as [number, number]),
    [listings]
  );
  const center: [number, number] = points[0] ?? [
    instanceConfig.mapDefaultCenter.lat,
    instanceConfig.mapDefaultCenter.lng,
  ];

  return (
    <div className="map-container h-[60vh] overflow-hidden rounded-2xl border border-[var(--color-border)]">
      <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {listings.map(
          (l) =>
            l.lat !== null &&
            l.lng !== null && (
              <Marker key={l.id} position={[l.lat, l.lng]} icon={markerIcon}>
                <Popup>
                  <strong>{l.title}</strong>
                  <br />
                  {l.organisation.name} · {l.suburb.name}
                  <br />
                  {formatPrice(l.price)}
                </Popup>
              </Marker>
            )
        )}
      </MapContainer>
    </div>
  );
}
