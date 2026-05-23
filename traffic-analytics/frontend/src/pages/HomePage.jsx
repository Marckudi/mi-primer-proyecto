import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const examples = ['google.com', 'github.com', 'openai.com', 'netflix.com', 'airbnb.com']

const features = [
  { icon: '📡', title: 'Traffic Sources & Channels', desc: 'Break down every traffic source: organic, paid, social, referral, email, and display.' },
  { icon: '🌍', title: 'Market & Industry Analysis', desc: 'Benchmark against competitors and understand your market position worldwide.' },
  { icon: '👥', title: 'Audience Insights', desc: 'Discover who your visitors are, where they come from, and what they care about.' },
  { icon: '🤖', title: 'AI-Powered Analysis', desc: 'Get instant insights, growth recommendations, and competitive intelligence from Claude AI.' },
]

export default function HomePage() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleAnalyze(d) {
    const clean = (d || domain).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!clean) return
    setLoading(true)
    navigate(`/analytics/${encodeURIComponent(clean)}`)
  }

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-teal-600 px-8 py-16 text-white">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        <div className="relative max-w-3xl">
          <span className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Get Started
          </span>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Traffic & Market insights<br />that deliver results
          </h1>
          <p className="text-brand-100 text-lg mb-8">
            Instantly reveal what's working for your competitors and how to grow faster — powered by Claude AI.
          </p>

          {/* Search */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🌐</span>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder="Enter domain, subdomain or subfolder"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg"
              />
            </div>
            <button
              onClick={() => handleAnalyze()}
              disabled={!domain.trim() || loading}
              className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg text-sm"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {/* Example domains */}
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-brand-200 text-xs">Try:</span>
            {examples.map(ex => (
              <button
                key={ex}
                onClick={() => handleAnalyze(ex)}
                className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-full transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-6xl">
        {/* Saved lists */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Saved lists</h2>
            <button className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              <span>+</span> Create new list
            </button>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-gray-700">Untitled list</p>
                <p className="text-xs text-gray-400 mt-0.5">No domains added yet</p>
              </div>
              <button
                onClick={() => handleAnalyze('alphavisionai.es')}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <span>🌐</span> alphavisionai.es
              </button>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Explore in One Click</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(f => (
              <div key={f.title} className="card p-5 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-sm text-gray-800 mb-2 group-hover:text-brand-600 transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick start domains */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Popular Analyses</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {['amazon.com','meta.com','twitter.com','linkedin.com','shopify.com',
              'stripe.com','vercel.com','notion.so','figma.com','hubspot.com'].map(d => (
              <button
                key={d}
                onClick={() => handleAnalyze(d)}
                className="card p-3 text-center hover:border-brand-200 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-brand-50 mx-auto mb-2 flex items-center justify-center text-sm font-bold text-gray-500 group-hover:text-brand-600 transition-colors">
                  {d[0].toUpperCase()}
                </div>
                <p className="text-xs text-gray-600 group-hover:text-brand-600 truncate transition-colors">{d}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
