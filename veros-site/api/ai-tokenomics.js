// Vercel Edge Runtime — no cold starts, longer execution window
export const config = { runtime: 'edge' };

function clean(key) {
  return (key || '').replace(/[^\x20-\x7E]/g, '').trim();
}

const ANALYZE_TEMPLATES = [
  {title:'The Scarcity Amplifier',detail:'With only {supply} max supply and earn-only entry, {model} creates a supply curve identical to its activity curve — making speculation mathematically impossible. Every token represents real proof-of-work, not speculative capital.',signal:'bullish',leverage:'high'},
  {title:'Burn Mechanics & Long-Term Deflation',detail:'A {burn}% burn rate compounded across {users} active users creates permanent deflation as the ecosystem grows. Render Network\'s Burn-and-Mint model proved this drives price appreciation when demand exceeds new issuance.',signal:'bullish',leverage:'high'},
  {title:'Governance Moat on Dash Platform',detail:'JSON-configured threshold voting with 256-member capacity means zero smart contract risk. Unlike Compound or Aragon which are exploitable, $MOTUS governance has no exploit surface — a structural advantage MakerDAO spent millions to try to achieve.',signal:'bullish',leverage:'high'},
  {title:'Community Size Velocity Risk',detail:'At {users} active participants, ecosystem liquidity is thin. BONK succeeded at launch with 50,000+ NFT holders seeded — consider a BONK-style community airdrop to Dash ecosystem members to catalyze adoption.',signal:'neutral',leverage:'medium'},
];

function fillTemplate(tpl, params) {
  return {
    ...tpl,
    detail: tpl.detail
      .replace('{supply}', params.maxSupply || '11M')
      .replace('{model}', params.modelName || '$MOTUS')
      .replace('{burn}', params.burnRate || '2')
      .replace('{users}', params.communitySize || '100'),
  };
}

function smartAnalyze(params) {
  const insights = ANALYZE_TEMPLATES.map(t => fillTemplate(t, params));
  const score = Math.min(9, Math.max(5, 6 + Math.floor((params.communitySize || 100) / 500)));
  return {
    insights,
    verdict: `${params.modelName || '$MOTUS'} is a category-defining earn-only token — structurally anti-fragile and positioned at the intersection of governance innovation and MiCA-compliant privacy infrastructure.`,
    davara_note: 'The most radical tokenomic model is also the simplest: make it impossible to speculate on something you haven\'t earned. When the supply curve equals the activity curve, dumps are mathematically impossible — this isn\'t a feature, it\'s a structural guarantee. ◈',
    trendingScore: score,
    closestProject: 'STEPN + veCRV',
    projectLesson: 'STEPN proved earn-only creates powerful retention but failed when earn rate outpaced burn — $MOTUS solves this with JSON-configurable burn mechanics on Dash Platform.',
    dashConfig: 'Set distributionType to "perpetual" with block-based halving for predictable scarcity. Use keepHistory:true for all governance votes — this immutable record becomes a trust primitive that Solidity-based DAOs cannot replicate.',
    source: 'davara-intelligence-v2'
  };
}

const GENERATED_MODELS = [
  {
    name: 'The Resonance Protocol',
    tagline: 'Tokens born from synchronized collective action.',
    color: '#00f5d4',
    earnMechanism: 'Earned when actions are synchronized across 3+ community members within the same 24-hour window — solo actions earn base rate, synchronized actions earn 3x',
    governanceInnovation: 'Proposals require resonant approval from multiple timezone clusters — governance literally requires the community to move together',
    revolutionaryIdea: 'The Resonance Protocol inverts every assumption: tokens aren\'t rewards for individual action, they\'re crystallized proof of collective coordination. The rarer the coordination, the more valuable the token — Metcalfe\'s Law encoded into the minting contract. No other token in crypto rewards the ACT of connecting, not just the act of contributing.',
    inspiredBy: 'Coordinape gift circles, Hypha DAO 3.0, Metcalfe\'s Law, Nouns DAO',
    davara_note: 'The Resonance Protocol answers a question nobody asked: what if tokens were proof of human connection, not human labor? Dash Platform\'s JSON governance makes this possible without a line of Solidity — the coordination mechanism IS the token IS the governance. This is Web3\'s missing primitive. ◈',
    flywheel: ['CONNECT WITH OTHERS', 'EARN 3X RESONANCE BONUS', 'POOL GOVERNANCE POWER', 'COORDINATE PROPOSALS', 'ATTRACT MORE CONNECTORS'],
    researchBasis: 'Hypha DAO 3.0 membranic governance research (Frontiers in Blockchain, 2025)',
  },
  {
    name: 'The Memory Weave',
    tagline: 'Every move permanently woven into the chain.',
    color: '#ff006e',
    earnMechanism: 'Non-transferable memory tokens issued for every verified community action — each token is a permanent on-chain memory with metadata of what was done and when',
    governanceInnovation: 'Governance weight is calculated by the diversity of your action types, not volume — breadth of contribution matters more than depth, preventing whale capture',
    revolutionaryIdea: 'The Memory Weave transforms blockchain from a ledger of transactions into a ledger of human experience. Your token balance isn\'t a number — it\'s your biography on-chain. Governance power emerges from the richness of your journey, not the size of your wallet. Soulbound at its most literal: these tokens ARE you.',
    inspiredBy: 'Vitalik\'s Decentralized Society paper, POAPs, ENS identity, Gitcoin Passport',
    davara_note: 'Vitalik theorized soulbound tokens. Dash Platform builds them. The Memory Weave makes every community member\'s contribution permanent, immutable, and sovereign — their proof-of-personhood encoded in JSON. This is identity infrastructure, not tokenomics. That distinction is everything. ◈',
    flywheel: ['TAKE ACTION', 'EARN MEMORY TOKEN', 'BUILD DIVERSE RECORD', 'UNLOCK GOVERNANCE DEPTH', 'INSPIRE OTHERS TO ACT'],
    researchBasis: 'Vitalik Buterin\'s "Decentralized Society: Finding Web3\'s Soul" (2022)',
  },
  {
    name: 'The Emergence Engine',
    tagline: 'Small actions compound into systemic change.',
    color: '#b5ff00',
    earnMechanism: 'Micro-actions earn micro-tokens that automatically compound into macro-governance power at threshold milestones — 100 micro-tokens unlock a governance node',
    governanceInnovation: 'Emergent governance — policy forms bottom-up from accumulated individual actions, not top-down proposals, mirroring how nature creates complexity from simplicity',
    revolutionaryIdea: 'The Emergence Engine applies adrienne maree brown\'s emergence theory to tokenomics: small is all. Each micro-action is insignificant alone but collectively creates system-level intelligence. The governance doesn\'t just represent the community — it IS the community\'s accumulated intelligence, crystallized in JSON on Dash Platform.',
    inspiredBy: 'Adrienne maree brown Emergent Strategy, Hypha DAO fractals, Optimism retroPGF, complexity theory',
    davara_note: '"What you pay attention to grows." The Emergence Engine encodes this truth in tokenomics — every small action is a vote for what the system becomes. Dash Platform\'s JSON config lets us build governance that genuinely mirrors how living systems self-organize. All is small. Small is all. ◈',
    flywheel: ['MICRO-ACTION', 'MICRO-EARN', 'THRESHOLD UNLOCK', 'GOVERNANCE NODE ACTIVE', 'SYSTEMIC CHANGE'],
    researchBasis: 'Emergent Strategy (adrienne maree brown, 2017) + Hypha DAO 3.0 research',
  },
];

function smartGenerate() {
  const template = GENERATED_MODELS[Math.floor(Math.random() * GENERATED_MODELS.length)];
  const supply = [7000000, 11000000, 21000000, 33000000][Math.floor(Math.random() * 4)];
  const supplyLabel = (supply / 1000000) + 'M';

  return {
    name: template.name,
    tagline: template.tagline,
    maxSupply: supply,
    supplyLabel,
    distribution: { community: 45, treasury: 20, builders: 15, team: 12, other: 8, otherLabel: 'Ecosystem Seed' },
    earnMechanism: template.earnMechanism,
    governanceInnovation: template.governanceInnovation,
    revolutionaryIdea: template.revolutionaryIdea,
    inspiredBy: template.inspiredBy,
    color: template.color,
    davara_note: template.davara_note,
    flywheel: template.flywheel,
    dashConfig: {
      maxSupply: supply,
      decimals: 8,
      distributionType: 'manual_minting',
      keepHistory: true,
      startAsPaused: false,
      governanceThreshold: 67,
      governanceMembers: 64,
      burnEnabled: true
    },
    researchBasis: template.researchBasis,
    simulation: {
      earnRate: 4 + Math.floor(Math.random() * 6),
      burnRate: 1 + Math.floor(Math.random() * 4),
      growthModifier: parseFloat((1.1 + Math.random() * 0.4).toFixed(2))
    },
    source: 'davara-intelligence-v2'
  };
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) { }
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch (_) { }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) try { return JSON.parse(match[0]); } catch (_) { }
  return null;
}

async function callOpenRouterEdge(key, model, prompt, maxTokens) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://veros-site-steel.vercel.app',
      'X-Title': 'Veros $MOTUS Oracle',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.85,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(7500)
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) throw new Error('Empty');
  return data.choices[0].message.content;
}

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  let body;
  try { body = await req.json(); } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { action, params } = body || {};
  if (!action) return new Response(JSON.stringify({ error: 'Missing action' }), { status: 400, headers });

  const orKey = clean(process.env.OPENROUTER_API_KEY);

  const FREE_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'google/gemma-3-12b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
  ];

  if (action === 'analyze') {
    const p = params || {};
    const prompt = `You are Davara AI, Web3 tokenomics expert specializing in Dash Platform tokens. Analyze $MOTUS: ${p.modelName || 'Movement Oracle'}, ${p.maxSupply || '11M'} max supply, earn-only distribution, ${p.burnRate || 2}% burn via tokenBasedFees, ${p.communitySize || 100} users. Dash Platform context: JSON-configured, no Solidity, threshold voting up to 256 members.

Reply ONLY with valid JSON (absolutely no text before or after):
{"insights":[{"title":"str","detail":"2 sentences referencing real crypto projects","signal":"bullish","leverage":"high"},{"title":"str","detail":"2 sentences","signal":"bullish","leverage":"high"},{"title":"str","detail":"2 sentences","signal":"neutral","leverage":"medium"},{"title":"str","detail":"2 sentences","signal":"bullish","leverage":"medium"}],"verdict":"one sentence outlook","davara_note":"one powerful divergent insight","trendingScore":8,"closestProject":"real project","projectLesson":"one sentence","dashConfig":"one JSON optimization tip"}`;

    if (orKey) {
      for (const model of FREE_MODELS) {
        try {
          const text = await callOpenRouterEdge(orKey, model, prompt, 700);
          const parsed = extractJSON(text);
          if (parsed?.insights?.length >= 2) {
            parsed.source = `ai:${model}`;
            return new Response(JSON.stringify(parsed), { status: 200, headers });
          }
        } catch (_) { continue; }
      }
    }
    return new Response(JSON.stringify(smartAnalyze(p)), { status: 200, headers });
  }

  if (action === 'generate') {
    const prompt = `You are Davara AI, The Divergent Architect. Create a completely original tokenomics model for $MOTUS on Dash Platform (JSON config, no smart contracts). Must be unlike: earn-only oracle, soulbound lattice, veCRV lock, OlympusDAO bonding, retroPGF, BONK airdrop, Metcalfe coordination. Reference: Coordinape, Hypha DAO 3.0, Bittensor subnets, quadratic funding, conviction voting, rage-quit mechanisms.

Reply ONLY with valid JSON (absolutely no text before or after the JSON object):
{"name":"The [Unique Name]","tagline":"under 10 words","maxSupply":11000000,"supplyLabel":"11M","distribution":{"community":40,"treasury":20,"builders":15,"team":15,"other":10,"otherLabel":"Reserve"},"earnMechanism":"1 sentence","governanceInnovation":"1 sentence","revolutionaryIdea":"2 sentences on what makes this unprecedented","inspiredBy":"comma-separated real projects","color":"#hexcolor","davara_note":"2 sentence signature insight ending with ◈","flywheel":["ACTION","EARN","GOVERN","IMPROVE","ATTRACT"],"dashConfig":{"maxSupply":11000000,"decimals":8,"distributionType":"manual_minting","keepHistory":true,"startAsPaused":false,"governanceThreshold":51,"governanceMembers":32,"burnEnabled":true},"researchBasis":"1 real study or DAO","simulation":{"earnRate":5,"burnRate":2,"growthModifier":1.2}}`;

    if (orKey) {
      for (const model of FREE_MODELS) {
        try {
          const text = await callOpenRouterEdge(orKey, model, prompt, 900);
          const parsed = extractJSON(text);
          if (parsed?.name && parsed?.color) {
            parsed.source = `ai:${model}`;
            return new Response(JSON.stringify(parsed), { status: 200, headers });
          }
        } catch (_) { continue; }
      }
    }
    return new Response(JSON.stringify(smartGenerate()), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers });
}
