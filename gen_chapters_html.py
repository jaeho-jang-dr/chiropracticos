"""Generate HTML files for chapters 4-12 from template."""
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

OUT = r"G:\내 드라이브\chiropracticos"

chapters = [
    {
        "num": 4, "file": "chapter04_gonstead.html", "title": "Gonstead Technique",
        "subtitle": "5 Components 특이적 분석 · X-ray listing · Level Disc Theory",
        "breadcrumb": "Chapter 4",
        "notebook_id": "4e8b2040-ae5a-438c-90ad-a8acc7a542f2",
        "prev": ("chapter03_diversified.html", "3. Diversified"),
        "next": ("chapter05_toggle_recoil.html", "5. Toggle Recoil"),
        "evidence": "🟡 Moderate — 요통·경추통 SMT (Cochrane)",
        "overview": "Clarence S. Gonstead(1898-1978)가 1923년부터 정립한 <strong>특이적 분석 시스템</strong>. 골반 foundation + Level Disc Theory + 5 Components(History·Posture·Instrumentation/Nervoscope·Palpation·X-ray) 일치 시에만 교정. Gonstead listing 체계로 변위 특이 기록.",
        "crit_key": "X-ray 의존도 높음",
        "crit_body": "전장척추 X-ray 필수 — 임산부·반복 피폭 주의. 분석 신뢰도는 중간 수준. 현대 의학에서 수용되지 않는 'wedging이 모든 질환 원인'류 확장 주장은 🔴 No evidence."
    },
    {
        "num": 5, "file": "chapter05_toggle_recoil.html", "title": "Toggle Recoil (HIO)",
        "subtitle": "상부경추 특이 교정 · B.J. Palmer 1930s · 🔴 HIO 전신질환 치료설은 근거 없음",
        "breadcrumb": "Chapter 5",
        "notebook_id": "2b8b7956-cc5e-4591-a0c1-b0904f95d591",
        "prev": ("chapter04_gonstead.html", "4. Gonstead"),
        "next": ("chapter06_thompson.html", "6. Thompson"),
        "evidence": "🟠 Limited — 기계적 효과는 있으나 전신 치료설은 No evidence",
        "overview": "B.J. Palmer가 1930년대 발표한 상부경추(C1·C2) 특이 교정. 측와위·pisiform 접촉·drop headpiece의 고속 저진폭 추력. NUCCA·Atlas Orthogonal·Grostic·Blair 등 파생술의 원형.",
        "crit_key": "🔴 HIO (Hole-In-One) 가설의 과장",
        "crit_body": "'단일 환추 교정이 전신 질환을 치료한다'는 B.J. Palmer의 HIO 가설은 <strong>현대 의학에서 수용되지 않음</strong>. 고혈압 RCT(U Chicago) 제한적 결과, 어지럼·두통은 일부 증례에서 효과. Cassidy 2008·Church 2016 SR — VAD와 카이로프랙틱 causation 증거 없음. 환축관절 불안정성(Down syndrome·RA)은 절대 금기."
    },
    {
        "num": 6, "file": "chapter06_thompson.html", "title": "Thompson Drop Table",
        "subtitle": "J. Clay Thompson 1950s · Derifield-Thompson Leg Check · 드롭 테이블 기계",
        "breadcrumb": "Chapter 6",
        "notebook_id": "b01b6979-fff3-432e-b62c-d351a389b853",
        "prev": ("chapter05_toggle_recoil.html", "5. Toggle Recoil"),
        "next": ("chapter07_activator.html", "7. Activator"),
        "evidence": "🟡 Moderate — 요추·골반 SMT",
        "overview": "Segmental Drop Table의 공압 낙하 보조 추력 + Derifield-Thompson leg check 분석. 최소 힘·고속 추력으로 고령·임산부·HVLA 거부 환자에 적합.",
        "crit_key": "Leg Check 신뢰도 제한",
        "crit_body": "Derifield-Thompson leg check의 inter-examiner reliability는 🟠 Limited. 훈련 6시간+ 요구. 단독 분석 도구로는 부족 — Motion Palpation·정형학 검사와 병행 권장."
    },
    {
        "num": 7, "file": "chapter07_activator.html", "title": "Activator Methods",
        "subtitle": "Arlan Fuhr · 기구 교정 140N · NIH grant 수혜 · 저강도 안전",
        "breadcrumb": "Chapter 7",
        "notebook_id": "b250bba3-2ff3-44e1-9bd0-3b0fb26aaabd",
        "prev": ("chapter06_thompson.html", "6. Thompson"),
        "next": ("chapter08_cox.html", "8. Cox"),
        "evidence": "🟡 Moderate — 수기 SMT와 동등 효과 (Huggins 2012 JMPT SR)",
        "overview": "Activator Instrument (스프링 구동, 140N·0.3-1.6mm 변위) + Leg Length Reactivity 기반 Basic Scan Protocol. 1985 NIH grant 수혜(카이로프랙틱 최초) — 150+ peer-reviewed 연구.",
        "crit_key": "Leg Length 분석의 과학적 한계",
        "crit_body": "MMT·LLR이 기능적 병변을 정확히 반영하는지는 논쟁적. 🟠 LLR 신뢰도는 훈련 술자에서 moderate. 단, 기구 자체의 기계적 효과는 🟡 Moderate evidence. 고령·소아·임산부 안전성은 🟢."
    },
    {
        "num": 8, "file": "chapter08_cox.html", "title": "Cox Flexion-Distraction",
        "subtitle": "James M. Cox · 추간판 감압 · Protocol I/II/III · 요추 디스크 탈출",
        "breadcrumb": "Chapter 8",
        "notebook_id": "4c81bbd8-19e9-4727-9e48-eaf5a0a389b2",
        "prev": ("chapter07_activator.html", "7. Activator"),
        "next": ("chapter09_logan.html", "9. Logan"),
        "evidence": "🟡 Moderate — 요추 디스크 + 신경근증 (Gudavalli 연방 연구)",
        "overview": "Cox Table의 굴곡-신연 기전 — 추간판 내압 <strong>-192mmHg</strong>, 추간공 면적 <strong>+28%</strong>. Protocol I(순수 신연, radiculopathy 전용), II(+HVLA), III(재활). 수술 전 보존 치료 옵션.",
        "crit_key": "🔴 마미증후군은 절대 금기",
        "crit_body": "Cauda equina syndrome — 즉시 응급 수술 대상, Cox 시술 절대 금기. 중증 골다공증·감염·종양·대동맥류 의심 시 회피. Gudavalli 연방 연구가 생체역학 수치 검증 — 신뢰 가능한 과학 근거."
    },
    {
        "num": 9, "file": "chapter09_logan.html", "title": "Logan Basic Technique",
        "subtitle": "Hugh B. Logan 1931 · 천골 apex · 2-10 oz 극저강도 · 임산부·소아",
        "breadcrumb": "Chapter 9",
        "notebook_id": "a8039cf8-6d09-49f4-b80b-9e5e78c0a968",
        "prev": ("chapter08_cox.html", "8. Cox"),
        "next": ("chapter10_sot.html", "10. SOT"),
        "evidence": "🟠 Limited-Moderate — 임산부·소아 안전성 🟢",
        "overview": "천골 apex에 sacrotuberous ligament 부착점을 통한 극저강도 접촉. 2-10 oz(감은 눈꺼풀 누르는 수준) 압력. 임산부·영유아·고령·HVLA 거부 환자에서 🟢 Strong safety profile.",
        "crit_key": "근거 연구 제한적",
        "crit_body": "Surface EMG 연구(NCT00728572) 일부 근거, 월경통·측만증 증례 보고. RCT 부족 — 효과 크기는 🟠 Limited-Moderate. 안전성만큼은 확실 — 다른 기법 금기 환자에서 대안."
    },
    {
        "num": 10, "file": "chapter10_sot.html", "title": "Sacro-Occipital Technique (SOT)",
        "subtitle": "DeJarnette 카테고리 I/II/III · 골반 블록 🟡 · 🔴 Cranial·Visceral 주장은 No evidence",
        "breadcrumb": "Chapter 10",
        "notebook_id": "2b73a534-51e0-4404-8538-7b60bc4dc780",
        "prev": ("chapter09_logan.html", "9. Logan"),
        "next": ("chapter11_cbp.html", "11. Harrison CBP"),
        "evidence": "🟡 Moderate (Pelvic blocks) / 🔴 Cranial·Visceral (No evidence)",
        "overview": "Major DeJarnette(1920s-1992) 카테고리 I(골반 torsion), II(천장관절 체중지지), III(posterior SI 디스크). 쐐기형 pelvic blocks로 환자 호흡·체중을 활용한 저침습 교정.",
        "crit_key": "🔴 Cranial bones rhythmic motion / Visceral manipulation 주장",
        "crit_body": "SOT의 pelvic blocks 사용은 🟡 moderate 근거가 있지만, <strong>두개골 리듬 진단·내장 조작으로 전신 질환 치료 주장</strong>은 🔴 No reliable evidence. 본 강의는 Category 진단과 블록 사용만 권장, Cranial/CMRT Visceral 부분은 비판적으로 다룸."
    },
    {
        "num": 11, "file": "chapter11_cbp.html", "title": "Chiropractic BioPhysics (CBP)",
        "subtitle": "Donald & Deed Harrison · 수학·선형대수 기반 · Mirror Image® · Denneroll",
        "breadcrumb": "Chapter 11",
        "notebook_id": "37eea36e-8142-45af-b223-108d078ebd09",
        "prev": ("chapter10_sot.html", "10. SOT"),
        "next": ("chapter12_ak.html", "12. AK"),
        "evidence": "🟡 Moderate — 경추·요추 lordosis 회복 case series",
        "overview": "Harrison 부자가 수학·선형대수 기반으로 정립. Mirror image® 교정(변형 방향의 반대로 자세·운동·견인). Denneroll 3D 견인. 경추·요추·거북목 구조 재활.",
        "crit_key": "증례 중심 근거의 한계",
        "crit_body": "PMC 60례 case series 등 근거는 있지만 RCT 부족. Dynamic Chiropractic <em>Spinal Graffiti</em> — Harrison 모델의 비판론 존재. 방사선 측정 신뢰도는 🟡 Moderate(Harrison et al. 연구)."
    },
    {
        "num": 12, "file": "chapter12_ak.html", "title": "Applied Kinesiology (AK)",
        "subtitle": "George Goodheart 1964 · MMT · 🔴 알레르기·영양 진단 주장은 근거 없음",
        "breadcrumb": "Chapter 12",
        "notebook_id": "416ef164-398d-46f0-8d11-45558467bd7f",
        "prev": ("chapter11_cbp.html", "11. Harrison CBP"),
        "next": (None, None),
        "evidence": "🟡 MMT 자체 / 🔴 AK 확장 진단 주장",
        "overview": "George Goodheart가 1964년 창시. Manual Muscle Testing(MMT)과 5 IVF factors(nerve·neurolymphatic/Chapman·neurovascular/Bennett·CSF·meridian). 한국 임상에서 대한응용근신경학회 중심 수용.",
        "crit_key": "🔴 근력검사로 알레르기·영양·장기 진단은 No evidence",
        "crit_body": "FoodAllergy.org 'unproven diagnostic test' 지정. 이중맹검 RCT(Staehle 2005)에서 AK validity 부정적. PMC scoping review 비판. 본 강의: MMT 자체의 근력 측정 기능은 🟡 유용하나, <strong>AK의 알레르기·영양·장기 진단 확장 주장은 🔴 제외</strong>. Chapman 반사점의 신경해부학적 기초는 StatPearls에 기재되어 있으나 임상 진단 정확도는 별도."
    },
]

# Load template
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "_chapter_template.html")
# Write template inline since it's long
TEMPLATE = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} | Chiropractic</title>
  <meta name="description" content="Chapter {num}. {title} — {subtitle}. 근거 기반, 비판적 시각 포함." />
  <link rel="stylesheet" href="./assets/main.css" />
</head>
<body>

  <nav class="site-nav" aria-label="주 메뉴">
    <div class="nav-inner">
      <a class="nav-brand" href="./index.html"><span class="mark"></span><span>Chiropractic</span></a>
      <ul class="nav-links">
        <li><a href="./index.html#core">철학</a></li>
        <li><a href="./index.html#history">역사</a></li>
        <li><a href="./index.html#curriculum">커리큘럼</a></li>
        <li><a href="./index.html#format">학습 포맷</a></li>
        <li><a href="./index.html#principle">원칙</a></li>
      </ul>
      <div class="nav-actions">
        <a class="btn btn-ghost btn-sm" href="./login.html">로그인</a>
        <a class="btn btn-primary btn-sm" href="./index.html#curriculum">커리큘럼</a>
      </div>
    </div>
  </nav>

  <header class="hero-chapter">
    <div class="container">
      <div class="breadcrumb">
        <a href="./index.html">Chiropractic</a>&nbsp;/&nbsp;<a href="./index.html#curriculum">커리큘럼</a>&nbsp;/&nbsp;{breadcrumb}
      </div>
      <h1>Chapter {num}. {title}</h1>
      <h2>{subtitle}</h2>
    </div>
  </header>

  <nav class="site-nav" aria-label="챕터 섹션" style="top: var(--nav-h); background: var(--glass-bg-strong);">
    <div class="nav-inner" style="justify-content: center;">
      <ul class="nav-links" style="justify-content: center;">
        <li><a href="#overview">개요</a></li>
        <li><a href="#theory">이론·기전</a></li>
        <li><a href="#clinical">임상 적용</a></li>
        <li><a href="#evidence">근거 수준</a></li>
        <li><a href="#critical">🔴 비판적 시각</a></li>
        <li><a href="#resources">자료</a></li>
      </ul>
    </div>
  </nav>

  <main>

    <section id="editorial">
      <div class="callout callout-info">
        <h4>📘 편집 원칙</h4>
        <p>근거 기반 의학(EBM) 관점. Vitalism · 전신질환 인과론 · 한의학 경락 · AK 진단 확장 · Cranial rhythm 등 No evidence 주장은 🔴 제외 또는 비판적으로만 언급합니다.</p>
      </div>
    </section>

    <section id="overview">
      <h2>개요</h2>
      <div class="principle-card">
        <h3>본 챕터가 다루는 기법</h3>
        <p>{overview}</p>
      </div>
      <h3>근거 수준 한눈에</h3>
      <div class="callout callout-tip"><h4>근거</h4><p>{evidence}</p></div>
    </section>

    <section id="theory">
      <h2>이론·기전</h2>
      <p class="section-lead">모든 카이로프랙틱 기법은 <strong>Afferentation → 중추 처리 → Efferentation</strong> 프레임(Chapter 2 참조)에서 해석합니다. 이 기법이 어떤 구심성 입력을 만들고 어떤 원심 출력을 조절하는지.</p>
      <div class="placeholder"><strong>[상세 이론 본문 자리]</strong> 창시자·역사·생체역학·신경생리 — 추후 확장 예정. Chapter 2 Functional Neurology의 Aff/Def/Eff 프레임으로 이 기법을 재해석.</div>
    </section>

    <section id="clinical">
      <h2>임상 적용</h2>
      <div class="placeholder"><strong>[임상 프로토콜 본문 자리]</strong> 적응증·환자 자세·접촉점·추력 벡터·주의점·안전. 다학제 협진 맥락에서의 위치.</div>
    </section>

    <section id="evidence">
      <h2>근거 수준</h2>
      <table class="data-table">
        <thead><tr><th>적응증</th><th>근거 수준</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td>본 기법 주된 적응증</td><td>{evidence}</td><td>상세는 강의록 MD 참조</td></tr>
          <tr style="background:#fff3f3;"><td>🔴 전신질환·내장·자폐·ADHD·천식·고혈압 치료</td><td><span class="evidence ev-none">🔴 No evidence</span></td><td>Cochrane·PubMed 근거 없음</td></tr>
        </tbody>
      </table>
    </section>

    <section id="critical" style="scroll-margin-top: 120px;">
      <h2>🔴 비판적 시각</h2>
      <div class="callout callout-danger">
        <h4>{crit_key}</h4>
        <p>{crit_body}</p>
      </div>
      <p>상세 비판 문헌 리뷰와 과장 vs 근거 비교표는 강의록 MD 확장판에서 다룹니다.</p>
    </section>

    <section id="resources">
      <h2>강의 자료</h2>
      <p class="section-lead">NotebookLM으로 제작 진행 중. 완료되면 아래 링크 활성화.</p>
      <div class="resource-row">
        <a class="resource-link" href="#" title="강의록 MD 작성 예정"><span class="icon">📖</span><span>강의록 MD<br/><small>작성 예정</small></span></a>
        <a class="resource-link" href="#" title="생성 대기"><span class="icon">🎧</span><span>팟캐스트<br/><small>Google 생성 중</small></span></a>
        <a class="resource-link" href="#" title="생성 대기"><span class="icon">🎥</span><span>영상 Part 1/2<br/><small>Google 생성 중</small></span></a>
        <a class="resource-link" href="#" title="생성 대기"><span class="icon">🎴</span><span>PPTX 슬라이드<br/><small>추후 제출</small></span></a>
      </div>
      <p>NotebookLM 노트북: <a href="https://notebooklm.google.com/notebook/{notebook_id}" target="_blank" rel="noopener">열기 →</a></p>
    </section>

  </main>

  <footer>
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-col">
          <h5>챕터 탐색</h5>
          <ul>
            <li><a href="./index.html">← 메인</a></li>
            {prev_link}
            <li><strong>{breadcrumb} (현재)</strong></li>
            {next_link}
          </ul>
        </div>
        <div class="footer-col">
          <h5>이 챕터 자료</h5>
          <ul>
            <li><em>강의록 MD (작성 예정)</em></li>
            <li><em>팟캐스트 · 영상 (Google 생성 중)</em></li>
            <li><em>PPTX (추후 제출)</em></li>
          </ul>
        </div>
        <div class="footer-col">
          <h5>외부 근거</h5>
          <ul>
            <li><a href="https://www.cochranelibrary.com/" target="_blank" rel="noopener">Cochrane Library</a></li>
            <li><a href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener">PubMed</a></li>
            <li><a href="https://notebooklm.google.com/notebook/{notebook_id}" target="_blank" rel="noopener">이 챕터 NotebookLM</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h5>계정</h5>
          <ul>
            <li><a href="./login.html">로그인</a></li>
            <li><a href="./signup.html">가입</a></li>
            <li><a href="./admin.html">관리자</a></li>
            <li><a href="mailto:drjang00@gmail.com">문의</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>(C) 2026 Dr. Jang · Chapter {num}. {title}</span>
        <span>교육 목적 · 임상 판단은 담당 의료진의 책임</span>
      </div>
    </div>
  </footer>

</body>
</html>
"""

for ch in chapters:
    prev_link = f'<li><a href="./{ch["prev"][0]}">← {ch["prev"][1]}</a></li>' if ch["prev"][0] else ""
    next_link = f'<li><a href="./{ch["next"][0]}">{ch["next"][1]} →</a></li>' if ch["next"][0] else "<li><em>(마지막 챕터)</em></li>"
    html = TEMPLATE.format(
        num=ch["num"], title=ch["title"], subtitle=ch["subtitle"], breadcrumb=ch["breadcrumb"],
        notebook_id=ch["notebook_id"],
        overview=ch["overview"], evidence=ch["evidence"],
        crit_key=ch["crit_key"], crit_body=ch["crit_body"],
        prev_link=prev_link, next_link=next_link,
    )
    path = os.path.join(OUT, ch["file"])
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[HTML] {ch['file']}  ({os.path.getsize(path)//1024} KB)")

print(f"\n총 {len(chapters)}개 HTML 챕터 생성 완료")
