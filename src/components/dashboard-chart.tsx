'use client'

import React, { useMemo, useState } from 'react'

export interface ChartDataPoint {
  label: string
  issued: number
  draft: number
  issuedFormatted: string
  draftFormatted: string
}

export function DashboardChart({
  data = [],
  title = 'Evolução Comercial',
  subtitle = 'Histórico mensal de propostas emitidas e rascunhos em negociação',
}: {
  data?: ChartDataPoint[]
  title?: string
  subtitle?: string
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Dados reais garantidos com fallback neutro de meses se vazio
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const now = new Date()
    const points: ChartDataPoint[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      points.push({
        label: monthNames[d.getMonth()],
        issued: 0,
        draft: 0,
        issuedFormatted: 'R$ 0,00',
        draftFormatted: 'R$ 0,00',
      })
    }
    return points
  }, [data])

  // Viewbox dimensions
  const width = 640
  const height = 260
  const paddingLeft = 45
  const paddingRight = 20
  const paddingTop = 25
  const paddingBottom = 35

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Escala dinâmica calculada a partir dos dados reais
  const { maxY, gridValues } = useMemo(() => {
    const maxVal = Math.max(...chartData.map((d) => Math.max(d.issued, d.draft)), 0)
    const computedMax = maxVal === 0 ? 50 : Math.ceil(maxVal * 1.25)
    const step = Math.max(1, Math.ceil(computedMax / 4))
    const finalMax = step * 4
    return {
      maxY: finalMax,
      gridValues: [0, step, step * 2, step * 3, finalMax],
    }
  }, [chartData])

  // Helper to convert point to svg coords
  const getX = (index: number) => paddingLeft + (index / Math.max(1, chartData.length - 1)) * chartWidth
  const getY = (val: number) => paddingTop + chartHeight - (val / maxY) * chartHeight

  // Generate smooth cubic bezier curves
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return ''
    const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }))

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] || p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
  }

  const issuedValues = chartData.map((d) => d.issued)
  const draftValues = chartData.map((d) => d.draft)

  const issuedLine = buildSmoothPath(issuedValues)
  const draftLine = buildSmoothPath(draftValues)

  const firstX = getX(0)
  const lastX = getX(chartData.length - 1)
  const bottomY = paddingTop + chartHeight

  const issuedArea = `${issuedLine} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  const draftArea = `${draftLine} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`

  const activePoint = hoverIndex !== null ? chartData[hoverIndex] : null

  return (
    <div className="relative rounded-2xl border border-zinc-800/80 bg-[#18181b] p-6 shadow-xl transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#17c964] shadow-[0_0_8px_#17c964]" />
            <span className="text-zinc-300">Emitidos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0072f5] shadow-[0_0_8px_#0072f5]" />
            <span className="text-zinc-300">Em Negociação</span>
          </div>
        </div>
      </div>

      {/* SVG Responsive Container */}
      <div className="relative w-full aspect-[2.4/1] min-h-[220px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Green Gradient */}
            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#17c964" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#17c964" stopOpacity="0.0" />
            </linearGradient>

            {/* Blue Gradient */}
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0072f5" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#0072f5" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#17c964" floodOpacity="0.75" />
            </filter>
            <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#0072f5" floodOpacity="0.75" />
            </filter>
          </defs>

          {/* Grid lines (horizontal) */}
          {gridValues.map((val) => {
            const y = getY(val)
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  fill="#71717a"
                  fontSize="10"
                  textAnchor="end"
                  className="font-medium"
                >
                  {val}
                </text>
              </g>
            )
          })}

          {/* Area Fills */}
          <path d={issuedArea} fill="url(#greenGradient)" />
          <path d={draftArea} fill="url(#blueGradient)" />

          {/* Stroke Lines */}
          <path
            d={draftLine}
            fill="none"
            stroke="#0072f5"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#glowBlue)"
          />
          <path
            d={issuedLine}
            fill="none"
            stroke="#17c964"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#glowGreen)"
          />

          {/* X Axis Labels & Interactive Bars */}
          {chartData.map((item, idx) => {
            const x = getX(idx)
            const isHovered = hoverIndex === idx
            return (
              <g key={item.label}>
                <text
                  x={x}
                  y={height - 10}
                  fill={isHovered ? '#ffffff' : '#a1a1aa'}
                  fontSize="11"
                  textAnchor="middle"
                  className="transition-colors font-medium cursor-pointer"
                >
                  {item.label}
                </text>

                {/* Invisible hover trigger column */}
                <rect
                  x={x - chartWidth / (chartData.length * 2)}
                  y={paddingTop}
                  width={chartWidth / chartData.length}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(idx)}
                />

                {/* Active Column Indicator */}
                {isHovered && (
                  <>
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={bottomY}
                      stroke="#52525b"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    {/* Points */}
                    <circle
                      cx={x}
                      cy={getY(item.issued)}
                      r="5"
                      fill="#18181b"
                      stroke="#17c964"
                      strokeWidth="3"
                      className="transition-all"
                    />
                    <circle
                      cx={x}
                      cy={getY(item.draft)}
                      r="5"
                      fill="#18181b"
                      stroke="#0072f5"
                      strokeWidth="3"
                      className="transition-all"
                    />
                  </>
                )}
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip Card */}
        {activePoint && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-zinc-700/80 bg-[#18181b]/95 p-3 shadow-2xl backdrop-blur-md transition-all -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: `${Math.min(getY(activePoint.issued), getY(activePoint.draft)) - 10}px`,
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Mês: {activePoint.label}
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-[#17c964]" />
                  Emitidos:
                </span>
                <span className="font-bold text-[#17c964]">{activePoint.issuedFormatted}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-[#0072f5]" />
                  Rascunhos:
                </span>
                <span className="font-bold text-[#0072f5]">{activePoint.draftFormatted}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

