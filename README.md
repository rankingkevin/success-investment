# 희희부부의 성공투자 🏆

Gemini AI + Google Search Grounding 기반 실시간 투자 분석 대시보드

## 기능
- 📊 **대시보드**: 섹터 히트맵, 핫키워드 Top10, 시장 온도계, 오늘의 추천종목
- 🌍 **마켓이슈**: 글로벌 빅뉴스 5개 + 시장 영향 분석
- 📋 **주간리포트**: KOSPI + 미국증시 통합 분석 + ETF 추천
- ⭐ **관심종목**: 개별 종목 트렌드 + 매수 타이밍 분석

## 배포 방법

### 1. GitHub 레포 생성
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/success-investment.git
git push -u origin main
```

### 2. Vercel 환경변수 설정
Vercel 대시보드 → 프로젝트 → Settings → Environment Variables

| 변수명 | 값 |
|--------|-----|
| `GEMINI_API_KEY` | 발급받은 Gemini API 키 |

### 3. Vercel 배포
- Vercel에서 GitHub 레포 Import
- Framework: Other
- Root Directory: ./
- 자동 배포 완료

## 기술 스택
- Frontend: Vanilla HTML/CSS/JS
- Backend: Vercel Serverless Functions
- AI: Gemini 2.5 Flash + Google Search Grounding
- 주가: Yahoo Finance API
