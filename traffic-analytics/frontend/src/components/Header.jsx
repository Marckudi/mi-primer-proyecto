import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Header() {
  const [domain, setDomain] = useState('')
  const navigate = useNavigate()

  function handleSearch(e) {
    e.preventDefault()
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (d) navigate(`/analytics/${encodeURIComponent(d)}`)
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 flex-shrink-0 z-10">
      {/* Quick search */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-lg">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="Enter domain to analyze..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <button type="submit" className="btn-primary text-sm py-2">
          Analyze
        </button>
      </form>

      <div className="ml-auto flex items-center gap-3">
        <a
          href="https://console.anthropic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-600 hover:underline hidden sm:block"
        >
          Get API Key
        </a>
        <button className="btn-primary text-sm">
          Start Free Trial
        </button>
        <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
          M
        </div>
      </div>
    </header>
  )
}
