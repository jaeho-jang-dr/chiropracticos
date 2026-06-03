# 재사용 패턴 카탈로그

## 패턴 1: 팟캐스트 복원 패턴

**상황**: 팟캐스트가 영어로 교체됐거나 잘못된 버전이 올라간 경우

```python
# .harness/skills/podcast_manager.py 실행
python .harness/skills/podcast_manager.py --chapter ch02 --action restore
```

**단계**:
1. NLM에서 한국어 아티팩트 ID 확인 (`nlm list`)
2. 다운로드 → `korean_restore/chNN/` 저장
3. R2 업로드 (`wrangler r2 object put`)
4. HTML 버전 파라미터 업데이트 (`?v=YYYYMMDD[a-z]`)
5. `deploy.sh "restore Korean podcasts ch NN"`

---

## 패턴 2: 인코딩 복구 패턴

**상황**: HTML 파일의 한국어가 깨진 경우 (`??`, `???` 같은 문자 출력)

```python
# .harness/skills/encoding_fix.py 실행
python .harness/skills/encoding_fix.py --file chapterNN_*.html
```

**원인 확인**:
```powershell
# BOM 체크
$bytes = [IO.File]::ReadAllBytes("chapter.html")
"BOM: $($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)"
```

**복구 원칙**: 항상 `git show <commit>:file` → Python으로 UTF-8 재저장

---

## 패턴 3: HTML 버전 범프 패턴

**상황**: R2 파일을 교체했는데 CDN 캐시 때문에 브라우저가 새 파일을 받지 못함

```python
# 수동으로 버전 파라미터 업데이트
# OLD: podcasts_v3/01_episode1.m4a?v=20260512f
# NEW: podcasts_v3/01_episode1.m4a?v=20260603a
```

**규칙**:
- 버전 형식: `YYYYMMDD[소문자]` (같은 날 여러 번: a→b→c)
- `deploy.sh`는 JS/CSS만 자동 버전 업 → 미디어 파일은 수동
- Python `str.replace()` 사용 (PowerShell 금지)

---

## 패턴 4: 새 챕터 팟캐스트 생성 패턴

**상황**: 아직 팟캐스트가 없는 챕터(ch05~ch11)에 새로 생성

```
1. 챕터 HTML에서 핵심 내용 추출 (5000자 이내 요약)
2. NLM 노트북 생성: nlm create --title "Ch0N 팟캐스트"
3. 요약 내용 노트북에 추가
4. 팟캐스트 생성 요청: nlm generate --notebook <id>
5. Human Gate #1: 사용자 확인
6. 다운로드 → R2 업로드 → HTML 링크 추가
```

---

## 패턴 5: 배포 패턴

**상황**: 수정 완료 후 프로덕션에 반영

```powershell
# 1. 테스트
npm run test

# 2. 검증
python .harness/verify/check_encoding.ps1
python .harness/verify/check_podcasts.py

# 3. 배포 (캐시버스팅 + push + vercel + 확인 자동)
bash deploy.sh "fix: [변경 내용 한 줄 설명]"
```

---

## 패턴 6: 인코딩 안전 파일 저장 패턴

**상황**: 파일을 수정해서 저장할 때

```python
# 항상 이 방식으로
with open('target.html', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

# 절대 금지
# Set-Content -Encoding UTF8  (PowerShell — BOM 포함)
# open('file', 'w')  (인코딩 미지정)
```

---

## 패턴 7: git 복원 패턴

**상황**: 실수로 파일이 깨지거나 잘못 수정된 경우

```powershell
# 특정 커밋의 파일 복원
git show <commit-hash>:chapter12_ak.html > chapter12_ak.html

# 또는 Python으로 바이트 직접 처리
python -c "
import subprocess
result = subprocess.run(['git','show','f76764e:chapter12_ak.html'], capture_output=True)
with open('chapter12_ak.html', 'wb') as f:
    f.write(result.stdout)
"
```
