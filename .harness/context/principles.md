# 황금 원칙 — 절대 위반 금지 규칙

> **이 원칙들은 이전 실수에서 얻은 교훈입니다.**
> AI가 이 규칙을 위반하면 데이터 손실, 서비스 장애, 인코딩 오류가 발생합니다.

---

## P1 — 인코딩 원칙 (최우선)

**모든 HTML·MD·JSON 파일은 UTF-8 without BOM으로 저장한다.**

```
위반 사례: PowerShell Set-Content -Encoding UTF8 → BOM 포함 UTF-8 생성 → 한국어 깨짐
올바른 방법: Python open(..., encoding='utf-8', newline='') 또는 multi_replace_file_content 툴
```

- PowerShell `Set-Content -Encoding UTF8` **절대 사용 금지**
- 파일 저장 시 항상 Python `open(..., encoding='utf-8')` 사용
- 저장 후 BOM 체크: `(Get-Content file -Encoding Byte -TotalCount 3)[0..2] -join ','`

---

## P2 — 대용량 파일 Git 금지

**mp4, m4a, mp3, pdf, png(5MB+) 파일은 절대 Git 커밋하지 않는다.**

```
위반 시: GitHub 리포 용량 초과, Vercel 빌드 실패, 복구 매우 어려움
올바른 위치: Cloudflare R2 (pub-e44b...r2.dev)
```

- 미디어 파일은 R2에만 저장
- `.gitignore` 확인: `*.mp4, *.m4a, *.mp3, downloads/, korean_restore/`

---

## P3 — 콘텐츠 삭제 금지 (Human Gate #3)

**팟캐스트, 학술 본문, 이미지, 챕터 콘텐츠를 AI가 임의로 삭제하지 않는다.**

```
프로세스:
1. 삭제할 항목과 이유를 사용자에게 제시
2. 사용자 명시적 승인 확인
3. 승인된 범위 내에서만 삭제
4. git commit으로 복구 지점 생성
```

---

## P4 — 배포 전 테스트 필수

**vercel deploy 또는 git push 전 반드시 npm run test를 통과해야 한다.**

```powershell
npm run test
# 실패 시 → 수정 후 재실행, 통과 시에만 배포
bash deploy.sh "commit message"
```

---

## P5 — 팟캐스트 재생성 승인 (Human Gate #1)

**NotebookLM 팟캐스트 재생성은 사용자 명시적 승인 후에만 실행한다.**

```
이유: NLM 생성은 비가역적, 크레딧 소모, 시간 소요
체크: 현재 R2에 있는 파일이 정말 교체 필요한지 확인 후 진행
```

---

## P6 — 환경변수 보호 (Human Gate #4)

**.env 파일 수정은 반드시 사용자 확인 후 진행한다.**

```
위험: 잘못된 키 → Supabase 인증 실패, R2 접근 불가, 서비스 장애
절차: 변경 내용 먼저 설명 → 사용자 승인 → 수정
```

---

## P7 — Git 이력 보존

**force push 금지. rebase 전 사용자 확인 필수.**

```powershell
# 금지
git push --force

# 허용 (일반)
git push origin main
```

---

## P8 — 인증 가드 보존

**chapter02~chapter12는 항상 auth-guard.js를 포함해야 한다.**

```html
<!-- 모든 private 페이지 <head>에 반드시 포함 -->
<script src="assets/auth-guard.js"></script>
```

---

## 원칙 위반 감지 시

```
1. 즉시 작업 중단
2. 사용자에게 위반 내용 보고
3. 복구 방법 제시 (git revert, 원본 복원 등)
4. 사용자 지시 후 진행
```
