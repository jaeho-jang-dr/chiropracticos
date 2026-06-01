# 📅 카이로프랙틱 앱 구축 스케줄

> **최종 업데이트**: 2026-04-27 10:11 KST · ✅ **121/121 100% 달성**
> **5일 콘텐츠 구축 완료**: 12 챕터 × 11 아티팩트 (podcast + video×2 + slide×4 + report×4)
> **남은 핵심 작업**: 로그인 구현 (Vercel+Supabase 4-phase 롤아웃 — 사용자 승인 대기 중)

---

## 현재 상태 스냅샷 (2026-04-27 10:11 최종 빌드 완료) · ✅ **100%**

| 챕터 | 제목 | Podcast | Video×2 | Slides×4 | Reports×4 | 강의MD | 완료 |
|-----:|------|:-------:|:-------:|:--------:|:---------:|:-----:|:---:|
| 1 | 서설 | — | — | — | — | ✅ | (NotebookLM 미사용 · 서설 MD 단독) |
| 2 | Functional Neurology ⭐ | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 3 | Diversified HVLA | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 4 | Gonstead | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 5 | Toggle Recoil | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 6 | Thompson | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 7 | Activator | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 8 | Cox Flexion-Distraction | ✅ | ✅ | **4/4 ✅** | 4/4 | ✅ | **11/11 ✅** |
| 9 | Logan Basic | ✅ | ✅ | **4/4 ✅** | 4/4 | ✅ | **11/11 ✅** |
| 10 | Sacro-Occipital (SOT) | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 11 | Harrison CBP | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |
| 12 | Applied Kinesiology | ✅ | ✅ | 4/4 | 4/4 | ✅ | **11/11 ✅** |

**진도**: 🎯 **121/121 NotebookLM 아티팩트 (100%)** · 11/12 강의 MD · 12/12 HTML 페이지 + 18 SVG (Day 5 10:11 최종 빌드)
**모든 챕터 11/11 완료 · Day 5 마지막 6건 (Cox P3-4 + Logan P1-4) 다운로드 완료**

---

## NotebookLM Quota 상황 (2026-04-22→24 실증 누적)

- **type별 quota pool 분리 확정**:
  - **slide_deck**: 가장 작은 pool (3-7건/세션 추정), **6-8시간 단위 부분 리셋**
  - **reports**: 별도 pool — 36건 연속 제출 성공 관측
  - **audio/video**: 또 별도 pool
- **account-wide 차단** (`API error code 8`)은 24시간 대기
- **slide_deck 차단** (`Could not create slide deck.`)은 6-8시간 후 일부 회복
- 실패 시 **다른 type으로 즉시 전환**이 효율적 (Day 2 오전 reports pivot으로 36건 추가 확보)

---

## 🗓️ 5일 로드맵

### Day 1 · 2026-04-23 (오늘) Thu · ✅ **완료 (17:05-17:10 KST 제출)**

**18건 모두 성공적으로 제출 — quota 리셋 확인**
- [x] 재제출 실패 6건 ✅
  - `ch11_cbp_podcast` `ch11_cbp_video1` `ch11_cbp_video2`
  - `ch12_ak_podcast` `ch12_ak_video1` `ch12_ak_video2`
- [x] 신규 제출 Ch 4-6 Slides 12건 ✅
  - Gonstead × 4 · Toggle Recoil × 4 · Thompson × 4

**결과 파일**: `D:\Entertainments\DevEnvironment\chiropraticos\day1-submissions-2026-04-23.json` (18개 artifact_id)
**소요 시간**: 약 5분 (배치 delay 없음, quota 여유 확인)

---

### Day 2 · 2026-04-24 Fri · ✅ **완료 (오전 + 오후)**

**09:15 KST — 다운로드 + 오전 배치 ✅**
- [x] Day 1 제출분 18건 다운로드 ✅
- [x] Ch 7 Slides 3건 성공 (Part 1-3) · Part 4 실패 (quota)
- [x] Strategy pivot: slide_deck 막힘 → reports 36건 연속 제출 성공 (ch04~ch12 report w1-w4)
- **오전 결과**: 39건 제출 (3 slide + 36 report)

**17:35 KST — 오후 배치 ✅ 125% 달성**
- [x] Ch 10 SOT slides × 4 (계획분) ✅
- [x] Ch 11 CBP slides × 4 (계획분) ✅
- [x] Ch 12 AK slides × 4 (계획분) ✅ — **신규 12/12 100%**
- [x] 오전 실패 복구: Ch 7 Part 4 + Ch 8 Parts 1-2 = 3건 ✅
- [ ] Ch 8 Parts 3-4 + Ch 9 Parts 1-4 = 6건 (quota 재도달 → Day 3으로 이월)
- **오후 결과**: 15건 성공 + 5건 실패 = 20건 시도

**Day 2 총계: 74건 시도 / 64건 성공 / 10건 재시도 대기**
**결과 파일**: `D:\Entertainments\DevEnvironment\chiropraticos\day2-afternoon-submissions-2026-04-24.json`

**quota 관측**: slide_deck은 6-8시간 단위 부분 리셋 추정. reports는 별도 quota pool (36건 연속 OK).

**18:46 KST 조기 다운로드 ✅** — 17:35 제출 15건 모두 1시간 내 렌더 완료 확인 · PDF 15건 + PPTX 15건 = **30파일 다운로드 성공**
- Ch 7 Activator: 07_slides_part4 (P4 only)
- Ch 8 Cox: 04_slides_part1, 05_slides_part2 (P1·P2)
- Ch 10 SOT: 04–07 (P1–P4 전체)
- Ch 11 CBP: 04–07 (P1–P4 전체)
- Ch 12 AK: 04–07 (P1–P4 전체)

---

### Day 3 · 2026-04-25 Sat · **slide quota 24h reset 대기**

> ✅ Reports 36건 + Day 2 오후 slides 15건 다운로드 모두 완료 상태.

**09:15 KST — slide 6건 재시도 → 0/6 실패**
- [x] ~~Day 2 제출 15건 다운로드~~ ✅ 어제 18:46에 30파일 모두 완료
- [x] Cox P3-4 + Logan × 4 = 6건 시도 → **전부 `Could not create slide deck.`**
- **결과 파일**: `D:\Entertainments\DevEnvironment\chiropraticos\day3-morning-attempt-2026-04-25.json`
- **quota 패턴 수정**: 이전 6-8h 부분 리셋 가설 부정확. 24시간 hard reset이 더 맞는 듯 (어제 17:35 마지막 성공 → 오늘 17:35 재시도 권장)

**17:35 KST — slide 6건 재시도 + 마무리**
- [ ] Cox P3-4 + Logan × 4 재제출 (24h 경과 후)
- [ ] 1시간 후 다운로드 (PDF + PPTX × 6 = 12파일)
- [ ] chapters-status.json 갱신 + build_app_with_status.py 빌드 → **121/121 (100%)** 도달

**🎯 09:15-17:35 사이 8시간 — 콘텐츠 폴리싱 ✅ 3개 항목 완료**
- [x] Ch 1 서설 상세 MD 작성 ✅ — `intro/lecture/intro_lecture.md` (~600줄, 7부 구성)
- [x] Ch 3 Diversified Week 2-4 MD 검수 ✅ — 통일성 양호, 추가 보강 불필요
- [x] Ch 4-12 SVG 다이어그램 ✅ — 챕터당 2개 × 9 = **18 SVG 생성** + 9 HTML 임베딩
- [ ] 로그인 구현 시작 (4결정 OK 시)

---

### Day 4 · 2026-04-26 Sun · **여유 — 콘텐츠 폴리싱**

> reports 12건 제출 계획은 이미 Day 2 오전에 모두 처리됨. Day 4-5는 콘텐츠 보강 위주.

**09:15 KST**
- [ ] Day 3 미완료 slide 재시도 (있다면)
- [ ] Ch 1 서설 상세 MD 마무리
- [ ] Ch 3 Diversified Week 2-4 MD 확장 (Week 1 외)

**17:35 KST**
- [ ] Ch 4-12 SVG 다이어그램 생성 (챕터당 2-4개)
- [ ] 로그인 구현 시작 (승인 시)

---

### Day 5 · 2026-04-27 Mon · 최종 빌드 + QA · ✅ **완료 100%**

**09:55 KST — slide 6건 재제출 ✅ 6/6 성공**
- [x] Cox P3-4 + Logan P1-4 = 6건 제출 (artifact_id 기록됨)
- [x] 첫 빌드 실행 → 115/121 (95%) 확인
- [x] chapters-status.json 자동 sync (빌드 스크립트가 G 드라이브 스캔)
- 결과 파일: `D:\...\chiropraticos\day5-final-submissions-2026-04-27.json`

**10:09-10:10 KST — 다운로드 ✅ 12/12 파일**
- [x] Cox P3 (12.5MB PDF + 14.9MB PPTX)
- [x] Cox P4 (10.7MB PDF + 12.2MB PPTX)
- [x] Logan P1 (11.6MB PDF + 13.6MB PPTX)
- [x] Logan P2 (18.0MB PDF + 21.5MB PPTX)
- [x] Logan P3 (19.6MB PDF + 24.2MB PPTX)
- [x] Logan P4 (11.1MB PDF + 12.8MB PPTX)

**10:11 KST — 최종 빌드 ✅ 121/121 100%**
- [x] `build_app_with_status.py` 실행
- [x] 12 챕터 HTML 자동 갱신
- [x] index.html 진도 표시 100% 반영
- [x] chapters-status.json 최종 sync

---

## 🤖 자동 재개 메커니즘

### 옵션 A · 자동 cron (현재 세션만 유효)

| 시각 (KST) | 작업 | 상태 |
|------|------|------|
| 2026-04-23 17:35 | Day 1 배치 (18건) | ✅ 완료 |
| 2026-04-24 09:15 | Day 2 오전 (다운로드 + 12건) | ✅ 완료 — 39건 제출 |
| 2026-04-24 17:35 | Day 2 오후 (12건) | ✅ 완료 — 15건 성공 |
| 2026-04-24 18:46 | Day 2 조기 다운로드 | ✅ 완료 — 30파일 |
| 2026-04-25 09:15 | Day 3 오전 (slide 6건 재시도) | ❌ 0/6 quota |
| 2026-04-25 17:35 | Day 3 오후 (Day 3 잔여 + Ch 1 MD) | ⏭ 미실행 |
| 2026-04-26 09:15 | Day 4 (콘텐츠 폴리싱 + SVG) | ⏭ 미실행 |
| 2026-04-27 09:55 | Day 5 slide 6건 재제출 + 첫 빌드 | ✅ 6/6 성공 (95%) |
| **2026-04-27 10:11** | **Day 5 다운로드 + 최종 빌드** | ✅ **121/121 (100%)** 🎯 |

### 옵션 B · 수동 재개 (Claude Code 껐다가 다시 켠 경우)

세션이 끊겼을 때 이 한 줄만 Claude에게 보내면 됩니다:

> **`SCHEDULE.md 읽고 오늘 할 일 진행`**

Claude는 이 파일과 `project_app_schedule.md` 메모리·`chapters-status.json`을 읽어서 현재 시각에 맞는 배치를 자동 실행합니다. 스케줄을 외울 필요 없음.

### 옵션 C · 하루 전체 자동 실행 (옵션 A·B 혼합)

Claude Code 켜둔 상태에서:

> **`스케줄 끝까지 자동 진행`**

→ 현 시점부터 남은 배치를 quota 고려해서 연속 실행.

---

## 📂 관련 파일 포인터

- 노트북 manifest: `D:\Entertainments\DevEnvironment\chiropraticos\notebooks-manifest.json`
- 제출 결과: `D:\Entertainments\DevEnvironment\chiropraticos\chapters4to12-av-results.json`
- 빌드 스크립트: `D:\Entertainments\DevEnvironment\chiropraticos\build_app_with_status.py`
- 다운로드 스크립트: `D:\Entertainments\DevEnvironment\chiropraticos\download_all_local.py`
- 상태 JSON: `G:\내 드라이브\chiropracticos\assets\chapters-status.json`
- 메모리 인덱스: `C:\Users\antigravity\.claude\projects\D--Entertainments-DevEnvironment-chiropraticos\memory\MEMORY.md`
