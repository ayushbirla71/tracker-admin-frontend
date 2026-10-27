import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPinOff, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { api, type LiveWorker } from '../api';
import { BaseMap, MapFocus, workerIcon } from '../components/BaseMap';
import { useNow } from '../feedback';
import { formatDuration, kmh, timeAgo } from '../format';
import { useLive } from '../live';
import { Avatar, Battery, EmptyState, SkeletonRows } from '../ui';

type Filter = 'all' | 'online' | 'offline';

export default function LiveMap() {
  const qc = useQueryClient();
  const now = useNow();
  const [selected, setSelected] = useState<number | null>(null);
  const [fitted, setFitted] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data: workers = [], isLoading, error } = useQuery({
    queryKey: ['live'],
    queryFn: () => api<LiveWorker[]>('/workers/live'),
    refetchInterval: 30_000, // also refreshes the online/offline flag and stationary_since
  });

  useLive((msg) => {
    if (msg.type !== 'location') return;
    qc.setQueryData<LiveWorker[]>(['live'], (old) =>
      old?.map((w) =>
        w.worker_id === msg.workerId
          ? { ...w, recorded_at: msg.recordedAt, lat: msg.lat, lng: msg.lng, accuracy: msg.accuracy, speed: msg.speed, heading: msg.heading, battery: msg.battery, online: true }
          : w,
      ),
    );
  });

  const visible = useMemo(
    () => workers.filter((w) => (filter === 'all' || (filter === 'online') === w.online) && w.name.toLowerCase().includes(search.trim().toLowerCase())),
    [workers, filter, search],
  );
  const located = visible.filter((w) => w.lat != null && w.lng != null);
  const picked = workers.find((w) => w.worker_id === selected && w.lat != null);

  const fitBounds = useMemo(() => (!fitted && located.length > 0 ? (located.map((w) => [w.lat!, w.lng!]) as [number, number][]) : null), [fitted, located]);
  useEffect(() => {
    if (fitBounds) setFitted(true);
  }, [fitBounds]);

  const onlineCount = workers.filter((w) => w.online).length;
  const counts: Record<Filter, number> = { all: workers.length, online: onlineCount, offline: workers.length - onlineCount };

  return (
    <div className="split">
      <aside className="side">
        <div className="side-top">
          <div className="search">
            <Search size={16} />
            <input placeholder="Search workers" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search workers" />
          </div>
          <div className="segmented">
            {(['all', 'online', 'offline'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {f[0]!.toUpperCase() + f.slice(1)} <span className="muted">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading && <div className="pad"><SkeletonRows rows={5} /></div>}
        {error && <p className="error pad">{(error as Error).message}</p>}
        {!isLoading && visible.length === 0 && (
          <EmptyState icon={MapPinOff} title={workers.length === 0 ? 'No workers yet' : 'No matches'} text={workers.length === 0 ? 'Approve a device on the Devices page to see it here.' : 'Try a different search or filter.'} />
        )}

        <ul className="worker-list">
          {visible.map((w) => {
            const standing = w.online && w.stationary_since ? formatDuration((now - new Date(w.stationary_since).getTime()) / 1000) : null;
            return (
              <li key={w.worker_id} className={selected === w.worker_id ? 'selected' : ''} onClick={() => setSelected(w.worker_id)}>
                <Avatar name={w.name} online={w.online} />
                <div className="grow">
                  <strong>{w.name}</strong>
                  <div className="muted small">
                    {!w.recorded_at && 'No location yet'}
                    {w.recorded_at && !w.online && `Last seen ${timeAgo(w.recorded_at, now)}`}
                    {w.online && standing && `Standing for ${standing}`}
                    {w.online && !standing && (w.speed != null && w.speed > 0.5 ? `Moving · ${kmh(w.speed)}` : 'Online')}
                  </div>
                </div>
                <div className="right small">
                  <Battery level={w.battery} />
                  <div>
                    <Link to={`/workers/${w.worker_id}`} onClick={(e) => e.stopPropagation()}>
                      History
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="map-wrap">
        <BaseMap>
          <MapFocus point={picked ? [picked.lat!, picked.lng!] : null} bounds={fitBounds} />
          {located.map((w) => (
            <Marker key={w.worker_id} position={[w.lat!, w.lng!]} icon={workerIcon(w.name, w.online, w.worker_id === selected)} eventHandlers={{ click: () => setSelected(w.worker_id) }} zIndexOffset={w.worker_id === selected ? 1000 : w.online ? 500 : 0}>
              <Tooltip direction="top">
                <strong>{w.name}</strong>
                <br />
                {w.recorded_at ? `Updated ${timeAgo(w.recorded_at, now)}` : ''}
              </Tooltip>
            </Marker>
          ))}
        </BaseMap>
      </section>
    </div>
  );
}
