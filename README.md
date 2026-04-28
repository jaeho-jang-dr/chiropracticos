# Chiropracticos · 카이로프랙틱 통합 강의 시스템

> 운영자 — **drjang00@gmail.com** · Live: <https://chiropractic-kr.vercel.app>
> 비공개 저장소(Private). 무단 복제·재배포·상업 이용 금지.

근거 기반 카이로프랙틱 — 한국 MD/PT 대상 비영리 교육 자료. 12 챕터, 121개 NotebookLM 아티팩트, Diversified States Manual 등 원전 자료 통합.

## 스택

| 층 | 서비스 | 용도 |
|---|---|---|
| 프론트 | Vercel (정적 사이트) | HTML/CSS/JS · `deploy.sh` → vercel deploy --force |
| 인증 | Supabase Auth | Email + Google OAuth |
| DB | Supabase Postgres | users · access_logs · downloads · admin_logs · RLS |
| 미디어 | Cloudflare R2 (`pub-e44b…r2.dev`) | mp4/m4a/pdf — 8.49GB / 877 obj |

## 접근 정책

- **공개**: index, archive, chapter01_introduction
- **로그인+승인 필요**: chapter02 ~ chapter12, viewer
- **관리자 전용**: admin.html (`drjang00@gmail.com`, `drjang000@gmail.com`)

## 다운로드 정책

| 자산 | 다운로드 |
|---|---|
| NotebookLM 영상 (`02_video_part*`, `03_video_part*` mp4) | ✅ 허용 |
| NotebookLM 팟캐스트 (`01_podcast*` m4a) | ✅ 허용 |
| 슬라이드 PDF (`*_slides_*.pdf`, archive lectures) | 🚫 차단 — 인라인 뷰어(`#toolbar=0`) 만 |
| 강의 DOCX | 🚫 차단 — 안내 alert |
| 개인 mp4 (`archive/videos/...`) | 🚫 `controlsList=nodownload` |
| 이미지 (`./images/`) | 🚫 우클릭·drag 차단 |

구현: `assets/download-guard.js` (전역 화이트리스트) + `assets/pdf-viewer.js` (모달 뷰어).
한계: R2가 public bucket이라 URL을 알면 직접 다운로드 가능 — 캐주얼 차단 한정.

## 셋업

처음이라면 [`SETUP_GUIDE.md`](./SETUP_GUIDE.md)부터 보세요.

### 로컬 실행

```bash
# 1. config.js 의 SUPABASE_URL/ANON_KEY 채우기
# 2. 정적 서버
python -m http.server 8888 --bind 127.0.0.1
# → http://127.0.0.1:8888/
```

### Supabase 스키마

`supabase/schema.sql` 전체를 Supabase 콘솔 SQL Editor에 붙여넣어 실행. trigger·RLS·seed admin까지 한 번에.

### Vercel 배포

GitHub 연결 → 환경변수 설정 → Auto-deploy.

```
NEXT_PUBLIC_SUPABASE_URL       = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGc...
```

(현재는 anon key를 `assets/config.js` 정적 파일에 직접 넣는 단순 방식. 환경변수 주입이 필요하면 `vercel.json` build step 추가.)

## 디렉토리

```
chiropraticos-app/
├── index.html · archive.html · chapter01-12_*.html · viewer.html
├── login.html · signup.html · auth-callback.html · admin.html
├── assets/
│   ├── config.js              ← Supabase URL/anon key (PUBLIC OK)
│   ├── supabase-client.js     ← SDK 초기화 + getAccessLevel
│   ├── auth-guard.js          ← 페이지 접근 제어
│   ├── main.css
│   └── chapters-status.json
├── images/                    ← SVG · 인물 사진
├── {기법명}/                   ← 강의록 MD (lecture/), report MD (08-11_*.md)
└── supabase/schema.sql        ← DB 스키마 + RLS + seed admin
```

미디어 원본은 `G:\내 드라이브\chiropracticos\`에 유지하고, 배포본은 Cloudflare R2(`pub-e44b…r2.dev`)에서 서빙합니다.

## 라이선스 / 운영 안내

비영리 교육용. 일부 콘텐츠는 원저작자 허가 받음. 무단 복제·재배포·상업 이용 금지.
저장소는 **PRIVATE**으로 유지하며, 코드·R2 URL 패턴·NotebookLM 메타데이터 외부 노출을 방지합니다.
