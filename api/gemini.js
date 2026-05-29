export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { prompt, type } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    // gemini-2.0-flash 은 안정적이고 googleSearch 지원
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API error:', err);
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('') || '';

    if (!text) {
      console.error('Empty response:', JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: '응답이 비어있습니다. 잠시 후 다시 시도해주세요.' });
    }

    return res.status(200).json({ result: text, type });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
