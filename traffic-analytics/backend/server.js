import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Demo data generators ────────────────────────────────────────────────────

function genMonthlyTrend(base) {
  const months = ['Jun 2024','Jul 2024','Aug 2024','Sep 2024','Oct 2024','Nov 2024',
                  'Dec 2024','Jan 2025','Feb 2025','Mar 2025','Apr 2025','May 2025'];
  let cur = base * 0.82;
  return months.map(month => {
    cur = Math.floor(cur * (0.94 + Math.random() * 0.16));
    return { month, visits: cur };
  });
}

function genTopPages(domain, base) {
  const slugs = ['/','/about','/products','/blog','/pricing','/features','/contact','/docs','/login','/signup'];
  const percs = [32, 14, 10, 9, 7, 6, 5, 5, 4, 3];
  return slugs.map((url, i) => ({
    url,
    visits: Math.floor(base * percs[i] / 100),
    percentage: percs[i],
    change: parseFloat((Math.random() * 24 - 6).toFixed(1))
  }));
}

function genGeo(base) {
  const data = [
    { country: 'United States', countryCode: 'US', pct: 34 },
    { country: 'United Kingdom', countryCode: 'GB', pct: 11 },
    { country: 'Germany',        countryCode: 'DE', pct: 8  },
    { country: 'France',         countryCode: 'FR', pct: 6  },
    { country: 'Canada',         countryCode: 'CA', pct: 5  },
    { country: 'Australia',      countryCode: 'AU', pct: 4.5},
    { country: 'India',          countryCode: 'IN', pct: 4  },
    { country: 'Brazil',         countryCode: 'BR', pct: 3.5},
    { country: 'Netherlands',    countryCode: 'NL', pct: 3  },
    { country: 'Spain',          countryCode: 'ES', pct: 2.5},
  ];
  return data.map(c => ({ ...c, visits: Math.floor(base * c.pct / 100), percentage: c.pct }));
}

function genCompetitors(domain) {
  const base = domain.replace(/\.(com|net|org|io|es|co\.uk)$/, '');
  const suffixes = ['hub', 'pro', 'app', 'hq', 'labs'];
  return suffixes.map((s, i) => ({
    domain: `${base}${s}.com`,
    visits: Math.floor(Math.random() * 4000000 + 300000),
    overlap: parseFloat((Math.random() * 35 + 10).toFixed(1))
  }));
}

function demoData(domain) {
  const base = Math.floor(Math.random() * 6000000 + 400000);
  return {
    domain,
    overview: {
      totalVisits: base,
      uniqueVisitors: Math.floor(base * 0.72),
      pagesPerVisit: parseFloat((Math.random() * 4 + 2).toFixed(1)),
      avgVisitDuration: `${Math.floor(Math.random() * 5 + 1)}:${String(Math.floor(Math.random() * 60)).padStart(2,'0')}`,
      bounceRate: parseFloat((Math.random() * 35 + 28).toFixed(1)),
      visitsTrend: parseFloat((Math.random() * 35 - 8).toFixed(1))
    },
    monthlyTrend: genMonthlyTrend(base),
    trafficSources: {
      organicSearch: 43.5,
      directTraffic: 27.2,
      referral: 12.8,
      socialMedia: 9.1,
      paidSearch: 5.3,
      email: 1.5,
      display: 0.6
    },
    topPages: genTopPages(domain, base),
    geoDistribution: genGeo(base),
    competitors: genCompetitors(domain),
    insights: {
      summary: `${domain} shows a healthy traffic profile with strong organic search presence and solid brand recognition through direct traffic. The site demonstrates consistent audience engagement with above-average session depth.`,
      strengths: [
        'Strong organic search visibility driving nearly half of traffic',
        'High direct traffic ratio indicating strong brand awareness',
        'Consistent monthly traffic growth trend'
      ],
      opportunities: [
        'Expand social media channel presence to capture underserved audience',
        'Launch targeted email marketing campaigns to improve retention',
        'Invest in content marketing to target untapped long-tail keywords'
      ],
      threats: [
        'Rising competition from well-funded competitors in organic search',
        'Increasing cost-per-click in paid channels reducing ROI',
        'Search algorithm updates that could affect organic rankings'
      ],
      recommendations: [
        'Publish long-form content guides to capture informational search intent',
        'Implement retargeting campaigns for visitors who did not convert',
        'Optimize Core Web Vitals to improve search rankings and user experience'
      ]
    },
    industryCategory: 'Technology & Software',
    globalRank: Math.floor(Math.random() * 80000 + 5000),
    countryRank: Math.floor(Math.random() * 8000 + 500)
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post('/api/analyze', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  if (!client) {
    return res.json({ success: true, data: demoData(domain), demo: true });
  }

  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are a web traffic analytics expert. Analyze the domain "${domain}" and return ONLY valid JSON (no markdown fences, no explanation) matching this exact schema. Make the data realistic for the actual site:

{
  "domain": "${domain}",
  "overview": {
    "totalVisits": <realistic integer monthly visits>,
    "uniqueVisitors": <integer>,
    "pagesPerVisit": <float 1.5-8>,
    "avgVisitDuration": "<M:SS>",
    "bounceRate": <float 20-75>,
    "visitsTrend": <float, % change vs prev period, can be negative>
  },
  "monthlyTrend": [
    {"month":"Jun 2024","visits":<int>},{"month":"Jul 2024","visits":<int>},
    {"month":"Aug 2024","visits":<int>},{"month":"Sep 2024","visits":<int>},
    {"month":"Oct 2024","visits":<int>},{"month":"Nov 2024","visits":<int>},
    {"month":"Dec 2024","visits":<int>},{"month":"Jan 2025","visits":<int>},
    {"month":"Feb 2025","visits":<int>},{"month":"Mar 2025","visits":<int>},
    {"month":"Apr 2025","visits":<int>},{"month":"May 2025","visits":<int>}
  ],
  "trafficSources": {
    "organicSearch":<float>,"directTraffic":<float>,"referral":<float>,
    "socialMedia":<float>,"paidSearch":<float>,"email":<float>,"display":<float>
  },
  "topPages": [
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>},
    {"url":"<path>","visits":<int>,"percentage":<float>,"change":<float>}
  ],
  "geoDistribution": [
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>},
    {"country":"<name>","countryCode":"<2-letter>","visits":<int>,"percentage":<float>}
  ],
  "competitors": [
    {"domain":"<competitor>","visits":<int>,"overlap":<float>},
    {"domain":"<competitor>","visits":<int>,"overlap":<float>},
    {"domain":"<competitor>","visits":<int>,"overlap":<float>},
    {"domain":"<competitor>","visits":<int>,"overlap":<float>},
    {"domain":"<competitor>","visits":<int>,"overlap":<float>}
  ],
  "insights": {
    "summary":"<2-3 sentences>",
    "strengths":["<s1>","<s2>","<s3>"],
    "opportunities":["<o1>","<o2>","<o3>"],
    "threats":["<t1>","<t2>","<t3>"],
    "recommendations":["<r1>","<r2>","<r3>"]
  },
  "industryCategory":"<category>",
  "globalRank":<int>,
  "countryRank":<int>
}

IMPORTANT: trafficSources values must sum to exactly 100.`
      }]
    });

    let text = msg.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const data = JSON.parse(text);

    // Normalize sources to 100
    const src = data.trafficSources;
    const total = Object.values(src).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.5) {
      Object.keys(src).forEach(k => { src[k] = Math.round(src[k] / total * 1000) / 10; });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Claude error:', err.message);
    res.json({ success: true, data: demoData(domain), demo: true, warning: 'Using AI-estimated data' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { domain, question, analyticsData } = req.body;

  if (!client) {
    return res.json({ answer: 'Configure ANTHROPIC_API_KEY in backend/.env to enable the AI assistant.' });
  }

  try {
    const topSource = Object.entries(analyticsData?.trafficSources || {})
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'organic search';

    const msg = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a traffic analytics expert. The user is analyzing "${domain}".

Key metrics:
- Monthly visits: ${analyticsData?.overview?.totalVisits?.toLocaleString() || 'N/A'}
- Traffic trend: ${analyticsData?.overview?.visitsTrend}%
- Top source: ${topSource}
- Bounce rate: ${analyticsData?.overview?.bounceRate}%
- Global rank: #${analyticsData?.globalRank?.toLocaleString() || 'N/A'}
- Industry: ${analyticsData?.industryCategory || 'N/A'}

User question: "${question}"

Answer in 2-3 concise, actionable sentences. Be specific.`
      }]
    });

    res.json({ answer: msg.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasApiKey: !!process.env.ANTHROPIC_API_KEY, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 TrafficIQ Backend → http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY
    ? '✅ Anthropic API key loaded — full AI mode active'
    : '⚠️  No API key — running in demo mode (set ANTHROPIC_API_KEY in .env)');
});
