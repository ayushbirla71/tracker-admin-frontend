import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogIn, LogOut, MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Circle, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import { api, del, post, type Geofence, type GeofenceEvent } from '../api';
import { BaseMap, MapFocus } from '../components/BaseMap';
import { useConfirm, useErrorToast, useToast } from '../feedback';
import { formatDateTime } from '../format';
import { EmptyState } from '../ui';

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function Geofences() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const onError = useErrorToast();
  const fences = useQuery({ queryKey: ['geofences'], queryFn: () => api<Geofence[]>('/geofences') });
  const events = useQuery({ queryKey: ['geofence-events'], queryFn: () => api<GeofenceEvent[]>('/geofence-events?range=48h'), refetchInterval: 30_000 });

  const [name, setName] = useState('');
  const [radius, setRadius] = useState(150);
  const [spot, setSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [focus, setFocus] = useState<Geofence | null>(null);

  const create = useMutation({
    mutationFn: () => post('/geofences', { name: name.trim(), lat: spot!.lat, lng: spot!.lng, radius_m: radius }),
    onSuccess: () => {
      toast('success', 'Geofence saved', name.trim());
      setName('');
      setSpot(null);
      qc.invalidateQueries({ queryKey: ['geofences'] });
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => del(`/geofences/${id}`),
    onSuccess: () => {
      toast('success', 'Geofence deleted');
      qc.invalidateQueries({ queryKey: ['geofences'] });
      qc.invalidateQueries({ queryKey: ['geofence-events'] });
    },
    onError,
  });

  const list = fences.data ?? [];
  const bounds = list.length > 0 && !focus ? (list.map((g) => [g.lat, g.lng]) as [number, number][]) : null;

  const askDelete = async (g: Geofence) => {
    if (await confirm({ title: `Delete "${g.name}"?`, message: 'Its enter / exit history is deleted too.', confirmLabel: 'Delete', danger: true })) remove.mutate(g.id);
  };

  return (
    <div className="split">
      <aside className="side wide">
        <div className="side-section">
          <h2>New site</h2>
          <p className="muted small">Click the map to place the centre of a client site, depot or any area you want arrival and departure alerts for.</p>
          <div className="form-stack">
            <label>
              Name
              <input placeholder="e.g. Main depot" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Radius <strong>{radius} m</strong>
              <input type="range" min={30} max={2000} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </label>
            <button className="primary" disabled={!spot || !name.trim() || create.isPending} onClick={() => create.mutate()}>
              <MapPin size={16} /> {spot ? 'Save geofence' : 'Click the map to pick a spot'}
            </button>
          </div>
        </div>

        <div className="side-section">
          <h2>Sites ({list.length})</h2>
          {list.length === 0 && <p className="muted small">No sites yet.</p>}
          <ul className="plain-list">
            {list.map((g) => (
              <li key={g.id} onClick={() => setFocus(g)}>
                <span className="stat-icon violet small">
                  <MapPin size={16} />
                </span>
                <div className="grow">
                  <strong>{g.name}</strong>
                  <div className="muted small">{g.radius_m} m radius</div>
                </div>
                <button
                  className="icon-btn"
                  aria-label={`Delete ${g.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    askDelete(g);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="side-section">
          <h2>Arrivals and departures · 48h</h2>
          {events.data?.length === 0 && <EmptyState icon={LogIn} title="Nothing yet" />}
          <ul className="plain-list">
            {(events.data ?? []).map((e) => (
              <li key={e.id}>
                <span className={`alert-icon ${e.type === 'enter' ? 'info' : 'warning'}`}>{e.type === 'enter' ? <LogIn size={16} /> : <LogOut size={16} />}</span>
                <div className="grow">
                  <strong>{e.worker_name}</strong> {e.type === 'enter' ? 'arrived at' : 'left'} {e.geofence_name}
                  <div className="muted small">{formatDateTime(e.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="map-wrap">
        <BaseMap>
          <ClickToPlace onPick={(lat, lng) => setSpot({ lat, lng })} />
          <MapFocus point={focus ? [focus.lat, focus.lng] : null} bounds={bounds} zoom={15} />
          {list.map((g) => (
            <Circle key={g.id} center={[g.lat, g.lng]} radius={g.radius_m} pathOptions={{ color: '#7c3aed', fillOpacity: 0.15 }}>
              <Tooltip permanent direction="center">
                {g.name}
              </Tooltip>
            </Circle>
          ))}
          {spot && (
            <>
              <Circle center={[spot.lat, spot.lng]} radius={radius} pathOptions={{ color: '#f59e0b', dashArray: '6', fillOpacity: 0.1 }} />
              <CircleMarker center={[spot.lat, spot.lng]} radius={5} pathOptions={{ color: '#f59e0b' }} />
            </>
          )}
        </BaseMap>
      </section>
    </div>
  );
}
