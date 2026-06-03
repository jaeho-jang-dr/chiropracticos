"""
.harness/skills/podcast_manager.py
팟캐스트 관리 원스탑 스킬 (R2 목록, 링크 검증, 파일 업로드)

사용법:
  python .harness/skills/podcast_manager.py --action list
  python .harness/skills/podcast_manager.py --chapter ch02 --action verify
  python .harness/skills/podcast_manager.py --chapter ch02 --action restore
  python .harness/skills/podcast_manager.py --chapter ch02 --action restore --version 20260603b
"""
import sys, os, re, json, glob, argparse
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import boto3
    from botocore.client import Config
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

# 챕터 매핑
CHAPTER_HTML = {
    'ch02': 'chapter02_functional_neurology.html',
    'ch03': 'chapter03_diversified.html',
    'ch04': 'chapter04_gonstead.html',
    'ch12': 'chapter12_ak.html',
}
CHAPTER_FOLDER = {
    'ch02': 'functional_neurology',
    'ch03': 'diversified',
    'ch04': 'gonstead',
    'ch12': 'ak',
}

def get_r2():
    ep = os.getenv('R2_ENDPOINT')
    ak = os.getenv('R2_ACCESS_KEY_ID')
    sk = os.getenv('R2_SECRET_ACCESS_KEY')
    bucket = os.getenv('R2_BUCKET', 'chiropracticos-media')
    if not all([ep, ak, sk]):
        print('  ⚠️  R2 자격증명 없음 — .env 파일 확인')
        return None, bucket
    client = boto3.client(
        's3', endpoint_url=ep,
        aws_access_key_id=ak, aws_secret_access_key=sk,
        config=Config(signature_version='s3v4'), region_name='auto'
    )
    return client, bucket

def action_list(chapter=None):
    """R2 팟캐스트 목록 조회"""
    if not HAS_BOTO3:
        print('  ❌ boto3 미설치: pip install boto3')
        return
    client, bucket = get_r2()
    if not client:
        return

    prefix = 'podcasts_v3/' if not chapter else f'{CHAPTER_FOLDER.get(chapter, "")}/podcasts_v3/'
    paginator = client.get_paginator('list_objects_v2')
    print(f'\n  R2 버킷: {bucket}  (prefix: {prefix})')
    print(f'  {"키":<60} {"크기(KB)":>10}')
    print(f'  {"-"*70}')
    count = 0
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get('Contents', []):
            key = obj['Key']
            size_kb = obj['Size'] / 1024
            print(f'  {key:<60} {size_kb:>10.1f}')
            count += 1
    print(f'\n  총 {count}개 파일')

def action_verify(chapter):
    """HTML 링크 vs R2 실제 파일 검증"""
    html = CHAPTER_HTML.get(chapter)
    if not html or not os.path.exists(html):
        print(f'  ❌ HTML 파일 없음: {html}')
        return

    with open(html, encoding='utf-8') as f:
        content = f.read()
    # 전체 R2 URL에서 키 추출
    pattern = r'r2\.dev/([^"\'?\s]+\.m4a)'
    matches = re.findall(pattern, content)
    if not matches:
        print(f'  ⚠️  팟캐스트 링크 없음: {html}')
        return

    print(f'\n  HTML 링크 ({len(matches)}개): {html}')
    for m in matches:
        print(f'    → {m}')

    if HAS_BOTO3:
        client, bucket = get_r2()
        if client:
            # R2 전체 키 조회
            paginator = client.get_paginator('list_objects_v2')
            r2_keys = set()
            for page in paginator.paginate(Bucket=bucket):
                for obj in page.get('Contents', []):
                    r2_keys.add(obj['Key'])

            print(f'\n  검증 결과:')
            ok = missing = 0
            for m in matches:
                if m in r2_keys:
                    print(f'    ✅ {m}')
                    ok += 1
                else:
                    print(f'    ❌ MISSING: {m}')
                    missing += 1
            print(f'\n  OK: {ok}개 | MISSING: {missing}개')

def action_restore(chapter, version):
    """korean_restore/{folder}/ 의 m4a 파일들을 R2에 업로드"""
    folder = CHAPTER_FOLDER.get(chapter)
    if not folder:
        print(f'  ❌ 알 수 없는 챕터: {chapter}')
        return

    # 로컬 파일 탐색
    search_paths = [
        f'korean_restore/{folder}/*.m4a',
        f'korean_restore/{chapter}/*.m4a',
        f'_podcast_dl/{folder}/*.m4a',
    ]
    local_files = []
    for pattern in search_paths:
        local_files.extend(glob.glob(pattern))

    if not local_files:
        print(f'  ❌ 업로드할 파일 없음 (탐색: {search_paths})')
        return

    if not HAS_BOTO3:
        print('  ❌ boto3 미설치: pip install boto3')
        return
    client, bucket = get_r2()
    if not client:
        return

    print(f'\n  R2 업로드 시작: {len(local_files)}개 파일 → {bucket}')
    ok = fail = 0
    for local in sorted(local_files):
        filename = os.path.basename(local)
        r2_key = f'{folder}/podcasts_v3/{filename}'
        try:
            client.upload_file(
                local, bucket, r2_key,
                ExtraArgs={'ContentType': 'audio/mp4'}
            )
            print(f'    ✅ {filename} → {r2_key}')
            ok += 1
        except Exception as e:
            print(f'    ❌ {filename}: {e}')
            fail += 1

    print(f'\n  업로드 완료 — OK: {ok}개 | 실패: {fail}개')
    if ok > 0:
        print(f'  다음 단계: HTML 버전 파라미터를 ?v={version}로 업데이트')
        print(f'  예: sed -i "s/?v=.*\\.m4a/?v={version}.m4a/" {CHAPTER_HTML[chapter]}')

def main():
    parser = argparse.ArgumentParser(description='팟캐스트 관리 원스탑 스킬')
    parser.add_argument('--chapter', choices=list(CHAPTER_HTML.keys()),
                        help='챕터 선택 (ch02|ch03|ch04|ch12)')
    parser.add_argument('--action', choices=['list','verify','restore'],
                        default='list', help='작업 선택')
    parser.add_argument('--version', default=None,
                        help='버전 문자열 (기본: 오늘날짜+a)')
    args = parser.parse_args()

    if args.version is None:
        from datetime import date
        args.version = date.today().strftime('%Y%m%d') + 'a'

    print(f'\n{"="*60}')
    print(f'  팟캐스트 관리 스킬')
    print(f'  챕터: {args.chapter or "전체"} | 작업: {args.action} | 버전: {args.version}')
    print(f'{"="*60}')

    if args.action == 'list':
        action_list(args.chapter)
    elif args.action == 'verify':
        if not args.chapter:
            for ch in CHAPTER_HTML:
                print(f'\n[{ch}]')
                action_verify(ch)
        else:
            action_verify(args.chapter)
    elif args.action == 'restore':
        if not args.chapter:
            print('  ❌ --chapter 필수 (restore 시)')
            sys.exit(1)
        action_restore(args.chapter, args.version)

    print()

if __name__ == '__main__':
    main()
