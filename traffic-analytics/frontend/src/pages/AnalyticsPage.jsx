import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import { analyzeDomain, chatWithAI, formatVisits, formatChange } from '../services/api'

const TABS = [
  { id: 'overview',   label: '📊 Overview' },
  { id: 'sources',    label: '🔀 Traffic Sources' },
  { id: 'pages',      label: '📄 Top Pages' },
  { id: 'geo',        label: '🌍 Geographic' },
  { id: 'competitors',label: '⚔️ Competitors' },
  { id: 'ai',         label: '🤖 AI Insights' },
]

const SOURCE_COLORS = {
  organicSearch: '#7c3aed',
  directTraffic: '#0d9488',
  referral: '#f59e0b',
  socialMedia: '#3b82f6',
  paidSearch: '#ef4444',
  email: '#10b981',
  display: '#ec4899',
}

const SOURCE_LABELS = {
  organicSearch: 'Organic Search',
  directTraffic: 'Direct',
  referral: 'Referral',
  socialMedia: 'Social Media',
  paidSearch: 'Paid Search',
  email: 'Email',
  display: 'Display Ads',
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, trend, icon }) {
  const up = parseFloat(trend) >= 0
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {trend != null && (
        <p className={`text-xs font-medium mt-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs last period
        </p>
      )}
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Custom Pie tooltip ───────────────────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700">{name}</p>
      <p className="text-brand-600 font-bold">{value.toFixed(1)}%</p>
    </div>
  )
}

// ─── Overview tab ────────────────────────────────────────────────────────────
function OverviewTab({ data }) {
  const { overview, monthlyTrend, trafficSources } = data

  const pieData = Object.entries(trafficSources).map(([key, val]) => ({
    name: SOURCE_LABELS[key] || key,
    value: val,
    color: SOURCE_COLORS[key] || '#94a3b8'
  }))

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Visits"     value={formatVisits(overview.totalVisits)}   trend={overview.visitsTrend}   icon="👁" />
        <MetricCard label="Unique Visitors"  value={formatVisits(overview.uniqueVisitors)} sub="monthly"                  icon="👤" />
        <MetricCard label="Pages / Visit"    value={overview.pagesPerVisit}               sub="avg per session"           icon="📑" />
        <MetricCard label="Avg. Duration"    value={overview.avgVisitDuration}            sub="per session"               icon="⏱" />
        <MetricCard label="Bounce Rate"      value={`${overview.bounceRate}%`}            sub="sessions single page"      icon="↩" />
      </div>

      {/* Trend chart */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Monthly Traffic Trend</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradVisits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={formatVisits} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip formatter={(v) => [formatVisits(v), 'Visits']} contentStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="visits" stroke="#7c3aed" strokeWidth={2.5} fill="url(#gradVisits)" dot={false} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sources mini + ranks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Traffic Sources</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-700 mb-4">Site Rankings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <div>
                  <p className="text-xs text-gray-500">Global Rank</p>
                  <p className="font-bold text-xl text-gray-900">#{data.globalRank?.toLocaleString()}</p>
                </div>
              </div>
              <span className="badge-new">Worldwide</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏳️</span>
                <div>
                  <p className="text-xs text-gray-500">Country Rank</p>
                  <p className="font-bold text-xl text-gray-900">#{data.countryRank?.toLocaleString()}</p>
                </div>
              </div>
              <span className="badge-new">{data.geoDistribution?.[0]?.country || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏷</span>
                <div>
                  <p className="text-xs text-gray-500">Industry</p>
                  <p className="font-semibold text-gray-800">{data.industryCategory}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sources tab ─────────────────────────────────────────────────────────────
function SourcesTab({ data }) {
  const { trafficSources, overview } = data

  const barData = Object.entries(trafficSources)
    .sort((a, b) => b[1] - a[1])
    .map(([key, pct]) => ({
      name: SOURCE_LABELS[key] || key,
      pct,
      visits: Math.floor(overview.totalVisits * pct / 100),
      color: SOURCE_COLORS[key] || '#94a3b8'
    }))

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-700 mb-5">Traffic Distribution by Channel</h3>
        <div className="space-y-4">
          {barData.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-600 text-right flex-shrink-0">{s.name}</div>
              <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-3"
                  style={{ width: `${s.pct}%`, backgroundColor: s.color, minWidth: '4px' }}
                >
                  {s.pct > 8 && <span className="text-white text-xs font-semibold">{s.pct.toFixed(1)}%</span>}
                </div>
              </div>
              <div className="w-20 text-xs text-gray-500 flex-shrink-0">{formatVisits(s.visits)}/mo</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Channel Breakdown</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} width={80} />
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Share']} contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Pages tab ───────────────────────────────────────────────────────────────
function PagesTab({ data }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">Top Pages by Traffic</h3>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-5 py-3 font-medium text-gray-500 text-xs">#</th>
            <th className="px-4 py-3 font-medium text-gray-500 text-xs">Page</th>
            <th className="px-4 py-3 font-medium text-gray-500 text-xs text-right">Visits</th>
            <th className="px-4 py-3 font-medium text-gray-500 text-xs text-right">Share</th>
            <th className="px-4 py-3 font-medium text-gray-500 text-xs text-right">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.topPages?.map((page, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-brand-600">{data.domain}{page.url}</span>
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{formatVisits(page.visits)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${page.percentage}%` }} />
                  </div>
                  <span className="text-gray-600 text-xs w-10 text-right">{page.percentage}%</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`text-xs font-medium ${parseFloat(page.change) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatChange(page.change)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Geo tab ─────────────────────────────────────────────────────────────────
function GeoTab({ data }) {
  const geoData = data.geoDistribution || []

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-semibold text-gray-700 mb-4">Traffic by Country</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={geoData} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="country" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" interval={0} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip formatter={(v, n, p) => [`${v}% — ${formatVisits(p.payload.visits)}`, 'Traffic']} contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="percentage" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Country Breakdown</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {geoData.map((c, i) => (
            <div key={i} className="flex items-center px-5 py-3 hover:bg-gray-50">
              <span className="text-xl mr-3 w-8">{getFlagEmoji(c.countryCode)}</span>
              <span className="flex-1 text-sm text-gray-700 font-medium">{c.country}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(c.percentage / geoData[0].percentage) * 100}%` }} />
                </div>
                <span className="text-sm text-gray-500 w-12 text-right">{c.percentage}%</span>
                <span className="text-sm font-medium text-gray-700 w-16 text-right">{formatVisits(c.visits)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getFlagEmoji(countryCode) {
  if (!countryCode) return '🌐'
  return countryCode.toUpperCase().split('').map(c => String.fromCodePoint(127397 + c.charCodeAt())).join('')
}

// ─── Competitors tab ──────────────────────────────────────────────────────────
function CompetitorsTab({ data }) {
  const navigate = useNavigate()
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-700">Top Competitors</h3>
        <p className="text-xs text-gray-400 mt-1">Domains competing for the same audience</p>
      </div>
      <div className="divide-y divide-gray-50">
        {data.competitors?.map((c, i) => (
          <div key={i} className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors">
            <span className="text-gray-400 text-xs w-6">{i + 1}</span>
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 mr-3 ml-1">
              {c.domain[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <button
                onClick={() => navigate(`/analytics/${encodeURIComponent(c.domain)}`)}
                className="font-medium text-brand-600 hover:text-brand-700 text-sm hover:underline"
              >
                {c.domain}
              </button>
              <p className="text-xs text-gray-400 mt-0.5">Audience overlap: {c.overlap}%</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm text-gray-800">{formatVisits(c.visits)}</p>
              <p className="text-xs text-gray-400">visits/mo</p>
            </div>
            <div className="ml-5 w-24">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-500">Overlap</span>
                <span className="text-xs text-brand-600 font-medium">{c.overlap}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${c.overlap}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AI Insights tab ─────────────────────────────────────────────────────────
function AIInsightsTab({ domain, data }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const { insights } = data

  const quickQuestions = [
    'How can I increase organic traffic?',
    'What are my biggest growth opportunities?',
    'How do I reduce bounce rate?',
    'Which channels should I invest more in?',
  ]

  async function sendMessage(text) {
    const q = text || input.trim()
    if (!q) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setThinking(true)
    try {
      const { answer } = await chatWithAI(domain, q, data)
      setMessages(prev => [...prev, { role: 'ai', text: answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Unable to connect to AI. Check your API key.' }])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary + SWOT */}
      <div className="card p-5">
        <div className="flex items-start gap-3 mb-5">
          <span className="text-3xl flex-shrink-0">🤖</span>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">AI Analysis</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{insights.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: '💪 Strengths',       items: insights.strengths,      bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
            { title: '🚀 Opportunities',   items: insights.opportunities,  bg: 'bg-blue-50',    border: 'border-blue-100',    text: 'text-blue-700' },
            { title: '⚠️ Threats',          items: insights.threats,        bg: 'bg-red-50',     border: 'border-red-100',     text: 'text-red-700' },
            { title: '✅ Recommendations', items: insights.recommendations, bg: 'bg-brand-50',   border: 'border-brand-100',   text: 'text-brand-700' },
          ].map(section => (
            <div key={section.title} className={`rounded-xl border p-4 ${section.bg} ${section.border}`}>
              <h4 className={`font-semibold text-xs mb-3 ${section.text}`}>{section.title}</h4>
              <ul className="space-y-2">
                {section.items?.map((item, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="mt-0.5 text-gray-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* AI Chat */}
      <div className="card overflow-hidden flex flex-col" style={{ height: 480 }}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h3 className="font-semibold text-gray-700">Ask Claude AI</h3>
          <span className="badge-new ml-1">AI</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">Ask anything about {domain}'s traffic</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 px-3 py-2 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {m.role === 'ai' && <span className="text-xs font-semibold text-brand-600 block mb-1">🤖 Claude AI</span>}
                {m.text}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>●</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about traffic, SEO, competitors..."
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || thinking}
            className="btn-primary text-sm disabled:opacity-50 px-4"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { domain } = useParams()
  const [searchParams] = useSearchParams()
  const decodedDomain = decodeURIComponent(domain)
  const initialTab = searchParams.get('tab') || 'overview'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDemo, setIsDemo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeDomain(decodedDomain)
      if (result.success) {
        setData(result.data)
        setIsDemo(!!result.demo)
      } else {
        setError(result.error || 'Analysis failed')
      }
    } catch (e) {
      setError('Cannot connect to backend. Make sure the server is running on port 3001.')
    } finally {
      setLoading(false)
    }
  }, [decodedDomain])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-full">
      {/* Domain header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
            {decodedDomain[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-gray-900 text-lg">{decodedDomain}</h1>
              {isDemo && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  AI Estimated
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {loading ? 'Analyzing...' : data ? `${data.industryCategory} · Global Rank #${data.globalRank?.toLocaleString()}` : ''}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto text-xs text-brand-600 hover:text-brand-700 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors disabled:opacity-50"
          >
            {loading ? '⏳ Analyzing...' : '🔄 Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-0.5">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-btn flex-shrink-0 ${activeTab === tab.id ? 'tab-btn-active' : 'tab-btn-inactive'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && <LoadingSkeleton />}
        {error && (
          <div className="card p-8 text-center">
            <span className="text-4xl block mb-3">⚠️</span>
            <p className="text-gray-600 font-medium mb-2">{error}</p>
            <button onClick={load} className="btn-primary text-sm mt-3">Try Again</button>
          </div>
        )}
        {data && !loading && (
          <>
            {activeTab === 'overview'    && <OverviewTab     data={data} />}
            {activeTab === 'sources'     && <SourcesTab      data={data} />}
            {activeTab === 'pages'       && <PagesTab        data={data} />}
            {activeTab === 'geo'         && <GeoTab          data={data} />}
            {activeTab === 'competitors' && <CompetitorsTab  data={data} />}
            {activeTab === 'ai'          && <AIInsightsTab   domain={decodedDomain} data={data} />}
          </>
        )}
      </div>
    </div>
  )
}
