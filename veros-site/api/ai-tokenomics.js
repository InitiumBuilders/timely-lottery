// Vercel Edge Runtime — no cold starts, longer execution window
export const config = { runtime: 'edge' };

function clean(key) {
  return (key || '').replace(/[^\x20-\x7E]/g, '').trim();
}

// ─── Davara's Brain: Research Library ───────────────────────────────────────
// Real DAO research that informs every analysis and generation
const DAVARA_RESEARCH = {
  provenModels: [
    { name: 'BONK', insight: 'Airdropped to Solana NFT holders, revived an entire ecosystem. Community > VCs. 72B tokens, $0.000001 floor, now $500M+ market cap. Lesson: Radical distribution beats fair launches.' },
    { name: 'veCRV (Curve)', insight: 'Vote-escrowed tokens create permanent long-term alignment. $3B TVL locked. 4-year locks = 4-year stakeholders. Lesson: Time-lock transforms speculation into stewardship.' },
    { name: 'Optimism retroPGF', insight: '$90M+ in retroactive public goods funding. Fund what worked, not what might work. Lesson: Retroactive rewards create self-fulfilling prophecies of value.' },
    { name: 'Coordinape', insight: 'Peer-to-peer gift circles. Circle members allocate GIVE tokens to each other. No hierarchy, no managers. Lesson: Horizontal compensation eliminates capture.' },
    { name: 'Hypha DAO 3.0', insight: 'Membranic fractal governance — cells within cells, each self-organizing. Biodiversity of token types (voice, seed, utility). Lesson: Living systems don\'t have org charts.' },
    { name: 'Bittensor subnets', insight: 'Specialized subnet economies with $TAO emission flowing to highest-performing subnets. Competition drives innovation. Lesson: Markets within systems create adaptive intelligence.' },
    { name: 'Nouns DAO', insight: 'One Noun per day, forever. 100% of proceeds to treasury. Governance NFT = 1 vote. Lesson: Infinite games beat finite fundraises.' },
    { name: 'STEPN', insight: 'Move-to-earn peaked then collapsed when earn rate exceeded burn rate. $3B market cap to $200M. Lesson: Supply mechanics MUST outpace demand or the model eats itself.' },
    { name: 'Gitcoin QF', insight: 'Quadratic funding — match contributions based on number of unique donors, not amount. Democratic capital allocation. Lesson: Voice matters more than wealth.' },
    { name: 'OlympusDAO', insight: '(3,3) bonding mechanism created a self-referential value loop. Failed when reflexivity broke. Lesson: Ponzinomics work until they don\'t — build fundamentals first.' },
  ],
  dashAdvantages: [
    'JSON configuration — no Solidity, no audit risk, no deploy cost',
    'Built-in threshold voting (up to 256 members, configurable power per member)',
    'keepHistory: true = immutable audit trail for every token action',
    'Optional PrivateSend integration = privacy-preserving governance',
    'DPNS identity layer = every token holder has a verifiable identity',
    'Token-based fees create native burn mechanics without smart contracts',
    'startAsPaused: true = controlled genesis, no panic sells at launch',
    'Perpetual distribution = programmable emission curves in JSON',
    'No gas wars, no MEV, no front-running — deterministic execution',
  ],
  divergentFrameworks: [
    'Leverage points (Donella Meadows): Rules > Goals > Information flows > Structure',
    'Emergent Strategy (adrienne maree brown): Small is all. Pattern of the whole in each part.',
    'Conviction voting: Stake accumulates over time, not just at vote time',
    'Rage-quit: If you lose a vote, you can exit with your proportional assets',
    'Futarchy: Bet on outcomes, governance follows the market',
    'Holacracy tokenomics: Roles, not people, hold governance power',
    'Membrane theory: Semi-permeable governance — different access at different depths',
  ],
};

// ─── Smart Local Analysis ─────────────────────────────────────────────────────
function smartAnalyze(params) {
  const p = params || {};
  const modelName = p.modelName || '$MOTUS';
  const supply = p.maxSupply || '11M';
  const burn = p.burnRate || 2;
  const users = p.communitySize || 100;
  const earnRate = p.earnRate || 5;

  const score = Math.min(9.5, Math.max(5, 6.5 + Math.floor(users / 400)));

  const insights = [
    {
      title: 'The Scarcity–Activity Coupling Advantage',
      detail: `With ${supply} max supply and pure earn-only entry, ${modelName} creates a supply curve that IS the activity curve — speculation becomes architecturally impossible. STEPN had the same instinct but let speculators buy in; $MOTUS doesn't have that vulnerability by design.`,
      signal: 'bullish',
      leverage: 'high',
    },
    {
      title: `Burn Rate Compounding (${burn}% → Deflationary Pressure)`,
      detail: `At ${burn}% burn via Dash Platform tokenBasedFees, with ${users} active users each transacting daily, the effective annual supply reduction accelerates with adoption — mirroring Render Network's Burn-and-Mint equilibrium but with zero smart contract risk.`,
      signal: 'bullish',
      leverage: 'high',
    },
    {
      title: 'Governance Moat: JSON vs. Solidity',
      detail: `Dash Platform's threshold voting with JSON config means zero exploit surface. Compound lost $70M to a governance attack; Aragon spent years auditing contracts. $MOTUS governance has no attack vector — the moat is architectural, not procedural.`,
      signal: 'bullish',
      leverage: 'high',
    },
    {
      title: `Community Velocity Risk at ${users} Participants`,
      detail: `${users} active users creates thin liquidity and fragile governance quorum. BONK seeded 50,000+ Solana NFT holders before launch — consider a retroactive DPNS airdrop to existing Dash ecosystem members to catalyze critical mass before activation.`,
      signal: users < 200 ? 'neutral' : 'bullish',
      leverage: 'medium',
    },
  ];

  const closestProject = users < 150 ? 'Coordinape (gift circles, small community)' : 'STEPN + veCRV hybrid';
  const projectLesson = users < 150
    ? 'Coordinape proved micro-communities can sustain meaningful governance with 20-50 active participants — scale is optional, alignment is mandatory.'
    : 'STEPN proved earn-only creates powerful retention but failed when earn rate outpaced burn — $MOTUS solves this with JSON-configurable mechanics on Dash Platform.';

  return {
    insights,
    verdict: `${modelName} is structurally anti-fragile: a ${supply} earn-only token with ${burn}% burn on Dash Platform is the most defensible tokenomics architecture in the current market — impossible to front-run, impossible to speculate on, and impossible to exploit without a governance majority.`,
    davara_note: `The most radical tokenomics are the most boring ones. No bonding curves, no ve-locks, no reflexive game theory — just earn it, govern with it, burn some. When the supply curve equals the activity curve, the market cannot diverge from reality. That is not a feature. It is a law of nature encoded in JSON. ◈`,
    trendingScore: score,
    closestProject,
    projectLesson,
    dashConfig: `Recommendation: Set startAsPaused: true at genesis, then unpause after first 32 governance members are verified via DPNS. Use keepHistory: true for all mints — this becomes your proof-of-work ledger and the foundation of your reputation layer.`,
    researchSources: DAVARA_RESEARCH.provenModels.slice(0, 3).map(m => m.name).join(', '),
    source: 'davara-intelligence-v3',
  };
}

// ─── Smart Local Generation ───────────────────────────────────────────────────
const GENERATED_MODELS = [
  {
    name: 'The Resonance Protocol',
    tagline: 'Tokens crystallized from synchronized collective action.',
    color: '#00f5d4',
    earnMechanism: 'Earned when actions are synchronized across 3+ community members within the same 24-hour window — solo actions earn 1x base rate, synchronized actions earn 3x Resonance Bonus',
    governanceInnovation: 'Proposals require resonant approval from members across 3+ distinct timezone clusters — governance literally requires the community to move together across geography',
    revolutionaryIdea: 'The Resonance Protocol inverts every assumption: tokens are not rewards for individual action, they are crystallized proof of collective coordination. The rarer the coordination, the more tokens crystallize — Metcalfe\'s Law encoded into the minting contract. No other protocol in crypto rewards the ACT of connecting, not just the act of contributing.',
    inspiredBy: 'Coordinape gift circles, Hypha DAO 3.0 membranic governance, Metcalfe\'s Law, Nouns DAO infinite game',
    davara_note: 'The Resonance Protocol answers a question nobody asked: what if tokens were proof of human connection, not human labor? Dash Platform\'s JSON governance makes this possible without a line of Solidity — the coordination mechanism IS the token IS the governance. This is Web3\'s missing primitive. ◈',
    flywheel: ['CONNECT WITH OTHERS', 'EARN 3X RESONANCE BONUS', 'POOL GOVERNANCE POWER', 'COORDINATE PROPOSALS', 'ATTRACT MORE CONNECTORS'],
    researchBasis: 'Hypha DAO 3.0 membranic governance + Coordinape peer gift circles (2023-2025)',
    supply: 11000000,
  },
  {
    name: 'The Memory Weave',
    tagline: 'Every move permanently woven into the sovereign chain.',
    color: '#ff006e',
    earnMechanism: 'Non-transferable memory tokens issued for every verified community action — each token carries metadata of what was done, when, and by which DPNS identity, building a permanent reputation lattice',
    governanceInnovation: 'Governance weight is calculated by the diversity of your action types, not volume — a person with 10 different contribution types outweighs someone with 100 identical ones. Breadth defeats depth. Whale capture becomes impossible.',
    revolutionaryIdea: 'The Memory Weave transforms blockchain from a ledger of transactions into a ledger of human experience. Your token balance isn\'t a number — it\'s your on-chain biography. Governance power emerges from the richness of your journey, not the size of your wallet. Soulbound at its most literal: these tokens ARE you.',
    inspiredBy: 'Vitalik\'s Decentralized Society paper, POAPs, ENS identity, Gitcoin Passport, Lens Protocol profiles',
    davara_note: 'Vitalik theorized soulbound tokens. Dash Platform builds them. The Memory Weave makes every contribution permanent, immutable, and sovereign — your proof-of-personhood encoded in JSON without a single smart contract. This is identity infrastructure disguised as tokenomics. That distinction is the entire thesis. ◈',
    flywheel: ['TAKE ACTION', 'EARN MEMORY TOKEN', 'BUILD DIVERSE RECORD', 'UNLOCK GOVERNANCE DEPTH', 'INSPIRE OTHERS TO ACT'],
    researchBasis: 'Vitalik Buterin "Decentralized Society: Finding Web3\'s Soul" (2022) + Gitcoin Passport sybil resistance',
    supply: 100000000,
  },
  {
    name: 'The Emergence Engine',
    tagline: 'Small actions compound into systemic leverage.',
    color: '#b5ff00',
    earnMechanism: 'Micro-actions earn micro-tokens that automatically compound into macro-governance power at milestone thresholds — 100 micro-tokens unlock a governance node, 1000 unlock a council seat, no minimum buy-in ever',
    governanceInnovation: 'Emergent governance — policy forms bottom-up from accumulated individual micro-actions, not top-down proposals. The system\'s intelligence IS the accumulated pattern of its members\' contributions.',
    revolutionaryIdea: 'The Emergence Engine applies adrienne maree brown\'s emergence theory to tokenomics: small is all. Each micro-action is insignificant alone but collectively creates system-level intelligence. The governance doesn\'t just represent the community — it IS the community\'s accumulated wisdom, crystallized in JSON on Dash Platform.',
    inspiredBy: 'adrienne maree brown Emergent Strategy, Hypha DAO 3.0 fractals, Optimism retroPGF, complexity theory, murmuration dynamics',
    davara_note: '"What you pay attention to grows." The Emergence Engine encodes this truth in tokenomics — every small action is a vote for what the system becomes. Dash Platform\'s JSON config lets us build governance that genuinely mirrors how living systems self-organize. All is small. Small is all. The pattern of the whole is in each part. ◈',
    flywheel: ['MICRO-ACTION', 'MICRO-EARN', 'THRESHOLD UNLOCK', 'GOVERNANCE NODE ACTIVE', 'SYSTEMIC CHANGE EMERGES'],
    researchBasis: 'Emergent Strategy (adrienne maree brown, 2017) + Donella Meadows Leverage Points + complexity theory',
    supply: 7000000,
  },
  {
    name: 'The Conviction Lattice',
    tagline: 'Time-weighted belief made into governance power.',
    color: '#f59e0b',
    earnMechanism: 'Tokens earned through actions, but governance power accumulates as a function of time held — the longer you stake your earned tokens on a proposal, the more weight your vote carries. Conviction is staked, not just cast.',
    governanceInnovation: 'Conviction voting with Dash Platform threshold groups — proposals only pass when cumulative conviction (weight × time) exceeds a configurable threshold. No vote sniping, no last-minute flips, no whale rushes.',
    revolutionaryIdea: 'The Conviction Lattice transforms governance from a moment into a process. In standard voting, a whale can buy tokens and win in 24 hours. In the Conviction Lattice, that whale needs to have HELD those tokens for months to accumulate enough conviction weight to matter. Time becomes the ultimate sybil resistance.',
    inspiredBy: '1Hive Gardens conviction voting, Aragon Futarchy experiments, veCRV time-lock mechanics, MolochDAO rage-quit',
    davara_note: 'Most governance fails because it rewards presence, not commitment. The Conviction Lattice is the first system where you literally cannot win a vote you don\'t deeply believe in — because belief requires time, and time is the one thing you cannot buy. Built on Dash Platform JSON, this is the first conviction system without smart contract risk. ◈',
    flywheel: ['EARN TOKENS', 'STAKE ON PROPOSALS', 'CONVICTION ACCUMULATES', 'WIN BY COMMITMENT', 'ALIGNED GOVERNANCE'],
    researchBasis: '1Hive Gardens Conviction Voting research (2021) + Commons Stack',
    supply: 21000000,
  },
  {
    name: 'The Fractal Cooperative',
    tagline: 'Cells within cells, each a sovereign commonwealth.',
    color: '#8b5cf6',
    earnMechanism: 'Earned at the local cell level (a Votus Unit = 3-50 people). Each cell mints its own micro-supply. The global $MOTUS pool is a federation of cell treasuries — bottom-up, fractal, living.',
    governanceInnovation: 'Fractal governance: each Votus Unit is a self-governing cell with its own threshold (configurable 51-100%). Cells coordinate at the network level via a federation council. No central authority. Structure emerges from relationship.',
    revolutionaryIdea: 'The Fractal Cooperative is not a DAO — it\'s a network of cooperatives that share a token standard. Each cell governs itself with Dash Platform\'s JSON threshold groups. The global token is a coordination layer, not a control layer. This mirrors how mycorrhizal networks share resources without a central node.',
    inspiredBy: 'Hypha DAO 3.0 membranic fractals, adrienne maree brown emergence, Platform Cooperativism (Trebor Scholz), Enspiral Network',
    davara_note: 'The most durable systems in nature are not hierarchies — they\'re federations of self-organizing cells. The Fractal Cooperative applies this to tokenomics for the first time at scale: each Votus Unit is a sovereign cell, each cell is a governance unit, and the federation is what emerges. Dash Platform\'s JSON threshold groups make this architecturally possible without a blockchain lawyer. ◈',
    flywheel: ['FORM A VOTUS UNIT', 'EARN LOCAL $MOTUS', 'GOVERN YOUR CELL', 'FEDERATE WITH OTHERS', 'EMERGENT NETWORK'],
    researchBasis: 'Platform Cooperativism (Trebor Scholz) + Enspiral Network + Hypha DAO 3.0',
    supply: 33000000,
  },
];

function smartGenerate() {
  const template = GENERATED_MODELS[Math.floor(Math.random() * GENERATED_MODELS.length)];
  const supplyLabel = template.supply >= 1000000 ? (template.supply / 1000000) + 'M' : template.supply.toLocaleString();
  const govMembers = [16, 32, 48, 64][Math.floor(Math.random() * 4)];
  const govThreshold = [51, 55, 60, 67][Math.floor(Math.random() * 4)];
  const burnRate = Math.floor(Math.random() * 4) + 1;
  const earnRate = Math.floor(Math.random() * 6) + 3;

  return {
    name: template.name,
    tagline: template.tagline,
    maxSupply: template.supply,
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
      maxSupply: template.supply,
      decimals: 8,
      distributionType: 'manual_minting',
      keepHistory: true,
      startAsPaused: true,
      governanceThreshold: govThreshold,
      governanceMembers: govMembers,
      burnEnabled: true,
      tokenBasedFeesPct: burnRate,
      notes: `startAsPaused:true — controlled genesis, unpause after ${govMembers} DPNS-verified members join. keepHistory:true — every mint is an audit trail. governanceThreshold:${govThreshold}% = ${govThreshold > 60 ? 'supermajority for high-stakes decisions' : 'simple majority for agile governance'}.`,
    },
    researchBasis: template.researchBasis,
    simulation: {
      earnRate,
      burnRate,
      growthModifier: parseFloat((1.1 + Math.random() * 0.5).toFixed(2)),
    },
    source: 'davara-intelligence-v3',
  };
}

// ─── JSON Extraction ──────────────────────────────────────────────────────────
function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) { }
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch (_) { }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) try { return JSON.parse(match[0]); } catch (_) { }
  return null;
}

// ─── OpenRouter Call ──────────────────────────────────────────────────────────
async function callOpenRouterEdge(key, model, prompt, maxTokens) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://veros-site-steel.vercel.app',
      'X-Title': 'Veros $MOTUS Davara Oracle',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.88,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(7500),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.choices?.[0]?.message?.content) throw new Error('Empty');
  return data.choices[0].message.content;
}

// ─── Edge Handler ─────────────────────────────────────────────────────────────
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
  const antKey = clean(process.env.ANTHROPIC_API_KEY);

  // Free model chain — ordered by quality + speed
  const FREE_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'google/gemma-3-12b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
  ];

  if (action === 'analyze') {
    const p = params || {};
    const researchContext = DAVARA_RESEARCH.provenModels.slice(0, 4).map(m => `${m.name}: ${m.insight}`).join('\n');
    const dashContext = DAVARA_RESEARCH.dashAdvantages.slice(0, 4).join('; ');

    const prompt = `You are Davara AI — The Divergent Architect. You are the world's most creative and rigorous tokenomics strategist, trained on every major DAO experiment from 2017-2025. You think divergently, draw non-obvious connections, and always ground insights in real data.

Analyze this $MOTUS tokenomics configuration built on Dash Platform:
- Model: ${p.modelName || 'Movement Oracle'}
- Max Supply: ${p.maxSupply || '11M'} tokens
- Community Size: ${p.communitySize || 100} active participants
- Daily Actions: ${p.dailyActions || 2} per user
- Earn Rate: ${p.earnRate || 5} $MOTUS per action
- Burn Rate: ${p.burnRate || 2}% (via Dash Platform tokenBasedFees)
- Distribution: ${p.distribution || '40% earn, 20% treasury, 15% builders, 15% team, 10% liquidity'}

Dash Platform context: ${dashContext}

Real DAO research for reference:
${researchContext}

Generate 4 sharp, non-obvious insights. Be specific. Reference real projects. Find the leverage points Donella Meadows would identify. Score trending potential 1-10.

Reply ONLY with valid JSON (no text before or after the JSON object):
{"insights":[{"title":"str","detail":"2 precise sentences referencing real crypto projects or research","signal":"bullish","leverage":"high"},{"title":"str","detail":"2 sentences","signal":"bullish","leverage":"high"},{"title":"str","detail":"2 sentences referencing a specific DAO failure or success","signal":"neutral","leverage":"medium"},{"title":"str","detail":"2 sentences with a specific non-obvious recommendation","signal":"bullish","leverage":"high"}],"verdict":"one sharp sentence on this model's structural advantage","davara_note":"one paradigm-shifting insight ending with ◈","trendingScore":8,"closestProject":"real project name","projectLesson":"one sentence on what that project proved or failed to prove","dashConfig":"one specific Dash Platform JSON optimization with field names"}`;

    if (orKey) {
      for (const model of FREE_MODELS) {
        try {
          const text = await callOpenRouterEdge(orKey, model, prompt, 900);
          const parsed = extractJSON(text);
          if (parsed?.insights?.length >= 2) {
            parsed.source = `ai:${model}`;
            return new Response(JSON.stringify(parsed), { status: 200, headers });
          }
        } catch (_) { continue; }
      }
    }

    // Anthropic fallback (if credits restored)
    if (antKey) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': antKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-6',
            max_tokens: 900,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const data = await resp.json();
          const text = data.content?.[0]?.text;
          if (text) {
            const parsed = extractJSON(text);
            if (parsed?.insights) {
              parsed.source = 'claude-haiku';
              return new Response(JSON.stringify(parsed), { status: 200, headers });
            }
          }
        }
      } catch (_) { /* fall through */ }
    }

    return new Response(JSON.stringify(smartAnalyze(p)), { status: 200, headers });
  }

  if (action === 'generate') {
    const researchSummary = DAVARA_RESEARCH.provenModels.slice(0, 5).map(m => m.name).join(', ');
    const frameworks = DAVARA_RESEARCH.divergentFrameworks.slice(0, 3).join('; ');

    const prompt = `You are Davara AI — The Divergent Architect, the world's most creative Web3 tokenomics designer. You have deep knowledge of every major DAO model: ${researchSummary}. You apply divergent frameworks: ${frameworks}.

Design a RADICALLY ORIGINAL tokenomics model for $MOTUS on Dash Platform. It must be fundamentally different from: pure earn-only, soulbound reputation, veCRV lock mechanics, OlympusDAO bonding, retroPGF, BONK airdrop, Metcalfe coordination, conviction voting, fractal cooperatives.

Dash Platform facts: JSON-configured tokens, no Solidity needed, threshold voting (up to 256 members), keepHistory for audit trails, optional privacy, DPNS identity, tokenBasedFees for burn mechanics.

Create something nobody has shipped yet. Think biological systems, information theory, physics metaphors, behavioral economics, game theory. Make it divergent.

Reply ONLY with valid JSON (no text before or after):
{"name":"The [Unique Poetic Name]","tagline":"punchy tagline under 10 words","maxSupply":11000000,"supplyLabel":"11M","distribution":{"community":40,"treasury":20,"builders":15,"team":15,"other":10,"otherLabel":"Reserve"},"earnMechanism":"1 precise sentence describing a genuinely novel earn mechanism","governanceInnovation":"1 sentence describing a genuinely novel governance breakthrough","revolutionaryIdea":"2 sentences explaining what makes this category-defining and why no one has done it","inspiredBy":"comma-separated real projects and researchers this draws from","color":"#hexcolor (make it vivid and distinct)","davara_note":"2 sentences — your signature divergent insight, end with ◈","flywheel":["STEP 1","STEP 2","STEP 3","STEP 4","STEP 5"],"dashConfig":{"maxSupply":11000000,"decimals":8,"distributionType":"manual_minting","keepHistory":true,"startAsPaused":true,"governanceThreshold":51,"governanceMembers":32,"burnEnabled":true},"researchBasis":"1 real study, paper, or DAO experiment that validates this approach","simulation":{"earnRate":5,"burnRate":2,"growthModifier":1.2}}`;

    if (orKey) {
      for (const model of FREE_MODELS) {
        try {
          const text = await callOpenRouterEdge(orKey, model, prompt, 1100);
          const parsed = extractJSON(text);
          if (parsed?.name && parsed?.color && parsed?.earnMechanism) {
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
