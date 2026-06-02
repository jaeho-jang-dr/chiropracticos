# Chiropractic-kr (Chiropracticos) Repository Guidelines

This file provides context and rules for Claude Code CLI when working in this repository.

## Commands
- **Test execution**: `npm run test` (or `npx vitest run`)
- **Single test file**: `npx vitest run tests/api/r2.test.js`
- **Coverage report**: `npm run test:coverage`
- **Local Dev Server**: `python -m http.server 8888 --bind 127.0.0.1` (Opens at http://127.0.0.1:8888/)
- **Deployment**: `bash deploy.sh "<commit message>"` (Handles cache-busting asset version increments, git push, vercel deploy, and alias verification).

## Project Architecture & Tech Stack
- **Frontend**: Plain HTML/CSS/JavaScript (Vanilla) hosted on Vercel.
- **Backend/Database/Auth**: Supabase (Postgres, trigger-based roles, RLS).
- **Media Hosting**: Cloudflare R2 (`pub-e44b...r2.dev`) for videos (mp4), audio (m4a/mp3), PDFs. Large media files must **never** be committed to Git.
- **Access Guarding**: 
  - `assets/auth-guard.js` must be loaded in the head of all private chapter pages (chapter02 ~ chapter12) to gate unauthorized access.
  - `assets/supabase-client.js` initializes Supabase client.
  - `assets/download-guard.js` prevents casual downloads of slides/audios/videos.

## Coding Conventions
1. **Cache Busting**: When modifying assets (JS/CSS), do not manually update version query params in HTML files. The `deploy.sh` script automatically bumps `?v=YYYYMMDD[letter]` across all HTML files upon deployment.
2. **Path Separators**: When writing paths in configuration files or JS code, use forward slashes (`/`). For local PowerShell operations, ensure proper escaping.
3. **Encoding**: Ensure all HTML and Markdown files are saved in **UTF-8** encoding to prevent Korean text corruption.
4. **Environment Variables**: Local keys are kept in `.env` (gitignored). Reference `.env.example` to see key names.
5. **Lint & Check**: Run `npm run test` before finishing tasks to verify that you did not break existing routes, HTTP headers, or R2 integrations.
6. **Content Reduction (콘텐츠 분량 축소 프로세스)**: 강의록(Markdown)이나 HTML 등의 문서를 요약하거나 텍스트 분량을 줄이라는 요청이 있을 경우, 반드시 다음 단계를 엄격히 준수하여 수행해야 한다:
   - **Step 1 (이전 버전 저장)**: 안전한 복구를 위해 작업 시작 직전 상태를 별도의 로컬 커밋이나 백업 해시로 명확히 저장해 둔다.
   - **Step 2 (구체적인 축소 계획 수립)**: 어느 영역에서 어떤 텍스트/자산을 구체적으로 어떻게 줄일 것인지 상세 계획을 작성한다.
   - **Step 3 (사용자 컨펌)**: 축소 계획을 사용자에게 먼저 제안하고 확정적인 컨펌(승인)을 받는다.
   - **Step 4 (승인 후 진행)**: 승인된 범위 내에서만 정밀하게 줄이는 작업을 수행하며, 임의로 팟캐스트나 학술 기전 등의 본문을 독자적으로 과도하게 삭제하지 않는다.

