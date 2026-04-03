const https = require('https');

// Model chain: Try Anthropic Opus first (if credits available), then OpenRouter Gemma free
const MODEL_CHAIN = [
  {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    getKey: () => process.env.ANTHROPIC_API_KEY
  },
  {
    provider: 'openrouter',
    model: 'google/gemma-3-27b-it:free',
    getKey: () => process.env.OPENROUTER_API_KEY
  },
  {
    provider: 'openrouter',
    model: 'google/gemma-3-12b-it:free',
    getKey: () => process.env.OPENROUTER_API_KEY
  },
  {
    provider: 'openrouter',
    model: 'google/gemini-flash-1.5-8b:free',
    getKey: () => process.env.OPENROUTER_API_KEY
  }
];

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 120)}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function callAnthropic(key, model, prompt, maxTokens) {
  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });
  const data = await httpsPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(body)
  }, body);
  const parsed = JSON.parse(data);
  if (parsed.error) throw new Error(parsed.error.message);
  return parsed.content[0].text;
}

async function callOpenRouter(key, model, prompt, maxTokens) {
  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    temperature: 0.85,
    messages: [{ role: 'user', content: prompt }]
  });
  const data = await httpsPost('openrouter.ai', '/api/v1/chat/completions', {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    'HTTP-Referer': 'https://veros-site-steel.vercel.app',
    'X-Title': 'Veros $MOTUS Oracle',
    'Content-Length': Buffer.byteLength(body)
  }, body);
  const parsed = JSON.parse(data);
  if (parsed.error) throw new Error(JSON.stringify(parsed.error));
  if (!parsed.choices?.[0]?.message?.content) throw new Error('Empty response');
  return parsed.choices[0].message.content;
}

async function runWithFallback(prompt, maxTokens) {
  for (const { provider, model, getKey } of MODEL_CHAIN) {
    const key = getKey();
    if (!key) continue;
    try {
      if (provider === 'anthropic') return await callAnthropic(key, model, prompt, maxTokens);
      if (provider === 'openrouter') return await callOpenRouter(key, model, prompt, maxTokens);
    } catch (e) {
      // silently try next model
      continue;
    }
  }
  throw new Error('All AI models currently unavailable. Please try again shortly.');
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch (_) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) try { return JSON.parse(match[0]); } catch (_) {}
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, params } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Missing action' });

  let prompt = '';

  if (action === 'analyze') {
    const p = params || {};
    prompt = `You are Davara AI, The Divergent Architect — the world's most creative Web3 tokenomics strategist, expert in Dash Platform tokens.

Analyze these $MOTUS tokenomics parameters built on Dash Platform (JSON-configured, no Solidity):
- Model: ${p.modelName || 'Movement Oracle'}
- Max Supply: ${p.maxSupply || '11M'} tokens
- Community Size: ${p.communitySize || 100} active participants  
- Daily Actions: ${p.dailyActions || 2} per user
- Earn Rate: ${p.earnRate || 5} $MOTUS per action
- Burn Rate: ${p.burnRate || 2}% (via Dash Platform tokenBasedFees)
- Distribution: ${p.distribution || '40% earn, 20% treasury, 15% builders, 15% team, 10% liquidity'}

Dash Platform advantages: JSON config (no audit needed), built-in threshold governance (256 members max), keepHistory for immutable records, optional privacy via PrivateSend, DPNS identity layer.

Provide 4 sharp, non-obvious, high-leverage insights referencing real crypto projects. Think divergently.

Respond with ONLY valid JSON (no markdown, no explanation outside JSON):
{"insights":[{"title":"string","detail":"2 sentences max","signal":"bullish","leverage":"high"},{"title":"string","detail":"2 sentences","signal":"neutral","leverage":"medium"},{"title":"string","detail":"2 sentences","signal":"bullish","leverage":"high"},{"title":"string","detail":"2 sentences","signal":"bullish","leverage":"medium"}],"verdict":"one sentence summary of this model's outlook","davara_note":"one powerful divergent closing insight","trendingScore":8,"closestProject":"real project name","projectLesson":"one sentence on what that project proved","dashConfig":"one Dash Platform JSON optimization recommendation"}`;

  } else if (action === 'generate') {
    prompt = `You are Davara AI, The Divergent Architect. Generate a completely original tokenomics model for $MOTUS on Dash Platform that nobody has done before.

Context: $MOTUS = community governance token earned through movement/action. Dash Platform = JSON-configured tokens, no smart contracts, built-in threshold voting (up to 256 members), optional privacy, DPNS identity, keepHistory for audit trails. Current models: earn-only 11M supply, soulbound reputation, veCRV lock mechanics, OlympusDAO bonding, retroPGF impact, BONK viral airdrop, Metcalfe coordination bonus.

Create something RADICALLY different. Reference what worked: BONK (community airdrop revived Solana), veCRV (time-lock governance $3B), Optimism retroPGF ($90M impact rewards), Coordinape (peer gift circles), Hypha DAO 3.0 (membranic fractal governance).

Respond with ONLY valid JSON (no markdown, no text before or after the JSON):
{"name":"The [Unique Name]","tagline":"punchy tagline under 10 words","maxSupply":11000000,"supplyLabel":"11M","distribution":{"community":40,"treasury":20,"builders":15,"team":15,"other":10,"otherLabel":"Liquidity"},"earnMechanism":"1 sentence how tokens are earned","governanceInnovation":"1 sentence governance breakthrough","revolutionaryIdea":"2 sentences on what makes this category-defining","inspiredBy":"comma-separated real projects","color":"#hexcolor","davara_note":"2 sentence Davara signature insight about why this is outlier","flywheel":["ACTION","EARN","GOVERN","IMPROVE","ATTRACT"],"dashConfig":{"maxSupply":11000000,"decimals":8,"distributionType":"manual_minting","keepHistory":true,"startAsPaused":false,"governanceThreshold":51,"governanceMembers":32,"burnEnabled":true},"researchBasis":"1 real study or DAO that validates this approach","simulation":{"earnRate":5,"burnRate":2,"growthModifier":1.3}}`;

  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  try {
    const maxTokens = action === 'generate' ? 1800 : 1400;
    const text = await runWithFallback(prompt, maxTokens);
    const parsed = extractJSON(text);
    if (parsed) return res.status(200).json(parsed);
    // Couldn't parse JSON — return raw with warning
    return res.status(200).json({ raw: text, parseError: true });
  } catch (e) {
    return res.status(503).json({
      error: e.message,
      hint: 'Davara is resting. Try again in a moment.'
    });
  }
};
