import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Footprints, Hourglass, MapPinOff, Pause, Play, Route, Satellite } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Marker, Polyline, Popup } from 'react-leaflet';
import { Link, useParams } from 'react-router-dom';
import { api, downloadFile, type Stay, type Timeline, type TrackResponse, type Worker } from '../api';
import { BaseMap, MapFocus, stopIcon } from '../components/BaseMap';
import { TimelineBar } from '../components/Charts';
import { defaultRange, RangePicker, rangeQuery, type RangeValue } from '../components/RangePicker';
import { useErrorToast, useNow } from '../feedback';
import { formatDateTime, formatDistance, formatDuration, kmh, timeAgo } from '../format';
import { Battery, EmptyState, PageHeader, Skeleton, StatTile, StatusPill } from '../ui';

export default function WorkerDetail() {
  const { id } = useParams();
  const now = useNow();
  const onError = useErrorToast();
  const [range, setRange] = useState<RangeValue>(defaultRange());
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [focusStay, setFocusStay] = useState<Stay | null>(null);
  const query = rangeQuery(range);

  const worker = useQuery({ queryKey: ['workers'], queryFn: () => api<Worker[]>('/workers') }).data?.find((w) => String(w.id) === id);
  const track = useQuery({ queryKey: ['track', id, query], queryFn: () => api<TrackResponse>(`/workers/${id}/track?${query}`), enabled: query != null });
  const stays = useQuery({ queryKey: ['stays', id, query], queryFn: () => api<Stay[]>(`/workers/${id}/stays?${query}`), enabled: query != null });
  const timeline = useQuery({ queryKey: ['timeline', id, query], queryFn: () => api<Timeline>(`/workers/${id}/timeline?${query}`), enabled: query != null });

  const points = useMemo(() => track.data?.points ?? [], [track.data]);
  const path = useMemo(() => points.map((p) => [p.lat, p.lng] as [number, number]), [points]);
  const stayList = stays.data ?? [];
  const stats = track.data?.stats;
  const current = cursor != null && points.length > 0 ? points[Math.min(cursor, points.length - 1)] : null;

  // route replay: advance the slider a few points per tick, scaled so any range takes about 20 seconds
  useEffect(() => {
    if (!playing || points.length < 2) return;
    const step = Math.max(1, Math.round(points.length / 200));
    const t = setInterval(() => {
      setCursor((c) => {
        const next = (c ?? 0) + step;
        if (next >= points.length - 1) {
          setPlaying(false);
          return points.length - 1;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(t);
  }, [playing, points.length]);

  useEffect(() => {
    const err = track.error ?? stays.error ?? timeline.error;
    if (err) onError(err);
  }, [track.error, stays.error, timeline.error, onError]);

  const changeRange = (v: RangeValue) => {
    setRange(v);
    setCursor(null);
    setPlaying(false);
    setFocusStay(null);
  };

  return (
    <div className="page wide">
      <Link to="/workers" className="back-link">
        <ArrowLeft size={16} /> Workers
      </Link>
      <PageHeader
        title={worker?.name ?? 'Worker'}
        subtitle={
          worker && (
            <span className="inline-meta">
              {worker.active ? worker.online ? <StatusPill tone="green">Online</StatusPill> : <StatusPill tone="red">Offline · seen {timeAgo(worker.last_seen, now)}</StatusPill> : <StatusPill tone="gray">Inactive</StatusPill>}
              <Battery level={worker.battery} />
              {worker.phone && <span>{worker.phone}</span>}
            </span>
          )
        }
        actions={
          <>
            <RangePicker value={range} onChange={changeRange} />
            <button disabled={query == null} onClick={() => downloadFile(`/reports/stays.csv?${query}&worker_id=${id}`, `stops-${worker?.name ?? id}.csv`)}>
              <Download size={16} /> Export stops
            </button>
          </>
        }
      />

      <section className="tiles">
        {!stats ? (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="stat-tile"><Skeleton height={48} /></div>)
        ) : (
          <>
            <StatTile icon={Route} tone="blue" label="Distance" value={formatDistance(stats.distance_m)} />
            <StatTile icon={Footprints} tone="violet" label="Stops" value={stats.stays} />
            <StatTile icon={Hourglass} tone="amber" label="Time standing" value={formatDuration(stats.stay_seconds)} />
            <StatTile icon={Satellite} tone="green" label="GPS points" value={stats.points.toLocaleString()} />
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Activity timeline</h2>
        </div>
        {timeline.data ? <TimelineBar timeline={timeline.data} /> : <Skeleton height={48} />}
      </section>

      <div className="detail-grid">
        <section className="card map-card">
          <div className="map-box">
            <BaseMap>
              <MapFocus point={focusStay ? [focusStay.lat, focusStay.lng] : null} bounds={focusStay ? null : path.length > 0 ? path : null} zoom={17} />
              {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }} />}
              {path.length > 0 && (
                <CircleMarker center={path[0]!} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#16a34a', fillOpacity: 1 }}>
                  <Popup>Start · {formatDateTime(points[0]!.recorded_at)}</Popup>
                </CircleMarker>
              )}
              {path.length > 1 && (
                <CircleMarker center={path[path.length - 1]!} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }}>
                  <Popup>Last point · {formatDateTime(points[points.length - 1]!.recorded_at)}</Popup>
                </CircleMarker>
              )}
              {stayList.map((s, i) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(i + 1, s.ongoing)}>
                  <Popup>
                    <strong>
                      Stop {i + 1} · {formatDuration(s.duration_s)}
                    </strong>
                    <br />
                    {formatDateTime(s.start_at)} → {s.ongoing ? 'now' : formatDateTime(s.end_at)}
                    {s.address && (
                      <>
                        <br />
                        {s.address}
                      </>
                    )}
                  </Popup>
                </Marker>
              ))}
              {current && <CircleMarker center={[current.lat, current.lng]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#f59e0b', fillOpacity: 1 }} />}
            </BaseMap>
          </div>
          {points.length > 1 && (
            <div className="replay">
              <button className="icon-btn solid" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => (setCursor((c) => (c == null || c >= points.length - 1 ? 0 : c)), setPlaying((p) => !p))}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input type="range" min={0} max={points.length - 1} value={cursor ?? 0} onChange={(e) => (setPlaying(false), setCursor(Number(e.target.value)))} aria-label="Route replay position" />
              <span className="small muted replay-info">{current ? `${formatDateTime(current.recorded_at)} · ${kmh(current.speed)}${current.battery != null ? ` · ${current.battery}%` : ''}` : 'Replay the route'}</span>
            </div>
          )}
        </section>

        <section className="card stops-card">
          <div className="card-head">
            <h2>Stops ({stayList.length})</h2>
          </div>
          {query == null && <p className="muted">Pick a valid date range.</p>}
          {stays.data && stayList.length === 0 && <EmptyState icon={MapPinOff} title="No stops" text="No 5+ minute stops in this period." />}
          <ul className="stop-list">
            {stayList.map((s, i) => (
              <li key={s.id} onClick={() => setFocusStay(s)}>
                <span className={`stop-num${s.ongoing ? ' ongoing' : ''}`}>{i + 1}</span>
                <div className="grow">
                  <div className="row-between">
                    <strong>{formatDuration(s.duration_s)}</strong>
                    {s.ongoing && <StatusPill tone="amber">Here now</StatusPill>}
                  </div>
                  <div className="muted small">
                    {formatDateTime(s.start_at)} → {s.ongoing ? 'now' : formatDateTime(s.end_at)}
                  </div>
                  {s.address && <div className="small address">{s.address}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
