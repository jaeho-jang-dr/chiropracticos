# 아키텍처 — Chiropracticos

## 전체 시스템 구조

```
[사용자 브라우저]
      |
  [Vercel CDN]  ──────────────────────────────────────────────
      |                                                        |
  [HTML Pages]   ←── 정적 파일                    [Supabase]
  chapter01~13        (JS/CSS/HTML)              ├── Auth (Google/Naver/Kakao)
  index.html                                     ├── Postgres DB
  admin.html                                     └── RLS (Row Level Security)
      |
  [assets/]
  ├── auth-guard.js       → 미인증 시 login.html 리다이렉트
  ├── supabase-client.js  → Supabase 초기화
  └── download-guard.js   → 미디어 다운로드 방지
      |
  [Cloudflare R2]  ──────────────────────────────────────────
  pub-e44b...r2.dev
  ├── podcasts_v3/        → 챕터별 팟캐스트 .m4a (한국어)
  ├── videos/             → 강의 영상 .mp4
  └── slides/             → 강의 자료 .pdf
```

## 챕터 구성

| 챕터 | 파일 | 접근 | 팟캐스트 |
|------|------|------|---------|
| Ch01 | chapter01_introduction.html | 공개 | 없음 |
| Ch02 | chapter02_functional_neurology.html | 유료 | 4개 (한국어) |
| Ch03 | chapter03_diversified.html | 유료 | 4개 (한국어) |
| Ch04 | chapter04_gonstead.html | 유료 | 4개 (한국어) |
| Ch05~11 | chapter05~11_*.html | 유료 | 미정 |
| Ch12 | chapter12_ak.html | 유료 | 4개 (한국어) |
| Ch13 | chapter13_soft_tissue.html | 유료 | 없음 |

## 팟캐스트 생성 파이프라인

```
사용자 → Antigravity (계획)
  → Claude Code: nlm 명령 실행 (NotebookLM API)
  → NLM이 오디오 생성 (비동기, 수 분 소요)
  → Claude Code: R2 업로드 (wrangler r2 object put)
  → Antigravity: HTML 버전 파라미터 업데이트
  → deploy.sh: Git push + Vercel 배포
```

## 데이터 흐름 (Auth)

```
방문자 → index.html (공개)
로그인 → login.html → Supabase OAuth → auth-callback.html
         → Supabase DB: user role 확인
인증됨 → chapter.html (auth-guard.js 통과)
미인증 → login.html 리다이렉트
```

## 핵심 환경변수 (.env)

```
SUPABASE_URL=           # Supabase 프로젝트 URL
SUPABASE_ANON_KEY=      # 공개 anon key
R2_ENDPOINT=            # Cloudflare R2 엔드포인트
R2_ACCESS_KEY_ID=       # R2 액세스 키
R2_SECRET_ACCESS_KEY=   # R2 비밀 키
R2_BUCKET=chiropracticos-media
NLM_API_KEY=            # NotebookLM API (nlm CLI)
```

## 폴더 구조

```
chiropraticos/
├── .harness/           ← 하네스 엔지니어링 구조
├── assets/             ← 공통 JS/CSS
├── images/             ← 정적 이미지
├── tests/              ← Vitest 테스트
├── api/                ← Vercel serverless functions
├── supabase/           ← DB 스키마/마이그레이션
├── [chapter dirs]/     ← 챕터별 서브 자료
└── downloads/          ← 임시 다운로드 (gitignored)
```
