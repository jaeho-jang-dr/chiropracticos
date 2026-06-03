<#
.harness/skills/deploy_verify.ps1
배포 + 검증 원스탑 스킬

사용법:
  .\.harness\skills\deploy_verify.ps1 -Message "fix: 팟캐스트 복원"
  .\.harness\skills\deploy_verify.ps1 -Message "feat: 새 챕터 추가" -SkipTest
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,
    
    [switch]$SkipTest = $false,
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"
$Script = $MyInvocation.MyCommand.Name

function Write-Step($step, $msg) {
    Write-Host "`n[$step] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "  OK  $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "  FAIL  $msg" -ForegroundColor Red
}

Write-Host "`n============================================" -ForegroundColor Yellow
Write-Host "  배포 + 검증 원스탑 스킬" -ForegroundColor Yellow
Write-Host "  커밋: $Message" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

# [1] 테스트
Write-Step "1/5" "테스트 실행"
if (-not $SkipTest) {
    try {
        $result = npm run test 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "테스트 실패!"
            Write-Host $result
            exit 1
        }
        Write-Ok "npm run test 통과"
    } catch {
        Write-Fail "테스트 실행 오류: $_"
        exit 1
    }
} else {
    Write-Host "  SKIP  테스트 건너뜀 (-SkipTest 플래그)" -ForegroundColor Yellow
}

# [2] 인코딩 검사
Write-Step "2/5" "인코딩 검사"
try {
    $encResult = python .harness/verify/check_encoding.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "인코딩 검사 통과"
    } else {
        Write-Fail "BOM 인코딩 오류 발견!"
        Write-Host $encResult
        Write-Host "`n  수정: python .harness/verify/check_encoding.py --fix" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "  WARN  인코딩 검사 건너뜀: $_" -ForegroundColor Yellow
}

# [3] 팟캐스트 링크 검증
Write-Step "3/5" "팟캐스트 링크 검증"
try {
    $pcResult = python .harness/verify/check_podcasts.py 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "팟캐스트 링크 검증 통과"
    } else {
        Write-Fail "팟캐스트 링크 오류 발견!"
        Write-Host $pcResult
        exit 1
    }
} catch {
    Write-Host "  WARN  팟캐스트 검증 건너뜀: $_" -ForegroundColor Yellow
}

# [4] Git 상태 확인
Write-Step "4/5" "Git 상태 확인"
$status = git status --short
if ($status) {
    Write-Host "  변경된 파일:" -ForegroundColor White
    $status | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Host "  변경 사항 없음 — 배포할 것이 없습니다" -ForegroundColor Yellow
    exit 0
}

if ($DryRun) {
    Write-Host "`n  DRY RUN — 실제 배포 건너뜀" -ForegroundColor Yellow
    exit 0
}

# [5] 배포
Write-Step "5/5" "배포 실행"
Write-Host "  실행: bash deploy.sh `"$Message`""
try {
    bash deploy.sh "$Message"
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "배포 완료!"
    } else {
        Write-Fail "배포 실패!"
        exit 1
    }
} catch {
    Write-Fail "배포 오류: $_"
    exit 1
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  배포 성공!" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green
