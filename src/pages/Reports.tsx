import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadFile, type Summary } from '../api';
import { defaultRange, RangePicker, rangeQuery, type RangeValue } from '../components/RangePicker';
import { useErrorToast } from '../feedback';
import { formatDateTime, formatDistance, formatDuration } from '../format';
import { Avatar, EmptyState, PageHeader, SkeletonRows } from '../ui';

export default function Reports() {
  const onError = useErrorToast();
  const [range, setRange] = useState<RangeValue>(defaultRange());
  const query = rangeQuery(range);
  const summary = useQuery({ queryKey: ['summary', query], queryFn: () => api<Summary>(`/reports/summary?${query}`), enabled: query != null });
  const [sort, setSort] = useState<'name' | 'distance_m' | 'stay_seconds' | 'stays'>('name');

  const rows = [...(summary.data?.workers ?? [])].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b[sort] - a[sort]));
  const totals = rows.reduce((t, w) => ({ distance: t.distance + w.distance_m, stops: t.stops + w.stays, standing: t.standing + w.stay_seconds }), { distance: 0, stops: 0, standing: 0 });

  const th = (key: typeof sort, label: string) => (
    <th>
      <button className={`th-sort${sort === key ? ' active' : ''}`} onClick={() => setSort(key)}>
        {label}
      </button>
    </th>
  );

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        subtitle="Distance, stops and standing time per worker"
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <button disabled={query == null} onClick={() => downloadFile(`/reports/summary.csv?${query}`, 'worker-summary.csv').catch(onError)}>
              <Download size={16} /> Export CSV
            </button>
          </>
        }
      />
      {summary.error && <div className="error">{(summary.error as Error).message}</div>}

      <div className="card table-card">
        {summary.isLoading ? (
          <div className="pad"><SkeletonRows rows={4} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={FileText} title="No data for this period" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {th('name', 'Worker')}
                  {th('distance_m', 'Distance')}
                  {th('stays', 'Stops')}
                  {th('stay_seconds', 'Time standing')}
                  <th>GPS points</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.worker_id}>
                    <td>
                      <Link to={`/workers/${w.worker_id}`} className="person">
                        <Avatar name={w.name} size={30} />
                        <strong>{w.name}</strong>
                      </Link>
                    </td>
                    <td>{formatDistance(w.distance_m)}</td>
                    <td>{w.stays}</td>
                    <td>{formatDuration(w.stay_seconds)}</td>
                    <td>{w.points.toLocaleString()}</td>
                    <td>{w.last_seen ? formatDateTime(w.last_seen) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{formatDistance(totals.distance)}</td>
                  <td>{totals.stops}</td>
                  <td>{formatDuration(totals.standing)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
