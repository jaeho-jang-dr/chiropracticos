# 표준 작업 루프 프로토콜

## 하네스 실행 루프 개요

```
Agent = Antigravity (오케스트레이터) + Claude Code (실행자)

[사용자 요청]
     ↓
[1] RESEARCH  — Antigravity: 현재 상태 파악
     ↓
[2] PLAN      — Antigravity: 작업 계획 수립 & Claude Code 위임 결정
     ↓
[3] EXECUTE   — Claude Code: 코드 생성 + 실행 (에러 시 자가수정)
     ↓
[4] VERIFY    — 자동 검증 스크립트 실행
     ↓
[5] GATE?     — Human Gate 필요 여부 판단
     ↓
[6] REPORT    — 사용자에게 결과 보고 + progress.json 업데이트
```

---

## 단계별 상세

### [1] RESEARCH (Antigravity 담당)
```
- .harness/loops/progress.json 읽기 → 이전 작업 상태 확인
- git log --oneline -5 실행 → 최근 변경 파악
- 관련 파일 상태 확인 (인코딩, 크기, 수정일)
- 문제 정의 명확화
```

### [2] PLAN (Antigravity 담당)
```
- 작업을 원자적 단위로 분해 (WIP = 1 원칙: 한 번에 하나씩)
- Claude Code 위임 여부 결정:
  * 50줄+ 코드 생성 → 위임
  * 단순 파일 수정 → Antigravity 직접
- 예상 소요 시간 및 위험 요소 파악
- Human Gate 필요 여부 판단
```

### [3] EXECUTE (Claude Code 담당)
```
위임 시 프롬프트 형식:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
작업 목표: [한 문장으로]
성공 기준: [구체적, 측정 가능]
제약 조건:
  - UTF-8 without BOM 저장
  - 대용량 파일 Git 금지
  - 완료 후 결과 보고
참조: .harness/context/principles.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

에러 처리:
  - 1회 실패 → 에러 분석 후 자동 재시도
  - 2회 실패 → Antigravity에게 보고, 판단 요청
  - 인코딩 에러 → Python 방식으로 전환 (PowerShell 금지)
```

### [4] VERIFY (자동 실행)
```powershell
# 매 작업 완료 후 필수 실행
npm run test                              # 기본 테스트
python .harness/verify/check_encoding.py # 인코딩 검사
python .harness/verify/check_podcasts.py # 팟캐스트 링크 검사

# 통과 기준: 3개 모두 exit code 0
```

### [5] GATE (Human 개입)
```
필요한 경우:
- Gate #1: 팟캐스트 재생성 → 사용자 승인 대기
- Gate #2: 프로덕션 배포 → 사용자 최종 확인
- Gate #3: 콘텐츠 삭제 → 상세 계획 제시 후 승인
- Gate #4: .env 변경 → 사용자 확인
- 예상치 못한 에러 → 즉시 중단, 보고
```

### [6] REPORT (Antigravity 담당)
```
보고 형식:
✅ 완료: [작업 요약]
📁 변경 파일: [목록]
🔍 검증 결과: [통과/실패]
📝 다음 할 일: [있다면]

+ progress.json 업데이트
```

---

## WIP = 1 원칙

**한 번에 하나의 작업만 진행한다.**

```
잘못된 예: "ch02, ch03, ch04 팟캐스트 동시 복원 + 배포"
올바른 예:
  1. ch02 팟캐스트 복원
  2. 검증
  3. ch03 팟캐스트 복원
  4. 검증
  5. 배포 (모두 완료 후)
```

---

## 자가수정 루프 (Claude Code)

```python
MAX_RETRIES = 3

for attempt in range(MAX_RETRIES):
    try:
        result = execute_task()
        if verify(result):
            return SUCCESS
    except EncodeError:
        switch_to_python_encoding()  # PowerShell → Python
    except FileNotFoundError:
        check_paths()
    except Exception as e:
        if attempt == MAX_RETRIES - 1:
            report_to_antigravity(e)
            return NEED_HUMAN
        continue
```
