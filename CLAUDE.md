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
