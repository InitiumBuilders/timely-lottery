module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const orKey = process.env.OPENROUTER_API_KEY || '';
  const antKey = process.env.ANTHROPIC_API_KEY || '';
  res.json({
    hasORKey: orKey.length > 10,
    hasANTKey: antKey.length > 10,
    orKeyPrefix: orKey.slice(0,12),
    antKeyPrefix: antKey.slice(0,12),
    nodeVersion: process.version,
    env: Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')).join(', ')
  });
};
