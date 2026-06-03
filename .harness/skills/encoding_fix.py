"""
.harness/skills/encoding_fix.py
HTML 파일 인코딩 자동 감지 및 BOM 복구 스킬

사용법:
  python .harness/skills/encoding_fix.py                      # 모든 chapter*.html 검사
  python .harness/skills/encoding_fix.py --file chapter12_ak.html
  python .harness/skills/encoding_fix.py --check-only         # 수정 없이 검사만
  python .harness/skills/encoding_fix.py --fix                # BOM 자동 제거
"""
import sys, os, glob, shutil, argparse
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

def detect_bom(filepath):
    with open(filepath, 'rb') as f:
        head = f.read(3)
    return head == b'\xef\xbb\xbf'

def detect_encoding(filepath):
    try:
        import chardet
        with open(filepath, 'rb') as f:
            raw = f.read()
        result = chardet.detect(raw)
        return result.get('encoding', 'unknown'), result.get('confidence', 0)
    except ImportError:
        # chardet 없으면 직접 시도
        with open(filepath, 'rb') as f:
            raw = f.read()
        for enc in ['utf-8', 'cp949', 'euc-kr']:
            try:
                raw.decode(enc)
                return enc, 1.0
            except UnicodeDecodeError:
                continue
        return 'unknown', 0

def fix_bom(filepath):
    """BOM 제거 후 UTF-8 without BOM 재저장. 백업 .bak 생성"""
    bak = str(filepath) + '.bak'
    shutil.copy2(filepath, bak)
    with open(filepath, 'rb') as f:
        raw = f.read()
    if raw[:3] == b'\xef\xbb\xbf':
        content = raw[3:].decode('utf-8')
    else:
        enc, _ = detect_encoding(filepath)
        with open(filepath, encoding=enc or 'utf-8', errors='replace') as f:
            content = f.read()
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(content)
    return bak

def main():
    parser = argparse.ArgumentParser(description='HTML BOM 인코딩 자동 복구')
    parser.add_argument('--file', default='chapter*.html',
                        help='파일 패턴 (기본: chapter*.html)')
    parser.add_argument('--check-only', action='store_true',
                        help='수정 없이 검사만')
    parser.add_argument('--fix', action='store_true',
                        help='BOM 자동 제거 (기본 동작)')
    args = parser.parse_args()

    # 파일 목록 결정
    if '*' in args.file or '?' in args.file:
        files = sorted(glob.glob(args.file))
    else:
        files = [args.file] if os.path.exists(args.file) else []

    if not files:
        print(f'  파일 없음: {args.file}')
        sys.exit(0)

    print(f'\n{"="*60}')
    print(f'  인코딩 복구 스킬 — {len(files)}개 파일')
    mode = '검사만 (--check-only)' if args.check_only else '검사 + 자동 수정'
    print(f'  모드: {mode}')
    print(f'{"="*60}')

    total = bom_found = fixed = 0

    for fp in files:
        total += 1
        name = os.path.basename(fp)
        has_bom = detect_bom(fp)
        enc, conf = detect_encoding(fp)

        if has_bom:
            bom_found += 1
            status = '❌ BOM 발견'
            if not args.check_only:
                bak = fix_bom(fp)
                fixed += 1
                status += f' → 수정완료 (백업: {os.path.basename(bak)})'
        else:
            status = f'✅ 정상 ({enc})'

        print(f'  {name:<45} {status}')

    print(f'{"="*60}')
    print(f'  총 {total}개 | BOM 발견: {bom_found}개 | 수정: {fixed}개')
    print(f'{"="*60}\n')

    sys.exit(1 if bom_found > 0 and args.check_only else 0)

if __name__ == '__main__':
    main()
