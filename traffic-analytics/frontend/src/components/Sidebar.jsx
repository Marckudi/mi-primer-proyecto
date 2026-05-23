import { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'

const nav = [
  {
    section: 'Traffic & Market',
    items: [
      { id: 'home',    icon: '🏠', label: 'Get Started',       tab: null },
      { id: 'traffic', icon: '📊', label: 'Traffic Analytics',  tab: 'overview' },
      { id: 'trends',  icon: '📈', label: 'Daily Trends',       tab: 'trends' },
    ]
  },
  {
    section: 'Traffic Distribution',
    items: [
      { id: 'ai',       icon: '🤖', label: 'AI Traffic',              tab: 'ai' },
      { id: 'referral', icon: '🔗', label: 'Referral',                tab: 'sources' },
      { id: 'organic',  icon: '🔍', label: 'Organic Search',          tab: 'sources' },
      { id: 'paid',     icon: '💰', label: 'Paid Search',             tab: 'sources' },
      { id: 'social',   icon: '👥', label: 'Organic Social',          tab: 'sources' },
      { id: 'psocial',  icon: '📣', label: 'Paid Social',             tab: 'sources' },
      { id: 'email',    icon: '✉️',  label: 'Email',                   tab: 'sources' },
      { id: 'display',  icon: '🖼️',  label: 'Display Ads',            tab: 'sources' },
      { id: 'srcsdst',  icon: '↔️',  label: 'Sources & Destinations', tab: 'sources' },
    ]
  },
  {
    section: 'Pages and Categories',
    items: [
      { id: 'toppages',   icon: '📄', label: 'Top Pages',              tab: 'pages' },
      { id: 'subfolders', icon: '📁', label: 'Subfolders & Subdomains',tab: 'pages' },
      { id: 'groups',     icon: '📦', label: 'Page Groups',            tab: 'pages', badge: 'beta' },
    ]
  },
  {
    section: 'Regional Trends',
    items: [
      { id: 'usa',      icon: '🇺🇸', label: 'USA',             tab: 'geo' },
      { id: 'countries',icon: '🌍', label: 'Countries',        tab: 'geo' },
      { id: 'regions',  icon: '🏙️',  label: 'Business Regions', tab: 'geo' },
    ]
  }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [activeItem, setActiveItem] = useState('home')

  const domainMatch = location.pathname.match(/^\/analytics\/(.+)/)
  const currentDomain = domainMatch ? decodeURIComponent(domainMatch[1]) : null

  function handleClick(item) {
    setActiveItem(item.id)
    if (item.id === 'home' || !currentDomain) {
      navigate('/')
    } else {
      navigate(`/analytics/${encodeURIComponent(currentDomain)}?tab=${item.tab || 'overview'}`)
    }
  }

  return (
    <aside
      className={`flex flex-col bg-white border-r border-gray-100 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      } flex-shrink-0 overflow-y-auto`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="font-bold text-brand-700 text-lg tracking-tight">TrafficIQ</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 ml-auto"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-4">
        {nav.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                {group.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => handleClick(item)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors ${
                      activeItem === item.id
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="badge-new">{item.badge}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-100">
          <div className="bg-brand-50 rounded-xl p-3 text-center">
            <p className="text-xs text-brand-700 font-medium mb-1">Powered by Claude AI</p>
            <p className="text-xs text-gray-500">Real-time traffic intelligence</p>
          </div>
        </div>
      )}
    </aside>
  )
}
