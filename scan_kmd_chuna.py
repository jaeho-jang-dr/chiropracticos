"""
Scan all HTML/MD files under G:/내 드라이브/chiropracticos/ for forbidden 한의학·추나 terms.
Outputs a JSON report listing matches per file with line numbers and context.
"""
import json
import re
from pathlib import Path

ROOT = Path(r"G:\내 드라이브\chiropracticos")

# Forbidden terms - must be absent from all curriculum materials
FORBIDDEN_TERMS = [
    # 한의학 계열
    "한의학", "한방", "한의사", "한의원", "한의", "KMD", "Korean Medicine Doctor",
    # 추나 계열
    "추나", "Chuna",
    # 경락 / 기혈 계열
    "경락", "기혈", "음양", "오행", "자경", "경혈", "맥진",
    "acupuncture meridian", "meridian", "acupuncture",
    # 추나 급여 코드
    "39014", "39015", "39016",
    # 기타
    "대한응용근신경학회",  # AK 특이 예외: 최소화
]

# 검사 제외 (scan 스크립트·빌드 스크립트 자체는 포함하지 않음)
EXCLUDE_FILENAMES = {"scan_kmd_chuna.py", "clean_kmd_chuna.py"}


def scan_file(path: Path) -> list[dict]:
    findings = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return [{"error": str(e)}]

    lines = text.splitlines()
    for i, line in enumerate(lines, start=1):
        for term in FORBIDDEN_TERMS:
            # 대소문자 구분: 영어 용어(acupuncture 등)는 case-insensitive
            if term.isascii():
                pattern = re.compile(re.escape(term), re.IGNORECASE)
            else:
                pattern = re.compile(re.escape(term))
            if pattern.search(line):
                findings.append({
                    "line": i,
                    "term": term,
                    "content": line.strip()[:300],
                })
    return findings


def main():
    report = {}
    for ext in ("*.html", "*.md"):
        for path in ROOT.rglob(ext):
            if path.name in EXCLUDE_FILENAMES:
                continue
            findings = scan_file(path)
            if findings:
                rel = str(path.relative_to(ROOT))
                report[rel] = findings

    out_path = Path(r"D:\Entertainments\DevEnvironment\chiropraticos\kmd_chuna_scan_report.json")
    out_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 간단 요약 출력
    total_files = len(report)
    total_hits = sum(len(v) for v in report.values())
    print(f"Scanned. Files with matches: {total_files}, total hits: {total_hits}")
    for f, findings in report.items():
        # term별 카운트
        from collections import Counter
        terms = Counter(x["term"] for x in findings if "term" in x)
        summary = ", ".join(f"{t}×{c}" for t, c in terms.most_common())
        print(f"  {f}: {summary}")


if __name__ == "__main__":
    main()
