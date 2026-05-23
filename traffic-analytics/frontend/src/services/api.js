import axios from 'axios'

const BASE = '/api'

export async function analyzeDomain(domain) {
  const { data } = await axios.post(`${BASE}/analyze`, { domain })
  return data
}

export async function chatWithAI(domain, question, analyticsData) {
  const { data } = await axios.post(`${BASE}/chat`, { domain, question, analyticsData })
  return data
}

export async function checkHealth() {
  const { data } = await axios.get(`${BASE}/health`)
  return data
}

export function formatVisits(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n?.toLocaleString() ?? '—'
}

export function formatChange(n) {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}
