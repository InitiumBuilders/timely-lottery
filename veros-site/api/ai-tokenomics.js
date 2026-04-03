module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, params } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Davara is offline — API key not configured' });

  let prompt = '';
  if (action === 'analyze') {
    prompt = `You are Davara AI, The Divergent Architect, world's most creative Web3 tokenomics strategist. 

Analyze these $MOTUS tokenomics parameters on Dash Platform:

Model: ${params.modelName || 'Movement Oracle'}
Max Supply: ${params.maxSupply || '11M'}
Community Size: ${params.communitySize || 100}
Daily Actions: ${params.dailyActions || 2}
Earn Rate: ${params.earnRate || 5} tokens/action
Burn Rate: ${params.burnRate || 2}%
Distribution: ${params.distribution || '40% earn, 20% treasury, 15% builders, 15% team, 10% liquidity'}

Give 4 sharp, non-obvious, high-leverage insights. Reference real crypto projects. Think like the world's most divergent tokenomics architect.

Also provide:
- trendingScore: 1-10 how aligned with current DeFi/governance trends
- closestProject: the real crypto project most similar to this config
- projectLesson: one sentence on why that project worked or failed
- dashConfig: a brief JSON snippet suggestion for optimizing this model on Dash Platform (as a string, not nested JSON)

Respond ONLY with valid JSON (no markdown, no code blocks):
{"insights": [{"title": "string", "detail": "string 2 sentences max", "signal": "bullish|bearish|neutral", "leverage": "high|medium|low"}], "verdict": "one sentence summary", "davara_note": "one powerful closing insight", "trendingScore": 8, "closestProject": "project name", "projectLesson": "one sentence", "dashConfig": "brief config suggestion string"}`;
  } else if (action === 'generate') {
    prompt = `You are Davara AI, The Divergent Architect. Generate a completely new, wildly creative tokenomics model for $MOTUS on Dash Platform. Create something NOBODY has done before.

Context: $MOTUS is a community governance token earned through movement/action, built on Dash Platform (JSON-configured, no smart contracts). Vision: Votus democratic units, emergent strategy, values in motion.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "name": "The [Creative Name]",
  "tagline": "short punchy tagline",
  "maxSupply": 11000000,
  "supplyLabel": "11M",
  "distribution": {"community": 40, "treasury": 20, "builders": 15, "team": 15, "other": 10, "otherLabel": "Liquidity"},
  "earnMechanism": "1 sentence",
  "governanceInnovation": "1 sentence",
  "revolutionaryIdea": "2 sentences max",
  "inspiredBy": "comma-separated projects",
  "color": "#hexcolor",
  "davara_note": "2 sentence signature insight",
  "simulation": {"earnRate": 5, "burnRate": 2, "growthModifier": 1.0},
  "dashConfig": {"maxSupply": 11000000, "decimals": 8, "distributionType": "manual_minting", "keepHistory": true, "startAsPaused": false, "governanceThreshold": 51, "governanceMembers": 32},
  "flywheel": ["STEP 1", "STEP 2", "STEP 3", "STEP 4", "STEP 5"]
}`;
  }

  try {
    const https = require('https');
    const body = JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const httpReq = https.request(options, (httpRes) => {
        let data = '';
        httpRes.on('data', chunk => data += chunk);
        httpRes.on('end', () => resolve(data));
      });
      httpReq.on('error', reject);
      httpReq.write(body);
      httpReq.end();
    });

    const parsed = JSON.parse(result);
    if (parsed.error) return res.status(500).json({ error: parsed.error.message });
    
    const content = parsed.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return res.status(200).json(JSON.parse(jsonMatch[0]));
    }
    return res.status(200).json({ raw: content });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
