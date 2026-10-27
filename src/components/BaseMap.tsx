import L from 'leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { useEffect, type ReactNode } from 'react';
import { LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { colorFor, initials } from '../ui';

// Pune, only used until real data arrives
const DEFAULT_CENTER: LatLngExpression = [18.5204, 73.8567];

export function BaseMap({ children }: { children?: ReactNode }) {
  return (
    <MapContainer center={DEFAULT_CENTER} zoom={12} className="map" scrollWheelZoom zoomControl>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Streets">
          <TileLayer className="tiles-streets" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>
      {children}
    </MapContainer>
  );
}

/** Moves the map to a point or fits it to bounds whenever the target changes. */
export function MapFocus({ point, bounds, zoom = 16 }: { point?: LatLngExpression | null; bounds?: LatLngBoundsExpression | null; zoom?: number }) {
  const map = useMap();
  const key = JSON.stringify([point, bounds]);
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
    else if (point) map.flyTo(point, Math.max(map.getZoom(), zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Round avatar-style marker with the worker's initials; pulses while the worker is online. */
export function workerIcon(name: string, online: boolean, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="wmarker ${online ? 'online' : 'offline'}${selected ? ' selected' : ''}" style="--c:${colorFor(name)}"><span>${initials(name).replace(/[<>&"]/g, '')}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    tooltipAnchor: [0, -22],
  });
}

export function stopIcon(n: number, ongoing: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="stop-pin${ongoing ? ' ongoing' : ''}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
