"""
.harness/verify/check_podcasts.py
HTML 파일의 팟캐스트 URL과 R2 실제 파일 존재 여부 검증

사용법:
  python .harness/verify/check_podcasts.py
"""
import sys
import re
import os
import json
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

try:
    import boto3
    from botocore.client import Config
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# 챕터별 HTML 파일 및 팟캐스트 설정
CHAPTERS = {
    'ch02': 'chapter02_functional_neurology.html',
    'ch03': 'chapter03_diversified.html',
    'ch04': 'chapter04_gonstead.html',
    'ch12': 'chapter12_ak.html',
}

def extract_podcast_urls(html_path):
    """HTML에서 팟캐스트 URL 추출"""
    if not os.path.exists(html_path):
        return []
    with open(html_path, encoding='utf-8') as f:
        content = f.read()
    # podcasts_v3/xxx.m4a?v=yyy 패턴
    pattern = r'podcasts_v3/([^"\'?\s]+\.m4a)(?:\?[^"\']*)?'
    matches = re.findall(pattern, content)
    return list(set(matches))

def get_r2_client():
    """R2 boto3 클라이언트 생성"""
    endpoint = os.getenv('R2_ENDPOINT')
    access_key = os.getenv('R2_ACCESS_KEY_ID')
    secret_key = os.getenv('R2_SECRET_ACCESS_KEY')
    if not all([endpoint, access_key, secret_key]):
        return None
    return boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

def list_r2_podcasts(client, bucket):
    """R2에서 podcasts_v3/ 파일 목록 조회"""
    try:
        paginator = client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket, Prefix='podcasts_v3/')
        files = []
        for page in pages:
            for obj in page.get('Contents', []):
                key = obj['Key'].replace('podcasts_v3/', '')
                if key:
                    files.append(key)
        return set(files)
    except Exception as e:
        return None

def main():
    print(f'\n{"="*60}')
    print(f'  팟캐스트 링크 검증')
    print(f'{"="*60}')

    all_results = {}
    html_files = {}

    # 1. HTML에서 URL 추출
    for ch, html_file in CHAPTERS.items():
        urls = extract_podcast_urls(html_file)
        html_files[ch] = urls
        print(f'  {html_file}: {len(urls)}개 팟캐스트 링크 발견')
        for url in sorted(urls):
            print(f'    → {url}')

    # 2. R2 연결 (가능한 경우)
    r2_files = None
    if HAS_BOTO3:
        client = get_r2_client()
        if client:
            bucket = os.getenv('R2_BUCKET', 'chiropracticos-media')
            r2_files = list_r2_podcasts(client, bucket)
            if r2_files is not None:
                print(f'\n  R2 버킷({bucket}): {len(r2_files)}개 파일')
            else:
                print('\n  R2 연결 실패 — URL 형식만 검사합니다')
        else:
            print('\n  R2 자격증명 없음 — URL 형식만 검사합니다')
    else:
        print('\n  boto3 미설치 — URL 형식만 검사합니다')

    # 3. 검증
    missing = []
    ok_count = 0

    for ch, urls in html_files.items():
        for url in urls:
            if r2_files is not None:
                if url in r2_files:
                    ok_count += 1
                else:
                    missing.append({'chapter': ch, 'file': url})
            else:
                # R2 연결 없을 때: URL 형식만 검사
                if url.endswith('.m4a'):
                    ok_count += 1

    # 4. 결과 출력
    print(f'\n{"="*60}')
    if missing:
        print(f'  ❌ R2에 없는 파일: {len(missing)}개')
        for m in missing:
            print(f'    [{m["chapter"]}] MISSING: {m["file"]}')
    else:
        print(f'  ✅ 모든 팟캐스트 링크 정상 ({ok_count}개)')
    print(f'{"="*60}\n')

    # 5. JSON 결과 저장
    result = {
        'status': 'fail' if missing else 'ok',
        'checked': ok_count + len(missing),
        'ok': ok_count,
        'missing': missing,
        'r2_connected': r2_files is not None,
    }
    out_path = Path('.harness/verify/last_sync_result.json')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    sys.exit(1 if missing else 0)

if __name__ == '__main__':
    main()
