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
    // v1beta + gemini-2.5-flash-preview-05-20 : googleSearch 지원 최신 안정 모델
    // 만약 또 404나면 gemini-1.5-pro-latest 로 폴백
    const MODELS = [
      'gemini-2.5-flash-preview-05-20',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-001',
    ];

    let lastError = null;
    let text = '';

    for (const model of MODELS) {
      // 첫 모델만 googleSearch 시도, 나머지는 없이
      const useSearch = model === MODELS[0];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 4096,
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Model ${model} error ${response.status}:`, errText);
        lastError = `${model}: ${response.status}`;
        continue; // 다음 모델 시도
      }

      const data = await response.json();
      text = data?.candidates?.[0]?.content?.parts
        ?.filter(p => p.text)
        ?.map(p => p.text)
        ?.join('') || '';

      if (text) {
        console.log(`Success with model: ${model}`);
        break; // 성공하면 루프 종료
      } else {
        console.error(`Empty response from ${model}:`, JSON.stringify(data).slice(0, 300));
        lastError = `${model}: empty response`;
      }
    }

    clearTimeout(timeout);

    if (!text) {
      return res.status(500).json({ error: `모든 모델 시도 실패: ${lastError}` });
    }

    return res.status(200).json({ result: text, type });

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '분석 시간 초과 (50초). 다시 시도해주세요.' });
    }
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
