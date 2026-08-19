import React, { useState, useMemo } from 'react';
import { Visitor, Contractor } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface TrafficAnalyticsChartProps {
  visitors: Visitor[];
  contractors: Contractor[];
  title?: string;
  subtitle?: string;
}

type TimeframeType = 'DAILY' | 'MONTHLY' | 'YEARLY';
type ChartStyleType = 'AREA' | 'BAR' | 'LINE';
type FilterType = 'ALL' | 'VISITORS' | 'CONTRACTORS';

interface AggregatedDataPoint {
  key: string;
  label: string;
  subLabel?: string;
  visitors: number;
  contractors: number;
  total: number;
}

export const TrafficAnalyticsChart: React.FC<TrafficAnalyticsChartProps> = ({
  visitors,
  contractors,
  title = 'Visitor & Contractor Traffic Analytics',
  subtitle = 'Visual analysis of facility entry trends across daily, monthly, and yearly intervals'
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeType>('DAILY');
  const [dailyRange, setDailyRange] = useState<number>(14); // 7, 14, 30 days
  const [chartStyle, setChartStyle] = useState<ChartStyleType>('AREA');
  const [filterType, setFilterType] = useState<FilterType>('ALL');

  // Helper function to safely extract date string (YYYY-MM-DD) from item
  const getVisitorDate = (v: Visitor): string => {
    if (v.scheduledDate) return v.scheduledDate.substring(0, 10);
    if (v.checkInTime) return v.checkInTime.substring(0, 10);
    if (v.createdAt) return v.createdAt.substring(0, 10);
    return new Date().toISOString().substring(0, 10);
  };

  const getContractorDate = (c: Contractor): string => {
    if (c.startDate) return c.startDate.substring(0, 10);
    if (c.checkInTime) return c.checkInTime.substring(0, 10);
    if (c.createdAt) return c.createdAt.substring(0, 10);
    return new Date().toISOString().substring(0, 10);
  };

  // Aggregation logic
  const chartData = useMemo<AggregatedDataPoint[]>(() => {
    const today = new Date();

    if (timeframe === 'DAILY') {
      const dataMap = new Map<string, { visitors: number; contractors: number; label: string }>();
      const daysCount = dailyRange;

      // Initialize all days in range to 0 for continuous curve
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toISOString().substring(0, 10);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dataMap.set(key, {
          visitors: 0,
          contractors: 0,
          label: `${monthDay} (${dayName})`
        });
      }

      // Populate visitors
      visitors.forEach((v) => {
        const dStr = getVisitorDate(v);
        if (dataMap.has(dStr)) {
          const item = dataMap.get(dStr)!;
          item.visitors += 1;
        }
      });

      // Populate contractors
      contractors.forEach((c) => {
        const dStr = getContractorDate(c);
        if (dataMap.has(dStr)) {
          const item = dataMap.get(dStr)!;
          item.contractors += 1;
        }
      });

      return Array.from(dataMap.entries()).map(([key, val]) => ({
        key,
        label: val.label,
        visitors: val.visitors,
        contractors: val.contractors,
        total: val.visitors + val.contractors
      }));
    }

    if (timeframe === 'MONTHLY') {
      const dataMap = new Map<string, { visitors: number; contractors: number; label: string; subLabel: string }>();
      
      // Start timeline specifically from Sept 2026 onwards
      const startYear = 2026;
      const startMonth = 9; // September (1-indexed)
      const monthsCount = 12; // 12 months rolling from Sept 2026 (Sept 2026 to Aug 2027)

      for (let i = 0; i < monthsCount; i++) {
        const d = new Date(startYear, startMonth - 1 + i, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const subLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        dataMap.set(key, { visitors: 0, contractors: 0, label, subLabel });
      }

      // Populate visitors
      visitors.forEach((v) => {
        const dStr = getVisitorDate(v);
        const key = dStr.substring(0, 7);
        if (dataMap.has(key)) {
          const item = dataMap.get(key)!;
          item.visitors += 1;
        }
      });

      // Populate contractors
      contractors.forEach((c) => {
        const dStr = getContractorDate(c);
        const key = dStr.substring(0, 7);
        if (dataMap.has(key)) {
          const item = dataMap.get(key)!;
          item.contractors += 1;
        }
      });

      return Array.from(dataMap.entries()).map(([key, val]) => ({
        key,
        label: val.label,
        subLabel: val.subLabel,
        visitors: val.visitors,
        contractors: val.contractors,
        total: val.visitors + val.contractors
      }));
    }

    // YEARLY: Starting specifically from 2026 onwards (2026 to 2030)
    const dataMap = new Map<string, { visitors: number; contractors: number; label: string }>();
    const startYear = 2026;
    const yearsForward = 5; // 2026, 2027, 2028, 2029, 2030

    for (let y = startYear; y < startYear + yearsForward; y++) {
      const key = String(y);
      dataMap.set(key, { visitors: 0, contractors: 0, label: key });
    }

    // Populate visitors
    visitors.forEach((v) => {
      const dStr = getVisitorDate(v);
      const year = dStr.substring(0, 4);
      if (dataMap.has(year)) {
        const item = dataMap.get(year)!;
        item.visitors += 1;
      }
    });

    // Populate contractors
    contractors.forEach((c) => {
      const dStr = getContractorDate(c);
      const year = dStr.substring(0, 4);
      if (dataMap.has(year)) {
        const item = dataMap.get(year)!;
        item.contractors += 1;
      }
    });

    return Array.from(dataMap.entries()).map(([key, val]) => ({
      key,
      label: val.label,
      visitors: val.visitors,
      contractors: val.contractors,
      total: val.visitors + val.contractors
    }));
  }, [visitors, contractors, timeframe, dailyRange]);

  // Statistics calculation for KPI summary bar
  const stats = useMemo(() => {
    const totalVisitors = chartData.reduce((sum, d) => sum + d.visitors, 0);
    const totalContractors = chartData.reduce((sum, d) => sum + d.contractors, 0);
    const grandTotal = totalVisitors + totalContractors;

    const dataCount = chartData.length || 1;
    const avgTotal = (grandTotal / dataCount).toFixed(1);
    const peakPoint = chartData.reduce((max, d) => (d.total > max.total ? d : max), {
      total: 0,
      label: 'None',
      visitors: 0,
      contractors: 0
    } as AggregatedDataPoint);

    const visitorPercent = grandTotal > 0 ? Math.round((totalVisitors / grandTotal) * 100) : 0;
    const contractorPercent = grandTotal > 0 ? Math.round((totalContractors / grandTotal) * 100) : 0;

    return {
      totalVisitors,
      totalContractors,
      grandTotal,
      avgTotal,
      peakLabel: peakPoint.label,
      peakTotal: peakPoint.total,
      visitorPercent,
      contractorPercent
    };
  }, [chartData]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as AggregatedDataPoint;
      return (
        <div className="bg-dark text-white p-3 rounded-3 shadow-lg border border-secondary font-sans" style={{ minWidth: '200px' }}>
          <div className="fw-bold border-bottom border-secondary pb-1.5 mb-2 d-flex justify-content-between align-items-center">
            <span>{data.label}</span>
            <span className="badge bg-primary font-monospace">{data.total} Total</span>
          </div>
          <div className="d-flex flex-column gap-1.5 small">
            <div className="d-flex justify-content-between align-items-center">
              <span className="d-flex align-items-center gap-1.5">
                <span className="rounded-circle d-inline-block" style={{ width: '10px', height: '10px', backgroundColor: '#2563EB' }}></span>
                Visitors:
              </span>
              <strong className="font-monospace text-primary-light">{data.visitors}</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <span className="d-flex align-items-center gap-1.5">
                <span className="rounded-circle d-inline-block" style={{ width: '10px', height: '10px', backgroundColor: '#D97706' }}></span>
                Contractors:
              </span>
              <strong className="font-monospace" style={{ color: '#FBBF24' }}>{data.contractors}</strong>
            </div>
            <div className="border-top border-secondary pt-1.5 mt-1 d-flex justify-content-between align-items-center fw-bold">
              <span>Combined Total:</span>
              <span className="font-monospace text-success">{data.total}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card border-0 shadow-sm bg-white mb-4 overflow-hidden print-chart-card">
      {/* Header with Title & Timeframe Selector */}
      <div className="card-header bg-white py-3 px-4 border-bottom">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
              <i className="bi bi-graph-up-arrow text-primary fs-5"></i>
              {title}
            </h5>
            <small className="text-muted">{subtitle}</small>
          </div>

          {/* Timeframe & Display Controls (Hidden during print) */}
          <div className="d-flex flex-wrap align-items-center gap-2 d-print-none">
            {/* Timeframe Pill Selector */}
            <div className="btn-group btn-group-sm p-1 rounded-3 bg-light border" role="group">
              <button
                type="button"
                className={`btn btn-sm rounded-2 fw-semibold px-3 py-1 ${timeframe === 'DAILY' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary border-0'}`}
                onClick={() => setTimeframe('DAILY')}
              >
                <i className="bi bi-calendar-day me-1"></i> Daily
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-2 fw-semibold px-3 py-1 ${timeframe === 'MONTHLY' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary border-0'}`}
                onClick={() => setTimeframe('MONTHLY')}
              >
                <i className="bi bi-calendar-month me-1"></i> Monthly
              </button>
              <button
                type="button"
                className={`btn btn-sm rounded-2 fw-semibold px-3 py-1 ${timeframe === 'YEARLY' ? 'btn-primary text-white shadow-sm' : 'btn-light text-secondary border-0'}`}
                onClick={() => setTimeframe('YEARLY')}
              >
                <i className="bi bi-calendar-range me-1"></i> Yearly
              </button>
            </div>

            {/* Daily Interval Filter Sub-selector */}
            {timeframe === 'DAILY' && (
              <select
                className="form-select form-select-sm border-secondary-subtle bg-light text-dark fw-semibold"
                style={{ width: 'auto' }}
                value={dailyRange}
                onChange={(e) => setDailyRange(Number(e.target.value))}
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            )}

            {/* Chart Style Toggle */}
            <div className="btn-group btn-group-sm rounded-2 border bg-light" role="group">
              <button
                type="button"
                className={`btn btn-sm ${chartStyle === 'AREA' ? 'btn-dark text-white' : 'btn-light text-secondary border-0'}`}
                title="Area Chart"
                onClick={() => setChartStyle('AREA')}
              >
                <i className="bi bi-water"></i>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${chartStyle === 'BAR' ? 'btn-dark text-white' : 'btn-light text-secondary border-0'}`}
                title="Bar Chart"
                onClick={() => setChartStyle('BAR')}
              >
                <i className="bi bi-bar-chart-fill"></i>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${chartStyle === 'LINE' ? 'btn-dark text-white' : 'btn-light text-secondary border-0'}`}
                title="Line Chart"
                onClick={() => setChartStyle('LINE')}
              >
                <i className="bi bi-activity"></i>
              </button>
            </div>

            {/* Filter Mode Toggle */}
            <div className="btn-group btn-group-sm rounded-2 border bg-light" role="group">
              <button
                type="button"
                className={`btn btn-sm ${filterType === 'ALL' ? 'btn-primary text-white' : 'btn-light text-secondary border-0'}`}
                onClick={() => setFilterType('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterType === 'VISITORS' ? 'btn-primary text-white' : 'btn-light text-secondary border-0'}`}
                onClick={() => setFilterType('VISITORS')}
              >
                Visitors
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterType === 'CONTRACTORS' ? 'btn-primary text-white' : 'btn-light text-secondary border-0'}`}
                onClick={() => setFilterType('CONTRACTORS')}
              >
                Contractors
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="px-4 py-3 bg-light border-bottom">
        <div className="row g-3 text-center text-sm-start">
          <div className="col-6 col-md-3">
            <div className="text-muted small text-uppercase font-monospace fw-semibold" style={{ fontSize: '0.72rem' }}>
              TOTAL IN PERIOD ({timeframe})
            </div>
            <div className="fs-4 fw-extrabold text-dark mt-0.5">
              {stats.grandTotal} <span className="fs-6 fw-normal text-muted">entries</span>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="text-muted small text-uppercase font-monospace fw-semibold" style={{ fontSize: '0.72rem' }}>
              AVERAGE PER {timeframe === 'DAILY' ? 'DAY' : timeframe === 'MONTHLY' ? 'MONTH' : 'YEAR'}
            </div>
            <div className="fs-4 fw-extrabold text-primary mt-0.5">
              {stats.avgTotal} <span className="fs-6 fw-normal text-muted">avg</span>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="text-muted small text-uppercase font-monospace fw-semibold" style={{ fontSize: '0.72rem' }}>
              PEAK TRAFFIC PERIOD
            </div>
            <div className="fs-5 fw-bold text-dark mt-1 text-truncate" title={`${stats.peakLabel} (${stats.peakTotal} entries)`}>
              {stats.peakTotal > 0 ? (
                <>
                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle me-1.5 font-monospace">
                    {stats.peakTotal}
                  </span>
                  <span className="small">{stats.peakLabel}</span>
                </>
              ) : (
                <span className="text-muted small">No traffic recorded</span>
              )}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="text-muted small text-uppercase font-monospace fw-semibold" style={{ fontSize: '0.72rem' }}>
              VISITOR / CONTRACTOR RATIO
            </div>
            <div className="d-flex align-items-center gap-2 mt-1.5">
              <div className="progress flex-grow-1" style={{ height: '8px' }}>
                <div
                  className="progress-bar bg-primary"
                  role="progressbar"
                  style={{ width: `${stats.visitorPercent}%` }}
                  title={`Visitors: ${stats.totalVisitors} (${stats.visitorPercent}%)`}
                ></div>
                <div
                  className="progress-bar bg-warning"
                  role="progressbar"
                  style={{ width: `${stats.contractorPercent}%` }}
                  title={`Contractors: ${stats.totalContractors} (${stats.contractorPercent}%)`}
                ></div>
              </div>
              <span className="font-monospace small text-muted" style={{ fontSize: '0.75rem' }}>
                {stats.visitorPercent}% / {stats.contractorPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Chart Canvas */}
      <div className="card-body p-4">
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartStyle === 'AREA' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="contractorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey={timeframe === 'MONTHLY' ? 'subLabel' : 'label'}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '0.8rem' }}
                />
                {(filterType === 'ALL' || filterType === 'VISITORS') && (
                  <Area
                    type="monotone"
                    dataKey="visitors"
                    name="Visitors"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#visitorGradient)"
                  />
                )}
                {(filterType === 'ALL' || filterType === 'CONTRACTORS') && (
                  <Area
                    type="monotone"
                    dataKey="contractors"
                    name="Contractors"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#contractorGradient)"
                  />
                )}
              </AreaChart>
            ) : chartStyle === 'BAR' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey={timeframe === 'MONTHLY' ? 'subLabel' : 'label'}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '0.8rem' }}
                />
                {(filterType === 'ALL' || filterType === 'VISITORS') && (
                  <Bar dataKey="visitors" name="Visitors" fill="#2563EB" radius={[4, 4, 0, 0]} />
                )}
                {(filterType === 'ALL' || filterType === 'CONTRACTORS') && (
                  <Bar dataKey="contractors" name="Contractors" fill="#D97706" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey={timeframe === 'MONTHLY' ? 'subLabel' : 'label'}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '0.8rem' }}
                />
                {(filterType === 'ALL' || filterType === 'VISITORS') && (
                  <Line
                    type="monotone"
                    dataKey="visitors"
                    name="Visitors"
                    stroke="#2563EB"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#2563EB' }}
                    activeDot={{ r: 6 }}
                  />
                )}
                {(filterType === 'ALL' || filterType === 'CONTRACTORS') && (
                  <Line
                    type="monotone"
                    dataKey="contractors"
                    name="Contractors"
                    stroke="#D97706"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#D97706' }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
