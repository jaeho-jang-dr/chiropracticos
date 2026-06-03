"""
.harness/verify/check_encoding.py
모든 HTML 파일의 UTF-8 인코딩 및 BOM 자동 검사

사용법:
  python .harness/verify/check_encoding.py
  python .harness/verify/check_encoding.py --fix   # BOM 자동 제거
"""
import sys
import os
import glob
import argparse

sys.stdout.reconfigure(encoding='utf-8')

def check_file(filepath):
    """파일의 인코딩 상태 반환: (has_bom, is_utf8, size)"""
    with open(filepath, 'rb') as f:
        raw = f.read()
    has_bom = raw[:3] == b'\xef\xbb\xbf'
    try:
        content = raw[3:].decode('utf-8') if has_bom else raw.decode('utf-8')
        is_utf8 = True
    except UnicodeDecodeError:
        is_utf8 = False
    return has_bom, is_utf8, len(raw)

def fix_bom(filepath):
    """BOM 제거 후 UTF-8 without BOM 재저장"""
    with open(filepath, 'rb') as f:
        raw = f.read()
    if raw[:3] == b'\xef\xbb\xbf':
        content = raw[3:].decode('utf-8')
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(content)
        return True
    return False

def main():
    parser = argparse.ArgumentParser(description='HTML 인코딩 검사 도구')
    parser.add_argument('--fix', action='store_true', help='BOM 자동 제거')
    parser.add_argument('--path', default='.', help='검사할 경로 (기본: 현재 디렉토리)')
    args = parser.parse_args()

    # chapter*.html 파일 검사
    pattern = os.path.join(args.path, 'chapter*.html')
    files = sorted(glob.glob(pattern))

    if not files:
        print(f'검사할 파일 없음: {pattern}')
        sys.exit(0)

    total = 0
    bom_count = 0
    error_count = 0
    fixed_count = 0

    print(f'\n{"="*60}')
    print(f'  인코딩 검사 — {len(files)}개 HTML 파일')
    print(f'{"="*60}')

    for filepath in files:
        filename = os.path.basename(filepath)
        has_bom, is_utf8, size = check_file(filepath)
        total += 1

        if has_bom:
            bom_count += 1
            status = '❌ BOM 발견'
            if args.fix:
                fix_bom(filepath)
                fixed_count += 1
                status += ' → 수정 완료'
        elif not is_utf8:
            error_count += 1
            status = '⚠️  UTF-8 아님'
        else:
            status = '✅ 정상'

        print(f'  {filename:<45} {status}  ({size/1024:.1f}KB)')

    print(f'{"="*60}')
    print(f'  총 {total}개 | 정상: {total-bom_count-error_count}개 | BOM: {bom_count}개 | 오류: {error_count}개')
    if args.fix and fixed_count > 0:
        print(f'  수정 완료: {fixed_count}개')
    print(f'{"="*60}\n')

    exit_code = 0 if (bom_count == 0 and error_count == 0) else 1
    if exit_code != 0 and not args.fix:
        print('  💡 수정하려면: python .harness/verify/check_encoding.py --fix')
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
