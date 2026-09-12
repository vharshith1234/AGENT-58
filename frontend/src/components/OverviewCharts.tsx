export function BarChart({
  title,
  items,
}: {
  title: string
  items: { label: string; value: number; color?: string }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">No data yet.</p>
      ) : (
        <div className="bar-chart">
          {items.map((item) => (
            <div key={item.label} className="bar-chart-row">
              <div className="bar-chart-label">{item.label}</div>
              <div className="bar-chart-track">
                <div
                  className="bar-chart-fill"
                  style={{
                    width: `${Math.round((item.value / max) * 100)}%`,
                    background: item.color || '#2563eb',
                  }}
                />
              </div>
              <div className="bar-chart-value">{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function DonutBreakdown({
  title,
  segments,
}: {
  title: string
  segments: { label: string; value: number; color: string }[]
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  const stops = segments.map((seg) => {
    const start = (acc / total) * 100
    acc += seg.value
    const end = (acc / total) * 100
    return `${seg.color} ${start}% ${end}%`
  })

  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      <div className="donut-wrap">
        <div
          className="donut"
          style={{ background: `conic-gradient(${stops.join(', ')})` }}
          aria-hidden
        />
        <ul className="donut-legend">
          {segments.map((s) => (
            <li key={s.label}>
              <span style={{ background: s.color }} />
              {s.label}: <strong>{s.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function TrendChart({
  title,
  points,
}: {
  title: string
  points: { label: string; value: number }[]
}) {
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <section className="panel chart-panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {points.length === 0 ? (
        <p className="empty-state">No trend yet.</p>
      ) : (
        <div className="trend-chart" role="img" aria-label={title}>
          {points.map((point) => (
            <div key={point.label} className="trend-col">
              <div className="trend-value">{point.value}</div>
              <div className="trend-track">
                <div
                  className="trend-fill"
                  style={{ height: `${Math.round((point.value / max) * 100)}%` }}
                />
              </div>
              <div className="trend-label">{point.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
