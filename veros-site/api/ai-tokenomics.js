const https = require('https');

// Model chain: Try Claude Opus via Anthropic first, fallback to OpenRouter free models
const MODELS = [
  { provider: 'anthropic', model: 'claude-opus-4-6' },
  { provider: 'openrouter', model: 'google/gemma-3-27b-it:free' },
  { provider: 'openrouter', model: 'google/gemma-3-12b-it:free' },
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  { provider: 'openrouter', model: 'qwen/qwen3-8b:free' },
];

async function callAPI(prompt, maxTokens = 1500) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  for (const { provider, model } of MODELS) {
    try {
      let result;
      if (provider === 'anthropic' && anthropicKey) {
        result = await callAnthropic(anthropicKey, model, prompt, maxTokens);
      } else if (provider === 'openrouter' && openrouterKey) {
        result = await callOpenRouter(openrouterKey, model, prompt, maxTokens);
      } else {
        continue;
      }
      if (result) return result;
    } catch (e) {
      // Try next model
      continue;
    }
  }
  throw new Error('All models exhausted');
}

function callAnthropic(apiKey, model, prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content[0].text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callOpenRouter(apiKey, model, prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85
    });
    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://veros-site-steel.vercel.app',
        'X-Title': 'Veros $MOTUS Tokenomics',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(JSON.stringify(parsed.error)));
          if (!parsed.choices || !parsed.choices[0]) return reject(new Error('No choices'));
          resolve(parsed.choices[0].message.content);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch (_) {}
  // Extract from markdown code blocks
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch (_) {}
  // Find first {...} block
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
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'Davara is offline — no API keys configured' });
  }

  let prompt = '';

  if (action === 'analyze') {
    prompt = `You are Davara AI, The Divergent Architect — the world's most creative Web3 tokenomics strategist specializing in Dash Platform tokens.

Analyze these $MOTUS tokenomics parameters:
- Model: ${params?.modelName || 'Movement Oracle'}
- Max Supply: ${params?.maxSupply || '11M'} (Dash Platform JSON: "maxSupply")
- Community Size: ${params?.communitySize || 100} active participants
- Daily Actions: ${params?.dailyActions || 2} per user
- Earn Rate: ${params?.earnRate || 5} $MOTUS per action
- Burn Rate: ${params?.burnRate || 2}% (Dash Platform: "tokenBasedFees" burn setting)
- Distribution: ${params?.distribution || '40% earn, 20% treasury, 15% builders, 15% team, 10% liquidity'}

Dash Platform context: $MOTUS is configured entirely in JSON (no Solidity, no smart contracts). It uses "distributionType", "keepHistory", "decimals", "maxSupply", "startAsPaused", and group authorization with threshold voting (up to 256 members, 65,536 power each).

Give 4 sharp, non-obvious, high-leverage insights. Reference real crypto projects. Think like the world's most divergent tokenomics architect.

Respond ONLY with valid JSON (no markdown, no code blocks, no extra text):
{"insights":[{"title":"string","detail":"2 sentences max","signal":"bullish|bearish|neutral","leverage":"high|medium|low"}],"verdict":"one sentence summary","davara_note":"one powerful closing insight","trendingScore":8,"closestProject":"project name","projectLesson":"one sentence on why it worked or failed","dashConfig":"one sentence Dash Platform JSON optimization tip"}`;

  } else if (action === 'generate') {
    prompt = `You are Davara AI, The Divergent Architect. Generate a completely new, wildly creative tokenomics model for $MOTUS on Dash Platform.

$MOTUS context: Community governance token earned through movement/action. Built on Dash Platform using JSON config (no smart contracts needed). Vision: Votus democratic units, emergent strategy, values in motion. Current supply cap: 11M. Deploy cost: 0.1 DASH.

Dash Platform token fields available: maxSupply, decimals, distributionType (manual_minting|programmed|perpetual), keepHistory, startAsPaused, baseSupply, tokenBasedFees (for burns), group authorization with threshold voting.

Create something NOBODY in crypto has done before. Think: What's the most outlier, paradigm-breaking tokenomics model for a community movement token? Reference what worked in Solana memecoins (BONK airdrop, WIF community), DeFi governance (veCRV, retroPGF), or emerging models (soulbound tokens, Coordinape, Metcalfe coordination).

Respond ONLY with valid JSON (no markdown, no code blocks, no extra text):
{
  "name": "The [Creative Name]",
  "tagline": "short punchy tagline under 10 words",
  "maxSupply": 11000000,
  "supplyLabel": "11M",
  "distribution": {"community": 40, "treasury": 20, "builders": 15, "team": 15, "other": 10, "otherLabel": "Liquidity"},
  "earnMechanism": "1 sentence describing how tokens are earned",
  "governanceInnovation": "1 sentence on the governance breakthrough",
  "revolutionaryIdea": "2 sentences on what nobody else is doing",
  "inspiredBy": "comma-separated real projects",
  "color": "#hexcolor",
  "davara_note": "2 sentence Davara signature insight",
  "flywheel": ["STEP 1 ACTION", "STEP 2 RESULT", "STEP 3 AMPLIFY", "STEP 4 ATTRACT", "STEP 5 CYCLE"],
  "dashConfig": {
    "maxSupply": 11000000,
    "decimals": 8,
    "distributionType": "manual_minting",
    "keepHistory": true,
    "startAsPaused": false,
    "governanceThreshold": 51,
    "governanceMembers": 32,
    "burnEnabled": true
  },
  "researchBasis": "1 real study or project that supports this model",
  "simulation": {"earnRate": 5, "burnRate": 2, "growthModifier": 1.2}
}`;

  } else {
    return res.status(400).json({ error: 'Unknown action' });
  }

  try {
    const text = await callAPI(prompt, action === 'generate' ? 1800 : 1400);
    const parsed = extractJSON(text);
    if (parsed) {
      return res.status(200).json(parsed);
    }
    // Return raw if JSON parse fails
    return res.status(200).json({ raw: text, error: 'JSON parse failed — raw response included' });
  } catch (e) {
    return res.status(500).json({
      error: `Davara is temporarily offline: ${e.message}`,
      hint: 'All model providers failed. Check API key credits.'
    });
  }
};
