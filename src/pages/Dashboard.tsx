import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Footprints, Hourglass, Route, Smartphone, UserCheck, Users, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { alertIcon, relativeTime } from '../alertMeta';
import { api, type Dashboard as DashboardData } from '../api';
import { HourlyChart } from '../components/Charts';
import { formatDistance, formatDuration } from '../format';
import { useLive } from '../live';
import { Avatar, EmptyState, PageHeader, Skeleton, StatTile } from '../ui';

export default function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/dashboard'), refetchInterval: 30_000 });
  useLive((m) => (m.type === 'alert' || m.type === 'alerts-cleared') && qc.invalidateQueries({ queryKey: ['dashboard'] }));

  if (error) return <div className="page"><div className="error">{(error as Error).message}</div></div>;

  const d = data;
  const maxDistance = Math.max(1, ...(d?.top_distance ?? []).map((w) => w.distance_m));

  return (
    <div className="page">
      <PageHeader title="Overview" subtitle="What your team did in the last 24 hours" />

      {d && d.pending_devices > 0 && (
        <Link to="/devices" className="banner amber">
          <Smartphone size={18} />
          <span>
            <strong>{d.pending_devices}</strong> new phone{d.pending_devices === 1 ? ' is' : 's are'} waiting for your approval
          </span>
          <span className="grow" />
          <span className="link">Review</span>
        </Link>
      )}

      <section className="tiles">
        {isLoading || !d ? (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="stat-tile"><Skeleton height={48} /></div>)
        ) : (
          <>
            <StatTile icon={Users} tone="green" label="Online now" value={`${d.workers.online} / ${d.workers.total}`} hint={d.workers.offline > 0 ? `${d.workers.offline} offline` : 'Everyone is reporting'} />
            <StatTile icon={Route} tone="blue" label="Distance covered" value={formatDistance(d.last24h.distance_m)} hint={`${d.last24h.active_workers} active worker${d.last24h.active_workers === 1 ? '' : 's'}`} />
            <StatTile icon={Footprints} tone="violet" label="Stops" value={d.last24h.stops} hint="5+ minutes at one place" />
            <StatTile icon={Hourglass} tone="amber" label="Time standing" value={formatDuration(d.last24h.stay_seconds)} hint="Total across all workers" />
          </>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Workers reporting by hour</h2>
            <span className="muted small">Last 24 hours</span>
          </div>
          {d ? d.hourly.length > 0 ? <HourlyChart data={d.hourly} /> : <EmptyState icon={WifiOff} title="No location data yet" text="Data appears here once an approved phone starts sending locations." /> : <Skeleton height={180} />}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Most distance</h2>
            <span className="muted small">Last 24 hours</span>
          </div>
          {!d ? (
            <Skeleton height={180} />
          ) : d.top_distance.length === 0 ? (
            <EmptyState icon={Route} title="No movement recorded" />
          ) : (
            <ul className="rank">
              {d.top_distance.map((w) => (
                <li key={w.worker_id}>
                  <Avatar name={w.name} size={32} />
                  <div className="grow">
                    <div className="row-between">
                      <Link to={`/workers/${w.worker_id}`}>{w.name}</Link>
                      <strong>{formatDistance(w.distance_m)}</strong>
                    </div>
                    <div className="meter">
                      <i style={{ width: `${(w.distance_m / maxDistance) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>
            Recent alerts {d && d.unread_alerts > 0 && <span className="count">{d.unread_alerts} new</span>}
          </h2>
          <Link to="/alerts" className="link">
            View all
          </Link>
        </div>
        {!d ? (
          <Skeleton height={120} />
        ) : d.recent_alerts.length === 0 ? (
          <EmptyState icon={CircleCheck} title="All quiet" text="You'll see offline workers, low batteries and site arrivals here." />
        ) : (
          <ul className="alert-list">
            {d.recent_alerts.map((a) => {
              const Icon = alertIcon(a.type);
              return (
                <li key={a.id} className={a.read_at ? '' : 'unread'}>
                  <span className={`alert-icon ${a.severity}`}>
                    <Icon size={16} />
                  </span>
                  <div className="grow">{a.message}</div>
                  <span className="muted small">{relativeTime(a.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {d && d.workers.total === 0 && (
        <EmptyState icon={UserCheck} title="Add your first worker" text="Install the app on a worker's phone, then approve it on the Devices page." action={<Link to="/devices"><button className="primary">Go to Devices</button></Link>} />
      )}
    </div>
  );
}
