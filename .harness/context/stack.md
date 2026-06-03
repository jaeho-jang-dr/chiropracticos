# 기술 스택 상세

## 프론트엔드

| 항목 | 내용 |
|------|------|
| 언어 | 순수 HTML5 / Vanilla CSS / Vanilla JS |
| 호스팅 | Vercel (자동 Git 연동 배포) |
| 빌드 | 없음 (정적 파일 직접 서빙) |
| 폰트 | Google Fonts (Noto Sans KR) |
| 테스트 | Vitest (`npm run test`) |

## 백엔드 / 데이터베이스

| 항목 | 내용 |
|------|------|
| Auth | Supabase Auth (Email/Google/Naver/Kakao OAuth) |
| DB | Supabase Postgres |
| RLS | Row Level Security (역할별 접근 제어) |
| API | Vercel serverless (`/api/` 폴더) |

## 미디어 스토리지

| 항목 | 내용 |
|------|------|
| 서비스 | Cloudflare R2 |
| 버킷 | `chiropracticos-media` |
| 공개 URL | `pub-e44b...r2.dev` |
| CLI 도구 | `wrangler` (Cloudflare Workers CLI) |
| 파일 형식 | 팟캐스트: .m4a / 영상: .mp4 / 자료: .pdf |

## AI 도구

| 도구 | 모델 | 역할 |
|------|------|------|
| Antigravity CLI | Gemini 2.5 Pro | 오케스트레이터: 계획·판단·파일편집 |
| Claude Code CLI | claude-opus-4 | 코드생성·명령결정·셸실행 |
| NotebookLM (nlm) | Google NLM | 팟캐스트 오디오 생성 |

## 개발 환경

```powershell
# 로컬 서버
python -m http.server 8888 --bind 127.0.0.1

# 패키지 관리
npm install    # node_modules 설치
npm run test   # Vitest 실행

# 배포
bash deploy.sh "commit message"  # Git+Vercel 원스탑
```

## 주요 환경변수

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Cloudflare R2
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=chiropracticos-media

# Cloudflare (wrangler)
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
```

## 팟캐스트 URL 구조

```
https://pub-e44b...r2.dev/podcasts_v3/{파일명}.m4a?v={버전}

예시:
podcasts_v3/01_episode1_history.m4a?v=20260603a
podcasts_v3/02_episode2_diagnosis.m4a?v=20260603a
podcasts_v3/03_episode3_treatment.m4a?v=20260603a
podcasts_v3/04_episode4_critical.m4a?v=20260603a
```

## Git 브랜치 전략

```
main — 단일 브랜치 (Vercel 자동 배포 연동)
직접 push to main (소규모 팀, 단독 개발)
```

## 파일 네이밍 컨벤션

```
챕터 HTML: chapter{NN}_{기술명}.html
팟캐스트: {NN}_episode{N}_{주제}.m4a
백업 파일: {원본파일}.bak 또는 archive/ 폴더
임시 파일: tmp_{설명}.py (gitignore)
```
