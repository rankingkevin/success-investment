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
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    // gemini-2.5-flash 단일 모델, googleSearch 제거 (MAX_TOKENS 원인)
    // 검색 대신 프롬프트에 최신 정보 요청으로 대체
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 8192, // 4096 → 8192 (MAX_TOKENS 오류 해결)
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
      const errText = await response.text();
      console.error(`gemini-2.5-flash error ${response.status}:`, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();

    // MAX_TOKENS 체크: 잘렸어도 부분 텍스트 사용
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('') || '';

    console.log(`finishReason: ${finishReason}, textLength: ${text.length}, type: ${type}`);

    if (!text) {
      console.error('Empty response:', JSON.stringify(data).slice(0, 400));
      return res.status(500).json({ error: `응답이 비어있습니다 (finishReason: ${finishReason})` });
    }

    // MAX_TOKENS로 잘렸으면 경고 포함해서 반환 (파싱 시도는 계속)
    return res.status(200).json({
      result: text,
      type,
      model: 'gemini-2.5-flash',
      truncated: finishReason === 'MAX_TOKENS',
    });

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '분석 시간 초과 (55초). 다시 시도해주세요.' });
    }
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
