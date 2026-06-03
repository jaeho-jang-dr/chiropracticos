"""
.harness/verify/check_links.py
HTML 파일의 내부 링크(상대/루트절대 href·src)가 실제 파일로 존재하는지 검증

분류:
  - 외부(http/https//) · 앵커(#) · mailto/tel/javascript/data:  → 스킵
  - JS 템플릿 리터럴(${...}, {{...}})                          → 스킵(실제 링크 아님)
  - 미디어(.mp4/.m4a/.mp3/.wav/.pdf/.pptx/.docx/.zip/.vtt)     → R2/Drive 호스팅(P2)이라 디스크 검사 제외
  - 그 외 내부(.html/.css/.js/이미지 등)                       → 디스크 존재 확인
      · 루트절대(/login)는 리포 루트 기준 + cleanUrls(.html) 보강으로 해석
  - --check-external 지정 시에만 외부 URL을 HTTP로 점검(네트워크 필요)

사용법:
  python .harness/verify/check_links.py
  python .harness/verify/check_links.py --path .
  python .harness/verify/check_links.py --check-external
"""
import sys
import re
import os
import glob
import argparse

sys.stdout.reconfigure(encoding='utf-8')

# href="..." / src="..." (작은따옴표·큰따옴표 모두)
ATTR_RE = re.compile(r'(?:href|src)\s*=\s*(["\'])(.*?)\1', re.IGNORECASE)

# 디스크 검사에서 제외할 스킴/형태 (외부·앵커·비파일)
SKIP_PREFIXES = ('http://', 'https://', '//', 'mailto:', 'tel:',
                 'javascript:', 'data:', '#')

# JS 템플릿 리터럴/플레이스홀더 — href/src 모양이지만 실제 링크 아님
TEMPLATE_MARKS = ('${', '{{')

# R2/Drive에 호스팅되어 리포에 없는 게 정상인 미디어/자막 (황금 원칙 P2)
MEDIA_EXTS = {'.mp4', '.m4a', '.mp3', '.wav', '.pdf',
              '.pptx', '.docx', '.zip', '.vtt'}


def extract_links(html_path):
    """HTML에서 href/src 링크 추출 (중복 제거, 등장 순서 유지)"""
    with open(html_path, encoding='utf-8') as f:
        content = f.read()
    seen, links = set(), []
    for _, raw in ATTR_RE.findall(content):
        link = raw.strip()
        if link and link not in seen:
            seen.add(link)
            links.append(link)
    return links


def classify(link):
    """링크 종류 판별: external | template | media | internal"""
    if link.lower().startswith(SKIP_PREFIXES):
        return 'external'
    if any(mark in link for mark in TEMPLATE_MARKS):
        return 'template'
    path = link.split('?', 1)[0].split('#', 1)[0]
    if not path:                       # 쿼리/앵커만 남음 → 비파일
        return 'external'
    if os.path.splitext(path)[1].lower() in MEDIA_EXTS:
        return 'media'
    return 'internal'


def resolve_internal(link, file_dir, root_dir):
    """
    내부 링크를 디스크 경로로 해석. 반환: (실제경로, 존재여부)
    - 쿼리(?v=)·프래그먼트(#) 제거
    - 루트절대(/x)는 root_dir 기준, 그 외는 file_dir 기준
    - 확장자 없으면 cleanUrls 가정해 .html 보강 시도
    """
    path = link.split('?', 1)[0].split('#', 1)[0]
    if path.startswith('/'):
        base, rel = root_dir, path.lstrip('/')
    else:
        base, rel = file_dir, path

    target = os.path.normpath(os.path.join(base, rel))
    if os.path.exists(target):
        return target, True

    if not os.path.splitext(rel)[1]:   # 확장자 없는 링크 → cleanUrls
        if os.path.exists(target + '.html'):
            return target + '.html', True

    return target, False


def check_external(url, timeout=8):
    """외부 URL HTTP 점검 (--check-external 시에만). 반환: (ok, 사유)"""
    import urllib.request
    import urllib.error
    req = urllib.request.Request(url, method='HEAD',
                                 headers={'User-Agent': 'link-check/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return (resp.status < 400), f'HTTP {resp.status}'
    except urllib.error.HTTPError as e:
        if e.code in (403, 405):       # HEAD 거부 서버 → GET 재시도
            try:
                req.method = 'GET'
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return (resp.status < 400), f'HTTP {resp.status}'
            except Exception as e2:
                return False, type(e2).__name__
        return False, f'HTTP {e.code}'
    except Exception as e:
        return False, type(e).__name__


def main():
    parser = argparse.ArgumentParser(description='HTML 링크 검증 도구')
    parser.add_argument('--path', default='.',
                        help='검사할 경로(리포 루트) (기본: 현재 디렉토리)')
    parser.add_argument('--check-external', action='store_true',
                        help='외부 URL도 HTTP로 점검 (네트워크 필요, 느림)')
    args = parser.parse_args()

    root_dir = os.path.abspath(args.path)
    files = sorted(glob.glob(os.path.join(args.path, '*.html')))

    if not files:
        print(f'검사할 파일 없음: {os.path.join(args.path, "*.html")}')
        sys.exit(0)

    print(f'\n{"="*60}')
    print(f'  링크 검사 — {len(files)}개 HTML 파일')
    print(f'{"="*60}')

    broken = []                 # 내부 깨진 링크
    internal_ok = 0
    media_count = 0
    template_count = 0
    external_links = set()      # 외부 URL(중복 제거)

    for filepath in files:
        filename = os.path.basename(filepath)
        file_dir = os.path.dirname(os.path.abspath(filepath))
        file_broken = []

        for link in extract_links(filepath):
            kind = classify(link)
            if kind == 'external':
                external_links.add(link)
            elif kind == 'template':
                template_count += 1
            elif kind == 'media':
                media_count += 1
            else:  # internal
                _, exists = resolve_internal(link, file_dir, root_dir)
                if exists:
                    internal_ok += 1
                else:
                    file_broken.append(link)
                    broken.append({'file': filename, 'link': link})

        if file_broken:
            print(f'  ❌ {filename:<45} 깨진 링크 {len(file_broken)}개')
            for link in file_broken:
                print(f'       → {link}')
        else:
            print(f'  ✅ {filename:<45} 내부 링크 정상')

    # 외부 링크 점검 (옵션)
    external_broken = []
    if args.check_external:
        print(f'\n  외부 링크 HTTP 점검 — {len(external_links)}개 URL')
        for url in sorted(external_links):
            ok, reason = check_external(url)
            print(f'    {"✅" if ok else "❌"} {reason:<14} {url}')
            if not ok:
                external_broken.append({'url': url, 'reason': reason})

    # 요약
    print(f'\n{"="*60}')
    print(f'  내부 정상: {internal_ok} | 내부 깨짐: {len(broken)} | '
          f'미디어(R2/Drive): {media_count} | 템플릿: {template_count} | '
          f'외부: {len(external_links)}', end='')
    if args.check_external:
        print(f' (깨짐 {len(external_broken)})')
    else:
        print('  (외부는 --check-external)')
    print(f'{"="*60}\n')

    fail = bool(broken) or bool(external_broken)
    if broken:
        print('  💡 깨진 내부 링크: 대상 파일명/경로 오타 또는 누락 파일을 확인하세요')
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
