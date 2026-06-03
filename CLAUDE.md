# Chiropracticos — Claude Code 하네스 컨텍스트

> 이 파일은 Claude Code (Opus)의 **행동 계약서**입니다.
> Antigravity (Gemini)가 작업을 위임할 때 이 파일이 항상 컨텍스트에 포함됩니다.
> **절대 이 파일을 AI가 임의로 수정하지 마세요. 사람(사용자)만 수정합니다.**

---

## 역할 정의
- **Claude Code (Opus)**: 코드 생성, 명령어 결정, 셸 실행, 에러 자가수정
- **Antigravity (Gemini)**: 고수준 계획, 파일 편집, 판단, 조율
- **사용자**: 의도 설정, 최종 검증, Human gate 승인

---

## 빠른 참조 맵

| 필요할 때 | 읽을 파일 |
|-----------|-----------|
| 전체 아키텍처 | `.harness/context/architecture.md` |
| 절대 규칙 (황금 원칙) | `.harness/context/principles.md` |
| 자주 쓰는 작업 패턴 | `.harness/context/patterns.md` |
| 기술 스택 상세 | `.harness/context/stack.md` |
| 표준 작업 루프 | `.harness/loops/task_loop.md` |
| 현재 작업 상태 | `.harness/loops/progress.json` |
| 사람 개입 시점 | `.harness/human/review_gates.md` |

---

## 핵심 명령어

```powershell
# 테스트
npm run test
npx vitest run tests/api/r2.test.js

# 로컬 서버
python -m http.server 8888 --bind 127.0.0.1

# 배포 (캐시버스팅 자동)
bash deploy.sh "<commit message>"

# 검증 실행 (작업 완료 전 필수 — 3개 모두)
python .harness/verify/check_encoding.py
python .harness/verify/check_podcasts.py
python .harness/verify/check_links.py
```

---

## 황금 원칙 (위반 절대 금지)

1. **인코딩**: 모든 HTML/MD 파일 → UTF-8 without BOM 저장
2. **대용량 파일**: mp4, m4a, mp3, pdf → Git 커밋 절대 금지, R2에만 저장
3. **콘텐츠 삭제**: 팟캐스트·학술 본문·이미지 임의 삭제 금지 (사용자 컨펌 필수)
4. **인증 파일**: `.env` 수정 전 사용자 확인 필수
5. **배포**: `vercel deploy` 전 `npm run test` 통과 필수
6. **팟캐스트 재생성**: NLM 요청 전 반드시 사용자 승인 (Human Gate #1)

---

## 작업 완료 체크리스트 (매 작업 후 실행)

```
[ ] npm run test 통과
[ ] python .harness/verify/check_encoding.py
[ ] python .harness/verify/check_podcasts.py
[ ] python .harness/verify/check_links.py
[ ] 변경 파일 git diff 확인
[ ] .harness/loops/progress.json 업데이트
[ ] 사용자에게 완료 보고
```

---

## 파일 구조 핵심

```
chiropraticos/
├── chapter01~13_*.html     # 챕터 강의 페이지 (Private: ch02~ch12)
├── assets/auth-guard.js    # 인증 가드 (모든 private 페이지에 포함)
├── assets/supabase-client.js
├── .env                    # 비밀키 (gitignored)
├── deploy.sh               # 배포 스크립트
└── .harness/               # 하네스 구조
```
