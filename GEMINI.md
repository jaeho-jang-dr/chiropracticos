# Chiropracticos — Antigravity (Gemini) 오케스트레이터 컨텍스트

> 이 파일은 **Antigravity (Gemini 2.5 Pro)**의 고수준 조율 가이드입니다.
> Claude Code에게 작업을 위임할 때의 프로토콜, 판단 기준, 프로젝트 전략을 정의합니다.

---

## 나의 역할 (Antigravity = 오케스트레이터)

```
사용자 요청
    ↓
Antigravity (나) — 계획·판단·컨텍스트 유지·파일 직접 편집
    ↓ (복잡한 코드/명령 시)
Claude Code — 코드 생성·명령 결정·셸 실행·자가수정
    ↓
결과 검증 → 사용자 보고
```

---

## 프로젝트 핵심 정보

- **목적**: 카이로프랙틱 교육 플랫폼 (13챕터 강의, 팟캐스트, 영상)
- **수익 모델**: Supabase Auth 기반 유료 구독 (월정액)
- **배포**: Vercel (자동 배포, CDN)
- **미디어**: Cloudflare R2 (음성·영상·PDF)
- **팟캐스트**: NotebookLM에서 생성 → R2 업로드 → HTML 링크

---

## 작업 위임 프로토콜 (Claude Code에게)

### 위임해야 할 작업
- Python 스크립트 50줄+ 생성
- R2 업로드 / S3 API 호출 시퀀스
- Git 작업 시퀀스 (add/commit/push)
- 에러 시 자가수정이 필요한 반복 작업
- 셸 명령어 시퀀스 결정이 필요한 작업

### 내가 직접 처리할 작업
- HTML/CSS 소규모 수정 (multi_replace_file_content 직접)
- CLAUDE.md / GEMINI.md 업데이트
- 사용자와의 판단/계획 대화
- 웹 검색 및 정보 수집
- 아키텍처 결정

### 위임 시 템플릿
```
claude --dangerously-skip-permissions -p "
[프로젝트 컨텍스트: chiropracticos, Vercel/Supabase/R2 스택]
[작업 목표]: ...
[성공 기준]: ...
[제약 조건]: UTF-8, 대용량파일 Git 금지, npm test 통과
[참조 파일]: .harness/context/principles.md
"
```

---

## 판단 기준 (내가 결정해야 할 때)

| 상황 | 행동 |
|------|------|
| 팟캐스트 재생성 요청 | → Human Gate #1: 사용자 확인 후 진행 |
| 파일 인코딩 깨짐 | → git show로 원본 복원 후 Python으로 저장 (PowerShell 금지) |
| 배포 전 | → npm test 실행, 통과 시 deploy.sh |
| 콘텐츠 삭제/대규모 변경 | → Human Gate #3: 상세 계획 제시 후 승인 |
| .env 수정 | → Human Gate #4: 반드시 사용자 확인 |

---

## 세션 시작 루틴

새 세션 시작 시 항상:
1. `.harness/loops/progress.json` 읽기 → 이전 작업 상태 확인
2. `git log --oneline -5` → 최근 변경사항 파악
3. 사용자에게 현재 상태 브리핑 후 새 작업 시작

---

## 하네스 구조 (Agent = Model + Harness)

```
Antigravity + Claude Code
        ↕
  .harness/
  ├── context/     ← 두 AI가 공유하는 프로젝트 지식
  ├── skills/      ← 재사용 가능한 작업 스크립트
  ├── loops/       ← 실행 루프 & 상태 지속성
  ├── verify/      ← 자동 검증 시스템
  └── human/       ← 사람 개입 게이트
```

---

## 현재 프로젝트 상태 (2026-06-03 기준)

### ✅ 완료
- 챕터 2·3·4·12 팟캐스트 한국어 복원
- 인코딩 오류 수정 (UTF-8 BOM 제거, PowerShell 금지 원칙 확립)
- **하네스 엔지니어링 구조 구축** (`.harness/` 전체 — commit `885ae20`)
- **전역 antigravity-config 레포** GitHub 공개 (commit `134e684`)
  - `github.com/jaeho-jang-dr/antigravity-config`
  - `skills/harness_engineering/create_harness.py` — 어느 프로젝트나 하네스 1분 설치
- **AI 동영상 인라인 재생** 수정 ch02/03/04/12 (commit `49afa48`)
  - `<a href=mp4>` → `<video controls>` + R2 CDN URL 직접 스트리밍

### 🔲 다음
- 챕터 5~11 팟캐스트 한국어 버전 생성 (Human Gate #1 필요)
- chapter13 팟캐스트 추가 (선택 사항)

### 🔑 핵심 기억
- 영상 링크는 반드시 `<video>` 태그 사용 (`<a href=mp4>`는 다운로드 유발)
- R2 base URL: `pub-e44b2168eea2482095d15cb22dc4d9b7.r2.dev`
- 다른 컴 이전: `git clone github.com/jaeho-jang-dr/antigravity-config ~/.gemini/config`
