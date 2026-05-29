export const maxDuration = 60;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    // 실제 사용 가능한 모델 목록 기반 (v1beta, generateContent 지원 확인됨)
    const MODELS = [
      { name: 'gemini-2.5-flash', search: true  },
      { name: 'gemini-2.0-flash', search: true  },
      { name: 'gemini-2.5-pro',   search: false },
    ];

    let lastError = null;
    let resultText = '';
    let usedModel = '';

    for (const m of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m.name}:generateContent?key=${apiKey}`;

      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        ...(m.search ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 4096,
        }
      };

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        lastError = `${m.name}: fetch 실패 - ${fetchErr.message}`;
        console.error(lastError);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        lastError = `${m.name}: HTTP ${response.status}`;
        console.error(`Model ${m.name} error ${response.status}:`, errText);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.filter(p => p.text)
        ?.map(p => p.text)
        ?.join('') || '';

      if (text) {
        resultText = text;
        usedModel = m.name;
        console.log(`✅ Success with model: ${m.name}`);
        break;
      } else {
        lastError = `${m.name}: 빈 응답`;
        console.error(`Empty response from ${m.name}:`, JSON.stringify(data).slice(0, 300));
      }
    }

    clearTimeout(timeout);

    if (!resultText) {
      return res.status(500).json({ error: `분석 실패: ${lastError || '알 수 없는 오류'}` });
    }

    return res.status(200).json({ result: resultText, type, model: usedModel });

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '분석 시간 초과 (50초). 다시 시도해주세요.' });
    }
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
