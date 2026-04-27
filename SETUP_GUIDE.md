# Phase 1 셋업 가이드 — 사용자가 직접 해야 하는 작업

> 제(Claude)가 코드/SQL/HTML은 모두 준비합니다. 사용자는 외부 서비스 4개에 가입하고 키 4개만 받아오시면 됩니다. **총 15-20분 소요.**

---

## 0. 준비물

- 이메일 1개 — Supabase·Google·GitHub·Vercel 가입용
- **관리자 자동 부여**: `drjang00@gmail.com`, `drjang000@gmail.com` 둘 중 어느 쪽으로 가입해도 자동으로 admin role + approved access 부여됩니다 (DB trigger). 둘 다 가입해도 됩니다.
- 한국에서 사용 가능한 신용카드 (전부 무료 플랜이지만 Vercel·Supabase 가입 시 카드 등록만 요구하는 경우 있음 — **결제 없음**)

---

## 1. Supabase 프로젝트 생성 (5분)

1. https://supabase.com/ 접속 → **Start your project** → GitHub 계정으로 가입
2. **New Project**:
   - Name: `chiropraticos`
   - Database Password: **[강력한 패스워드 생성 후 1Password 등에 저장]**
   - Region: **Northeast Asia (Tokyo)** ← 한국에서 40-60ms (Seoul은 유료)
   - Pricing: Free
3. 프로젝트 생성 후 좌측 사이드바 → **Project Settings** → **API**
4. 다음 두 값을 저는 받아야 합니다:
   ```
   Project URL:    https://xxxxxxxxxxxx.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6...   (긴 JWT)
   ```
   ⚠️ **service_role key는 절대 공유 금지** (server-only)

5. 좌측 **Authentication** → **Providers** → **Email** 활성화 (기본값)

---

## 2. Google Cloud Console — OAuth Client 생성 (5분)

1. https://console.cloud.google.com/ 접속 → 새 프로젝트 생성
   - Project name: `chiropraticos-auth`
2. 좌측 **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: `Chiropractic 카이로프랙틱`
   - User support email: `drjang00@gmail.com`
   - Developer contact: `drjang00@gmail.com`
   - **Scopes**: 추가 안 해도 됨 (default openid+email+profile)
   - **Test users**: 자기 이메일 추가 (Publishing 전까지만 필요)
   - Save & Continue
3. 좌측 **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `chiropraticos web`
   - **Authorized redirect URIs** (이 두 개 모두 추가):
     ```
     https://xxxxxxxxxxxx.supabase.co/auth/v1/callback     ← 1번에서 받은 URL
     http://localhost:8888/auth/callback                    ← 로컬 테스트용
     ```
4. 생성 후 다음 값을 저는 받아야 합니다:
   ```
   Client ID:     xxxxxxxxx.apps.googleusercontent.com
   Client secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxx
   ```

5. **Supabase 콘솔로 돌아가서**: Authentication → Providers → **Google** 활성화 → 위에서 받은 Client ID, Secret 붙여넣기 → Save

---

## 3. GitHub 저장소 생성 (3분)

1. https://github.com/new
   - Repository name: `chiropraticos-app`
   - **Private** (콘텐츠 저작권 보호)
   - Initialize: 비워두기 (제가 push할 거라 README/license 체크 ❌)
2. 생성 후 URL 복사 (예: `https://github.com/yourname/chiropraticos-app.git`)

---

## 4. Vercel 가입 + 배포 (5분)

> ⏸ 이 단계는 **위 1·2·3 끝나고 제가 코드 push한 다음에** 하시면 됩니다.

1. https://vercel.com/ → **Sign Up with GitHub**
2. **Add New Project** → 위에서 만든 `chiropraticos-app` 저장소 import
3. **Framework Preset**: Other (정적 사이트)
4. **Environment Variables** 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://xxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGci...
   ```
   (이름은 사실 NEXT_PUBLIC 접두어 안 붙어도 되지만 관행)
5. **Deploy**
6. 배포 완료 후 URL 받기 (예: `chiropraticos-app.vercel.app`)
7. **Supabase 돌아가서**: Authentication → URL Configuration → Site URL에 `https://chiropraticos-app.vercel.app` 추가

---

## 저에게 알려주실 4가지

```
1) Supabase Project URL:    https://________________.supabase.co
2) Supabase anon key:       eyJ________________________________ (긴 JWT)
3) Google OAuth Client ID:  ________.apps.googleusercontent.com
4) GitHub repo URL:         https://github.com/__________/chiropraticos-app.git
```

저에게 이 4개를 알려주시면 즉시 코드 푸시까지 끝냅니다. Vercel 환경변수 등록과 배포는 단계 4에서 직접 해주시면 됩니다.

---

## 진행 흐름 요약

```
[사용자 1·2·3]   →   [제가 코드 push]   →   [사용자 4 Vercel deploy]   →   [완료]
   15분               자동 (이미 준비됨)         5분                          공개 URL
```
