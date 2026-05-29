export const maxDuration = 60; // Vercel 타임아웃 60초로 확장

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

  // 50초 AbortController (Vercel 60초 한도 내 안전 마진)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096, // 8192→4096 줄여서 응답속도 개선
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '분석 시간이 초과되었습니다 (50초). 다시 시도해주세요.' });
    }
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
