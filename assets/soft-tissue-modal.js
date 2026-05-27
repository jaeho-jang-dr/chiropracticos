/* =========================================================
   Soft Tissue Techniques — Detail Modal
   - 11개 연부조직 기법의 자세한 설명·SVG 일러스트·근거를
     클릭형 모달로 표시.
   - 호출: <button data-stt="art">① ART</button>
           또는 <a data-stt="iastm">② IASTM</a>
   - ESC / 외부 클릭 / ✕ 으로 닫기
   ========================================================= */
(function () {
  'use strict';

  // ---------- SVG 일러스트 (간결한 schematic 스타일) ----------
  var SVG = {
    art:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="ar1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker></defs>' +
      '<rect x="0" y="0" width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">ART — Iliopsoas 적용 예 (능동 고관절 신전)</text>' +
      '<path d="M80,150 Q140,80 220,90 L260,90 Q330,90 360,150 L370,210 L80,210 Z" fill="#fde8e2" stroke="#c0392b" stroke-width="1.5"/>' +
      '<text x="200" y="135" font-size="11" fill="#5b1a13" font-weight="700">Iliopsoas (장요근)</text>' +
      '<path d="M340,180 L420,150" stroke="#c0392b" stroke-width="2" marker-end="url(#ar1)"/>' +
      '<text x="380" y="140" font-size="10" fill="#c0392b">고관절 신전</text>' +
      '<circle cx="200" cy="170" r="12" fill="#fff" stroke="#333" stroke-width="2"/><text x="200" y="174" text-anchor="middle" font-size="11" font-weight="700">접촉</text>' +
      '<path d="M200,158 L200,130" stroke="#333" stroke-width="1.5" stroke-dasharray="3,3"/>' +
      '<text x="205" y="125" font-size="10" fill="#333">시술자 엄지 (1)</text>' +
      '<g transform="translate(40,235)"><text x="0" y="0" font-size="11" fill="#333" font-weight="700">절차:</text>' +
      '<text x="40" y="0" font-size="11" fill="#333">①단축 자세 접촉  ②환자 능동 신장  ③5-7초 longitudinal tension  ④3 cycle</text></g>' +
      '</svg>',

    iastm:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">IASTM / Graston — 6 기구 + 마찰 방향</text>' +
      '<g transform="translate(40,50)">' +
      '<rect x="0" y="0" width="50" height="100" rx="8" fill="#d6dade" stroke="#666"/><text x="25" y="115" text-anchor="middle" font-size="10">GT-1</text>' +
      '<rect x="65" y="10" width="50" height="90" rx="6" fill="#d6dade" stroke="#666"/><text x="90" y="115" text-anchor="middle" font-size="10">GT-2</text>' +
      '<rect x="130" y="20" width="50" height="80" rx="20" fill="#d6dade" stroke="#666"/><text x="155" y="115" text-anchor="middle" font-size="10">GT-3</text>' +
      '<rect x="195" y="5" width="50" height="95" rx="4" fill="#d6dade" stroke="#666"/><text x="220" y="115" text-anchor="middle" font-size="10">GT-4</text>' +
      '<rect x="260" y="15" width="50" height="85" rx="15" fill="#d6dade" stroke="#666"/><text x="285" y="115" text-anchor="middle" font-size="10">GT-5</text>' +
      '<rect x="325" y="0" width="50" height="100" rx="2" fill="#d6dade" stroke="#666"/><text x="350" y="115" text-anchor="middle" font-size="10">GT-6</text>' +
      '</g>' +
      '<path d="M60,200 Q120,180 180,200 T300,200 T420,200" stroke="#c0392b" stroke-width="2" fill="none"/>' +
      '<text x="240" y="245" text-anchor="middle" font-size="11" fill="#333">스트로크: <tspan font-weight="700">Sweeping · Fanning · Brushing · Strumming · Framing</tspan></text>' +
      '<text x="240" y="265" text-anchor="middle" font-size="10" fill="#666">치료 후 punctate erythema 정상 · 5-15분/부위</text>' +
      '</svg>',

    nimmo:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Nimmo Receptor-Tonus — 허혈성 압박 시간-압력 프로파일</text>' +
      // axes
      '<line x1="60" y1="240" x2="440" y2="240" stroke="#333" stroke-width="1.5"/>' +
      '<line x1="60" y1="60" x2="60" y2="240" stroke="#333" stroke-width="1.5"/>' +
      '<text x="50" y="60" text-anchor="end" font-size="10">압력</text>' +
      '<text x="445" y="255" font-size="10">시간(초)</text>' +
      // pressure curve cycle 1
      '<path d="M60,240 L100,80 L160,80 L180,240" stroke="#c0392b" stroke-width="2.5" fill="none"/>' +
      '<text x="130" y="105" text-anchor="middle" font-size="10" fill="#c0392b" font-weight="700">5-7초 hold</text>' +
      // cycle 2
      '<path d="M200,240 L240,80 L300,80 L320,240" stroke="#c0392b" stroke-width="2.5" fill="none"/>' +
      // cycle 3
      '<path d="M340,240 L380,80 L420,80 L440,240" stroke="#c0392b" stroke-width="2.5" fill="none"/>' +
      '<text x="120" y="260" text-anchor="middle" font-size="10">Cycle 1</text>' +
      '<text x="260" y="260" text-anchor="middle" font-size="10">Cycle 2</text>' +
      '<text x="390" y="260" text-anchor="middle" font-size="10">Cycle 3</text>' +
      '<text x="240" y="170" text-anchor="middle" font-size="10" fill="#666">통증 점수 7/10 수준 (Pain-pressure threshold 부근)</text>' +
      '<text x="240" y="190" text-anchor="middle" font-size="10" fill="#666">목표: 안정 시 근육 길이 회복</text>' +
      '</svg>',

    tpt:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Trigger Point — Taut Band + 연관통 패턴 (상부 승모근 예)</text>' +
      // head
      '<ellipse cx="240" cy="80" rx="40" ry="50" fill="none" stroke="#333" stroke-width="1.5"/>' +
      // shoulder/trapezius
      '<path d="M180,130 Q120,150 100,200 L150,210 Q200,180 240,170 Q280,180 330,210 L380,200 Q360,150 300,130 Z" fill="#fde8e2" stroke="#c0392b" stroke-width="1.5"/>' +
      '<text x="240" y="200" text-anchor="middle" font-size="11" fill="#5b1a13" font-weight="700">상부 승모근</text>' +
      // taut band
      '<path d="M170,170 L310,170" stroke="#a83232" stroke-width="3"/>' +
      '<text x="100" y="170" font-size="10" fill="#a83232">Taut band →</text>' +
      // trigger point
      '<circle cx="220" cy="170" r="6" fill="#c0392b" stroke="#5b1a13" stroke-width="1.5"/>' +
      '<text x="220" y="160" text-anchor="middle" font-size="10" fill="#c0392b" font-weight="700">TrP</text>' +
      // referred pain (head)
      '<path d="M220,165 Q240,120 260,80" stroke="#e88c80" stroke-width="2" stroke-dasharray="4,3" fill="none"/>' +
      '<ellipse cx="265" cy="75" rx="14" ry="8" fill="rgba(232,140,128,0.3)" stroke="#e88c80"/>' +
      '<text x="290" y="60" font-size="10" fill="#e88c80">연관통 (측두부)</text>' +
      '<text x="60" y="260" font-size="10" fill="#333"><tspan font-weight="700">Jump sign</tspan> · <tspan font-weight="700">LTR</tspan> (local twitch response) · 연관통 재현으로 진단</text>' +
      '</svg>',

    cyriax:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="cf-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2563eb"/></marker></defs>' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Cyriax Cross-Friction — 90° 횡마찰 (외측상과염 예)</text>' +
      // tendon fibers
      '<g transform="translate(60,80)">' +
      '<line x1="0" y1="20" x2="360" y2="20" stroke="#8b5a3c" stroke-width="4"/>' +
      '<line x1="0" y1="40" x2="360" y2="40" stroke="#8b5a3c" stroke-width="4"/>' +
      '<line x1="0" y1="60" x2="360" y2="60" stroke="#8b5a3c" stroke-width="4"/>' +
      '<line x1="0" y1="80" x2="360" y2="80" stroke="#8b5a3c" stroke-width="4"/>' +
      '<line x1="0" y1="100" x2="360" y2="100" stroke="#8b5a3c" stroke-width="4"/>' +
      '<text x="-10" y="20" text-anchor="end" font-size="10">건 섬유 →</text>' +
      // perpendicular friction
      '<path d="M180,0 L180,120" stroke="#2563eb" stroke-width="3" marker-end="url(#cf-ar)"/>' +
      '<path d="M180,120 L180,0" stroke="#2563eb" stroke-width="3" marker-end="url(#cf-ar)"/>' +
      '<text x="200" y="125" font-size="11" font-weight="700" fill="#2563eb">90° 횡방향 마찰</text>' +
      '</g>' +
      '<text x="60" y="240" font-size="10" fill="#333"><tspan font-weight="700">10-15분</tspan> · 환자가 무감각해질 때까지 · 직후 active stretching 또는 eccentric loading 필수</text>' +
      '<text x="60" y="258" font-size="10" fill="#c0392b">단독 사용 효과 제한적 — eccentric exercise 병행 시 명확한 이득 (Brosseau 2002 Cochrane)</text>' +
      '</svg>',

    mfr:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Myofascial Release — 90-120초 지속 압력 → Creep 현상</text>' +
      // fascia layers
      '<g transform="translate(40,60)">' +
      '<rect x="0" y="0" width="400" height="20" fill="#e3d5c8" stroke="#666"/><text x="-5" y="14" text-anchor="end" font-size="9">표피</text>' +
      '<rect x="0" y="22" width="400" height="20" fill="#d4a896" stroke="#666"/><text x="-5" y="36" text-anchor="end" font-size="9">진피</text>' +
      '<rect x="0" y="44" width="400" height="30" fill="#ffd4a3" stroke="#666"/><text x="-5" y="62" text-anchor="end" font-size="9">피하지방</text>' +
      '<rect x="0" y="76" width="400" height="14" fill="#a0c4ff" stroke="#666"/><text x="-5" y="86" text-anchor="end" font-size="9">표재근막</text>' +
      '<rect x="0" y="92" width="400" height="50" fill="#fde8e2" stroke="#c0392b"/><text x="-5" y="120" text-anchor="end" font-size="9">근육</text>' +
      '<rect x="0" y="144" width="400" height="10" fill="#2563eb" opacity="0.4" stroke="#10306b"/><text x="-5" y="152" text-anchor="end" font-size="9">심부근막</text>' +
      // sustained pressure arrow
      '<path d="M200,-15 L200,90" stroke="#c0392b" stroke-width="3"/>' +
      '<polygon points="195,85 200,95 205,85" fill="#c0392b"/>' +
      '<text x="210" y="40" font-size="10" font-weight="700" fill="#c0392b">5g-5kg</text>' +
      '<text x="210" y="55" font-size="10" font-weight="700" fill="#c0392b">90-120초</text>' +
      '</g>' +
      '<text x="240" y="245" text-anchor="middle" font-size="10" fill="#333"><tspan font-weight="700">기전:</tspan> myofibroblast 이완 + GAG hydration 회복 + thixotropy (creep)</text>' +
      '<text x="240" y="263" text-anchor="middle" font-size="10" fill="#666">Direct (제한 방향) · Indirect (최소 저항 방향) 양식 모두 사용</text>' +
      '</svg>',

    pnf:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">PNF — Contract-Relax 사이클 + D2 Flexion 패턴 (상지)</text>' +
      // CR cycle bar
      '<g transform="translate(40,60)">' +
      '<rect x="0" y="0" width="100" height="30" fill="#a0c4ff" stroke="#2563eb"/><text x="50" y="20" text-anchor="middle" font-size="10">①신장 자세</text>' +
      '<rect x="100" y="0" width="80" height="30" fill="#fde8e2" stroke="#c0392b"/><text x="140" y="20" text-anchor="middle" font-size="10">②6초 수축</text>' +
      '<rect x="180" y="0" width="60" height="30" fill="#fff" stroke="#666"/><text x="210" y="20" text-anchor="middle" font-size="10">③이완</text>' +
      '<rect x="240" y="0" width="120" height="30" fill="#a0c4ff" stroke="#2563eb"/><text x="300" y="20" text-anchor="middle" font-size="10">④더 깊은 신장</text>' +
      '<text x="180" y="50" text-anchor="middle" font-size="10" fill="#333">Contract-Relax 사이클 (3-5회 반복)</text>' +
      '</g>' +
      // D2 pattern arm
      '<g transform="translate(60,140)">' +
      '<line x1="0" y1="80" x2="60" y2="40" stroke="#333" stroke-width="3"/>' +
      '<line x1="60" y1="40" x2="120" y2="60" stroke="#333" stroke-width="3"/>' +
      '<circle cx="0" cy="80" r="6" fill="#333"/><text x="-5" y="100" text-anchor="end" font-size="9">시작</text>' +
      '<circle cx="120" cy="60" r="6" fill="#fff" stroke="#333"/><text x="125" y="55" font-size="9">D2 굴곡</text>' +
      '<path d="M180,80 L240,40" stroke="#c0392b" stroke-width="3" stroke-dasharray="5,3"/>' +
      '<path d="M240,40 L300,60" stroke="#c0392b" stroke-width="3" stroke-dasharray="5,3"/>' +
      '<circle cx="180" cy="80" r="6" fill="#333"/>' +
      '<circle cx="300" cy="60" r="6" fill="#fff" stroke="#c0392b"/><text x="305" y="55" font-size="9" fill="#c0392b">D2 신전(역방향)</text>' +
      '<text x="60" y="-5" font-size="10" font-weight="700" fill="#2563eb">D2 패턴 (대각·나선)</text>' +
      '</g>' +
      '<text x="240" y="265" text-anchor="middle" font-size="9" fill="#666">기전: Autogenic inhibition (Ib·GTO) + Reciprocal inhibition</text>' +
      '</svg>',

    met:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">MET — Barrier 단계적 이동 (5 cycle)</text>' +
      // axes
      '<line x1="60" y1="240" x2="440" y2="240" stroke="#333" stroke-width="1.5"/>' +
      '<line x1="60" y1="60" x2="60" y2="240" stroke="#333" stroke-width="1.5"/>' +
      '<text x="50" y="65" text-anchor="end" font-size="10">ROM</text>' +
      '<text x="445" y="255" font-size="10">cycle</text>' +
      // stepwise barrier progression
      '<path d="M60,200 L120,200 L120,170 L180,170 L180,140 L240,140 L240,115 L300,115 L300,95 L360,95" stroke="#2563eb" stroke-width="2.5" fill="none"/>' +
      // barrier markers
      '<circle cx="120" cy="200" r="4" fill="#c0392b"/><text x="120" y="220" text-anchor="middle" font-size="9">b1</text>' +
      '<circle cx="180" cy="170" r="4" fill="#c0392b"/><text x="180" y="190" text-anchor="middle" font-size="9">b2</text>' +
      '<circle cx="240" cy="140" r="4" fill="#c0392b"/><text x="240" y="160" text-anchor="middle" font-size="9">b3</text>' +
      '<circle cx="300" cy="115" r="4" fill="#c0392b"/><text x="300" y="135" text-anchor="middle" font-size="9">b4</text>' +
      '<circle cx="360" cy="95" r="4" fill="#c0392b"/><text x="360" y="115" text-anchor="middle" font-size="9">b5</text>' +
      '<text x="240" y="75" text-anchor="middle" font-size="10" fill="#333"><tspan font-weight="700">20-25% MVC</tspan> 등척성 수축 5-7초 → 2-3초 이완 → 새 barrier</text>' +
      '<text x="240" y="265" text-anchor="middle" font-size="9" fill="#666">PNF보다 부드러움 — sacroiliac dysfunction에 특히 효과</text>' +
      '</svg>',

    oi:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="oi-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#c0392b"/></marker></defs>' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Origin-Insertion — 기시→정지 longitudinal stripping</text>' +
      // muscle belly
      '<g transform="translate(40,80)">' +
      '<path d="M0,40 L40,30 Q80,15 200,15 Q320,15 360,30 L400,40 L400,80 L360,90 Q320,105 200,105 Q80,105 40,90 L0,80 Z" fill="#fde8e2" stroke="#c0392b" stroke-width="1.5"/>' +
      '<circle cx="20" cy="60" r="6" fill="#5b1a13"/><text x="20" y="125" text-anchor="middle" font-size="10" font-weight="700">기시 (Origin)</text>' +
      '<circle cx="380" cy="60" r="6" fill="#5b1a13"/><text x="380" y="125" text-anchor="middle" font-size="10" font-weight="700">정지 (Insertion)</text>' +
      // stripping path
      '<path d="M40,60 L360,60" stroke="#c0392b" stroke-width="3" marker-end="url(#oi-ar)"/>' +
      '<circle cx="160" cy="60" r="8" fill="#a83232" stroke="#5b1a13"/><text x="160" y="50" text-anchor="middle" font-size="9" font-weight="700" fill="#a83232">nodule</text>' +
      '<text x="200" y="80" text-anchor="middle" font-size="10" fill="#5b1a13">1 cm/sec · 발견 nodule에서 정지·압박</text>' +
      '</g>' +
      '<text x="240" y="245" text-anchor="middle" font-size="10" fill="#333">Kaleida Health 임상지침 표준 5개 기법에 포함</text>' +
      '</svg>',

    dn:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Dry Needling — 통증유발점 자입 + LTR</text>' +
      // muscle cross-section
      '<ellipse cx="240" cy="160" rx="140" ry="60" fill="#fde8e2" stroke="#c0392b" stroke-width="1.5"/>' +
      '<text x="240" y="220" text-anchor="middle" font-size="11" font-weight="700" fill="#5b1a13">근육 횡단면</text>' +
      // taut band
      '<path d="M140,160 L340,160" stroke="#a83232" stroke-width="4"/>' +
      // TrP nodule
      '<circle cx="240" cy="160" r="10" fill="#c0392b" stroke="#5b1a13" stroke-width="1.5"/>' +
      // needle
      '<line x1="240" y1="40" x2="240" y2="155" stroke="#333" stroke-width="2"/>' +
      '<circle cx="240" cy="35" r="5" fill="#666"/>' +
      '<text x="260" y="80" font-size="10" fill="#333">가는 침 (0.25-0.30mm)</text>' +
      // LTR squiggle
      '<path d="M120,160 Q140,140 160,160 T200,160" stroke="#2563eb" stroke-width="2" fill="none"/>' +
      '<text x="100" y="140" font-size="10" fill="#2563eb">← LTR</text>' +
      '<text x="60" y="260" font-size="10" fill="#c0392b" font-weight="700">⚠ 한국: 카이로프랙틱 면허 범위 외 (한의사·일부 통증의학과만)</text>' +
      '</svg>',

    cup:
      '<svg viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="480" height="280" fill="#fafbfc"/>' +
      '<text x="240" y="22" text-anchor="middle" font-family="Helvetica" font-size="13" font-weight="700" fill="#333">Cupping (Myofascial Decompression) — 음압 적용</text>' +
      // skin/tissue
      '<rect x="60" y="170" width="360" height="60" fill="#ffd4a3" stroke="#666"/><text x="50" y="200" text-anchor="end" font-size="10">피부·근막</text>' +
      // 3 cups
      '<g><path d="M100,170 L100,100 Q100,80 130,80 Q160,80 160,100 L160,170 Z" fill="rgba(192,57,43,0.15)" stroke="#c0392b" stroke-width="2"/>' +
      '<path d="M110,170 Q130,155 150,170" stroke="#c0392b" stroke-width="1" fill="none" stroke-dasharray="2,2"/>' +
      '<text x="130" y="60" text-anchor="middle" font-size="9">Static</text></g>' +
      '<g><path d="M210,170 L210,100 Q210,80 240,80 Q270,80 270,100 L270,170 Z" fill="rgba(192,57,43,0.15)" stroke="#c0392b" stroke-width="2"/>' +
      '<path d="M220,170 Q240,155 260,170" stroke="#c0392b" stroke-width="1" fill="none" stroke-dasharray="2,2"/>' +
      '<text x="240" y="60" text-anchor="middle" font-size="9">Static</text></g>' +
      '<g><path d="M320,170 L320,100 Q320,80 350,80 Q380,80 380,100 L380,170 Z" fill="rgba(192,57,43,0.15)" stroke="#c0392b" stroke-width="2"/>' +
      '<path d="M330,170 Q350,155 370,170" stroke="#c0392b" stroke-width="1" fill="none" stroke-dasharray="2,2"/>' +
      '<text x="350" y="60" text-anchor="middle" font-size="9">Dynamic (활주)</text></g>' +
      '<path d="M320,170 L400,170" stroke="#2563eb" stroke-width="2" stroke-dasharray="4,3"/>' +
      '<text x="240" y="260" text-anchor="middle" font-size="10" fill="#333">기전: 음압 → 근막 hydration + 미세순환 증가 + 통증 게이트 변화 (Cao 2012 SR)</text>' +
      '</svg>'
  };

  // ---------- 11개 기법 상세 데이터 ----------
  var TECHNIQUES = {
    art: {
      title: '① ART — Active Release Technique (능동이완기법)',
      founder: 'Michael Leahy, DC (1980년대)',
      sections: [
        { h: '🎯 원리·기전',
          body: 'ART는 근육·근막의 <strong>유착(adhesion)</strong>을 해소하기 위해 시술자의 정확한 접촉과 환자의 <strong>능동적 신장 운동</strong>을 결합합니다. 반복적 사용·산소부족·외상으로 형성된 cumulative trauma cycle을 끊는 것이 목표입니다. Leahy는 500여 개의 특허된 프로토콜(ART Protocols)을 체계화했습니다.'
        },
        { h: '🏥 해부학적 적용 예 — 장요근 (Iliopsoas)',
          body: '요추관 협착증·만성 LBP 환자에게서 장요근 단축이 흔합니다. 환자는 환측 무릎을 가슴으로 당긴 단축 자세에서 시작 → 시술자는 장요근 복부에 접촉 → 환자가 능동적으로 고관절 신전 → longitudinal tension 발생 → 유착 분리.'
        },
        { h: '📋 표준 실기 절차',
          body: '<ol><li><strong>Stage 1</strong>: 시술자가 단축 자세에서 근육·근막에 엄지·네 손가락으로 접촉점 확보</li><li><strong>Stage 2</strong>: 환자가 능동적으로 신장 방향으로 움직임 (수동 X)</li><li><strong>Stage 3</strong>: 접촉점을 유지한 채 longitudinal tension을 5-7초 유지</li><li><strong>Stage 4</strong>: 동일 부위 3회 반복 후 다음 접촉점으로 이동</li></ol>'
        },
        { h: '✅ 적응증',
          body: '장요근 단축(요추관 협착·만성 LBP), 회전근개 충돌증후군, 외측상과염, 손목터널증후군, 햄스트링·이상근 strain, 슬개건염'
        },
        { h: '⚠ 금기·주의',
          body: '<strong>절대 금기</strong>: 급성 골절·탈구, DVT, 종양 부위, 활동성 감염. <strong>상대 금기</strong>: 항응고제 복용(피하출혈 위험), 임신 복부, 심한 골다공증.'
        },
        { h: '📊 근거 수준',
          body: 'Case series 다수, RCT 부족 — <strong>Low–Moderate</strong>. 단독 사용보다 운동치료와 병행 시 효과 명확.'
        },
        { h: '💡 흔한 실수',
          body: '접촉을 유지하지 못하고 함께 미끄러지는 것 / 시술자가 환자 대신 수동 신장시키는 것(ART의 본질을 벗어남) / 압력 과다로 피하조직 손상.'
        }
      ]
    },

    iastm: {
      title: '② Graston / IASTM — Instrument-Assisted Soft Tissue Mobilization',
      founder: 'David Graston (1990년대, 인디애나)',
      sections: [
        { h: '🎯 원리·기전',
          body: '6개의 특수 스테인리스 스틸 기구로 fibrotic adhesion을 <strong>촉진(detect)</strong>하고 기계적 <strong>마이크로트라우마(microtrauma)</strong>를 유도하여 콜라겐 재합성·재배열을 자극합니다. 시술자 손가락 감각 한계를 도구가 보완합니다.'
        },
        { h: '🛠 6 도구 (GT-1 ~ GT-6)',
          body: 'GT-1 (큰 평면) — 큰 근육군 광역 스캐닝.<br>GT-2 (중간 곡면) — 대퇴·등판.<br>GT-3 (작은 원형) — 견갑·아킬레스 부위.<br>GT-4 (각진 끝) — 좁은 골 틈.<br>GT-5 (반월형) — 무릎·팔꿈치 곡면.<br>GT-6 (납작 직선) — 마무리 광역 활주.'
        },
        { h: '📋 표준 5 단계 스트로크',
          body: '<ol><li><strong>Emollient 도포</strong> — 피부 보호·미끄러짐 확보</li><li><strong>Scanning stroke</strong> — 가벼운 압력으로 병변 위치(grittiness) 확인</li><li><strong>Treatment stroke</strong> — Sweeping · Fanning · Brushing · Strumming · Framing 적용</li><li><strong>Punctate erythema</strong> 발생 시 중지 (5-15분/부위)</li><li><strong>능동 운동·저항 운동 즉시 추가</strong></li></ol>'
        },
        { h: '✅ 적응증',
          body: '아킬레스건염, 족저근막염, 외측·내측상과염, 슬개건염, 만성 흉터 조직, 회전근개 건염, 골프·테니스 엘보, 스포츠 만성 과사용 손상'
        },
        { h: '⚠ 금기·주의',
          body: '활동성 피부 감염·열상, 항응고제 복용(점상 출혈 위험), 심한 정맥류, 임신 복부, 활동성 종양 부위.'
        },
        { h: '📊 근거 수준',
          body: '<strong>Cheatham SW et al. (2016) JCCA Systematic Review</strong> — short-term ROM·통증 개선 효과 입증. 장기 추적 부족.'
        },
        { h: '🇰🇷 한국 도입',
          body: '도수치료 수가 항목으로 매우 보편적으로 시행됨. 정형외과·재활의학과 도수치료실에서 일상적으로 활용.'
        }
      ]
    },

    nimmo: {
      title: '③ Nimmo Receptor-Tonus Technique',
      founder: 'Raymond L. Nimmo, DC (1957)',
      sections: [
        { h: '🎯 핵심 이론',
          body: 'Nimmo는 <em>"비정상 관절 기능은 근육 과활성에서 비롯된다 — Subluxation 이전에 muscle dysfunction이 있다"</em>는 가설을 제시했습니다. 따라서 척추 교정 전에 근육을 먼저 안정시키는 것이 합리적이라는 임상 논리입니다.'
        },
        { h: '🩻 작용 기전 — Ischemic Compression',
          body: '통증유발점(TrP)에 지속적 압박 → 국소 허혈 → 압박 해제 시 reactive hyperemia → 산소·영양 공급 → ATP 회복 → actin-myosin cross-bridge 풀림 → 안정 시 근육 길이(resting length) 회복.'
        },
        { h: '📋 표준 실기 절차',
          body: '<ol><li>통증유발점 palpation으로 정확한 위치 결정</li><li>엄지·너클·중수지절관절로 직접 압박</li><li>환자가 통증 점수 <strong>7/10</strong> 보고하는 수준까지 압력 증가 (Pain-Pressure Threshold 부근)</li><li><strong>5-7초 유지</strong> → 점진적 감소 → 완전 이완</li><li>같은 점 <strong>2-3 cycle</strong> 반복</li><li>치료 후 능동 ROM 즉시 확인</li></ol>'
        },
        { h: '✅ 적응증',
          body: '만성 LBP, 근막통증증후군, 긴장성 두통(상부 승모근·후두하근), 경견부통, 관절 기능장애 동반 근육 과활성'
        },
        { h: '📊 근거 수준',
          body: '<strong>Koo TK, Cohen JH, Zheng YP (2012) JMPT 35(1):45-53</strong> — 만성 LBP 환자에서 즉시 근육 탄력성·통증·기능 개선 검증. 중등도 근거.'
        },
        { h: '💡 빈도',
          body: '미국 카이로프랙터 통계상 사용률 상위 10개 테크닉에 포함. 한국에서는 도수치료 압통점 치료의 직접적 기원.'
        }
      ]
    },

    tpt: {
      title: '④ Trigger Point Therapy (통증유발점 치료)',
      founder: 'Janet Travell, MD · David Simons, MD (1942~)',
      sections: [
        { h: '🎯 통증유발점 정의',
          body: '근육 내 <strong>taut band</strong>(긴장된 띠) 위의 <strong>hyperirritable spot</strong>으로, 압박 시 국소 통증과 <strong>특징적 연관통(referred pain)</strong>을 유발하는 점.<br><br><strong>Active TrP</strong>: 자발 통증 + 연관통 패턴.<br><strong>Latent TrP</strong>: 압박 시에만 통증.'
        },
        { h: '🔍 Travell-Simons 진단 5 기준',
          body: '<ol><li><strong>Taut band</strong> 촉지</li><li>Taut band 위 <strong>tender spot</strong>(압통점)</li><li>압박 시 <strong>연관통 재현</strong> (환자의 평소 통증 패턴과 일치)</li><li><strong>Jump sign</strong> (압박 시 환자가 움찔)</li><li><strong>Local Twitch Response (LTR)</strong> — 띠가 일시적으로 떨림</li></ol>'
        },
        { h: '🗺 대표적 연관통 패턴',
          body: '<ul><li><strong>상부 승모근 TrP</strong> → 측두부·후두부 두통 (편두통과 혼동)</li><li><strong>흉쇄유돌근(SCM) TrP</strong> → 안와부·이마·정수리 통증</li><li><strong>이상근 TrP</strong> → 좌골신경통 양상 (디스크와 감별 중요)</li><li><strong>견갑하근 TrP</strong> → 어깨 후면·견갑간 통증</li><li><strong>요방형근 TrP</strong> → 장골능·둔부 통증</li></ul>'
        },
        { h: '📋 치료 옵션',
          body: '<ul><li><strong>Manual ischemic compression</strong> (Nimmo 방식)</li><li><strong>Spray and stretch</strong> — vapocoolant 분무 + 수동 신장</li><li><strong>Post-isometric relaxation (PIR)</strong></li><li><strong>Cross-friction massage</strong></li><li><strong>Dry needling</strong> (면허 범위 내에서)</li></ul>'
        },
        { h: '📊 근거 수준',
          body: '<strong>Vernon H, Schneider M (2009) JMPT 32(1):14-24</strong> — Systematic Review. 카이로프랙틱 도수치료가 myofascial tissue의 <strong>pressure pain threshold</strong>를 개선한다는 <strong>moderately strong evidence</strong> 확인.'
        }
      ]
    },

    cyriax: {
      title: '⑤ Cyriax Cross-Friction Massage (시리악스 횡마찰 마사지)',
      founder: 'James Cyriax, MD (1940s, *Textbook of Orthopaedic Medicine*)',
      sections: [
        { h: '🎯 핵심 원리',
          body: 'Cyriax는 정형외과적 진단(<em>"orthopaedic medicine"</em>)의 창시자입니다. 그의 핵심 발견은 <strong>"건·인대 병변에는 섬유 방향에 수직(90°)으로 마찰을 가해야 cross-link이 분리된다"</strong>는 것이었습니다.'
        },
        { h: '🩻 생리학적 기전',
          body: '<ul><li>건·인대 섬유 사이 비정상 cross-link 기계적 분리</li><li>국소 traumatic hyperemia 유도 → 혈류 증가 → 영양·산소 공급</li><li>분해(resorption) + 재합성(recollagenation) 자극</li><li>국소 마취 효과 (gate control + endorphin)</li></ul>'
        },
        { h: '📋 표준 실기 절차',
          body: '<ol><li><strong>정확한 병변 진단</strong> — Selective tension test로 어느 구조물의 어느 부위에 병변이 있는지 결정 (Cyriax의 핵심 공헌)</li><li>병변 부위에 손가락 끝(주로 검지를 중지가 보강)으로 접촉</li><li><strong>섬유 방향에 90° 직각</strong>으로 깊은 마찰</li><li>처음 1-2분은 통증 — 환자가 무감각해질 때까지(국소 마취 효과) <strong>10-15분</strong> 지속</li><li>마찰 직후 <strong>active stretching 또는 eccentric loading</strong> 필수</li></ol>'
        },
        { h: '✅ 적응증 (Cyriax 고전)',
          body: '<ul><li><strong>외측상과염 (tennis elbow)</strong> — 공통 신전건의 ECRB 부착부</li><li><strong>슬개건염</strong> (jumper\'s knee)</li><li><strong>아킬레스건염</strong></li><li><strong>회전근개 건염</strong> (특히 극상근)</li><li><strong>De Quervain 건초염</strong></li></ul>'
        },
        { h: '⚠ 금기·주의',
          body: '활동성 감염, 출혈성 질환, 항응고제 복용(점상 출혈), 종양, 신경·동맥 주행 부위 직접 마찰 회피.'
        },
        { h: '📊 근거 수준',
          body: '<strong>Brosseau L et al. (2002) Cochrane Review</strong> — Cyriax friction 단독은 효과 제한적. <strong>eccentric exercise와 병행 시 명확한 이득.</strong> Stasinopoulos 등 후속 RCT 다수.'
        }
      ]
    },

    mfr: {
      title: '⑥ Myofascial Release (MFR · 근막 이완술)',
      founder: 'Andrew Taylor Still (osteopathy) → John F. Barnes 체계화 (1970s)',
      sections: [
        { h: '🎯 근막 해부학 기초',
          body: '근막은 단일 결합조직 sheet로 전신을 그물처럼 연결합니다. <strong>표재근막</strong>(피하)·<strong>심부근막</strong>(epimysium/perimysium)·<strong>장기근막</strong>(visceral fascia)으로 분류. 손상·만성 자세 stress·수술 흉터는 근막에 <strong>제한 패턴(restriction pattern)</strong>을 만들고 원거리까지 영향을 줍니다.'
        },
        { h: '🩻 작용 기전',
          body: '<ul><li><strong>Thixotropy</strong> — 지속 압력 90초+ 시 ground substance가 gel → sol로 액화</li><li><strong>Myofibroblast 이완</strong> — 근막 내 수축성 세포의 활성 감소</li><li><strong>GAG hydration 회복</strong> — 글리코사미노글리칸의 수분 함량 증가 → 활주 개선</li><li><strong>Mechanotransduction</strong> — 세포외기질 신호전달로 fibroblast 활성 변화</li></ul>'
        },
        { h: '📋 두 가지 양식',
          body: '<strong>Direct MFR (Rolfing 계열)</strong> — 제한 방향으로 강한 접촉 (1-5 kg). 빠른 변화, 통증 동반 가능.<br><br><strong>Indirect MFR (Barnes 방식)</strong> — 최소 저항 방향으로 5g-1kg의 가벼운 sustained pressure. <strong>90-120초 유지</strong>가 핵심 — "release" 감각이 올 때까지.'
        },
        { h: '✅ 적응증',
          body: '만성 LBP, 만성 경추통, 섬유근통, 수술 후 흉터·유착, 두통, 만성 골반통, 유착성 관절낭염, 림프부종 보조.'
        },
        { h: '⚠ 금기·주의',
          body: '활동성 감염, 급성 외상, 심부정맥혈전증, 종양 부위, 진행성 신경질환, 활동성 출혈성 질환.'
        },
        { h: '📊 근거 수준',
          body: '<strong>Ajimsha MS, Al-Mudahka NR, Al-Madzhar JA (2015) J Bodyw Mov Ther</strong> — Systematic Review of RCTs. 만성 근골격 통증에 효과적, 다만 비교군과의 차이는 small to moderate. AHRQ·NICE 가이드라인이 만성 LBP의 비약물 옵션으로 권장.'
        }
      ]
    },

    pnf: {
      title: '⑦ PNF — Proprioceptive Neuromuscular Facilitation',
      founder: 'Herman Kabat, MD · Margaret Knott · Dorothy Voss (1940-50s)',
      sections: [
        { h: '🎯 핵심 원리',
          body: '신체의 <strong>고유수용기</strong>(근방추 muscle spindle · 골지건기관 Golgi tendon organ · 관절 수용기)를 자극하여 신경근 반응을 촉진(facilitation) 또는 억제(inhibition)합니다. 정적 스트레칭보다 ROM 증가 효과가 우월하다는 것이 일관된 발견입니다.'
        },
        { h: '🧠 신경생리 기전 — 2가지 억제',
          body: '<strong>Autogenic inhibition</strong> — 근육 수축 시 골지건기관(Ib 구심 신경)이 척수로 정보 전달 → 같은 근육의 알파 운동신경 억제 → 수축 후 더 깊은 이완.<br><br><strong>Reciprocal inhibition</strong> — Agonist 수축 시 antagonist는 반사적으로 이완 (Sherrington 원리).'
        },
        { h: '📋 3대 스트레칭 기법',
          body: '<table style="width:100%; border-collapse:collapse; margin-top:.5rem;">' +
            '<tr style="background:#f1f5f9;"><th style="text-align:left; padding:6px; border:1px solid #d0d7de;">기법</th><th style="text-align:left; padding:6px; border:1px solid #d0d7de;">절차</th></tr>' +
            '<tr><td style="padding:6px; border:1px solid #d0d7de;"><strong>Contract-Relax</strong></td><td style="padding:6px; border:1px solid #d0d7de;">신장 자세 → 6초 등장성 수축 → 이완 → 더 깊은 신장</td></tr>' +
            '<tr><td style="padding:6px; border:1px solid #d0d7de;"><strong>Hold-Relax</strong></td><td style="padding:6px; border:1px solid #d0d7de;">신장 자세 → 6초 등척성 수축 → 이완 → 더 깊은 신장 (통증 시 안전)</td></tr>' +
            '<tr><td style="padding:6px; border:1px solid #d0d7de;"><strong>Slow Reversal-Hold-Relax</strong></td><td style="padding:6px; border:1px solid #d0d7de;">Agonist contract → Antagonist relax → Antagonist isometric → Agonist final stretch</td></tr>' +
            '</table>'
        },
        { h: '🌀 D1·D2 패턴 운동 (대각·나선)',
          body: '<strong>상지 D1 굴곡</strong>: 굴곡+내전+외회전, 전완 회외, 손목·손가락 굴곡 → 자물쇠 여는 동작.<br><strong>상지 D2 굴곡</strong>: 굴곡+외전+외회전, 전완 회외, 손목·손가락 신전 → 칼 뽑는 동작.<br><strong>하지 D1 굴곡</strong>: 고관절 굴곡+내전+외회전, 발목 dorsiflexion+inversion.<br><strong>하지 D2 굴곡</strong>: 고관절 굴곡+외전+내회전, 발목 dorsiflexion+eversion.<br><br>D1/D2 신전은 굴곡 패턴의 정확한 역방향입니다.'
        },
        { h: '✅ 적응증',
          body: '관절 가동 회복(sacroiliac dysfunction에 특히 효과), 스포츠 재활, 신경학적 손상 후 재훈련(원래 Kabat이 소아마비에 개발), 노화로 인한 기능 저하.'
        },
        { h: '📊 근거 수준',
          body: '정적 스트레칭 대비 ROM 증가 5-10°가 다수 RCT에서 입증. 스포츠 재활·관절 가동 회복에 표준 기법.'
        }
      ]
    },

    met: {
      title: '⑧ MET — Muscle Energy Technique',
      founder: 'Fred Mitchell Sr., DO (1948, osteopathic)',
      sections: [
        { h: '🎯 PNF와의 차이',
          body: 'MET는 PNF에서 파생되었으나 <strong>훨씬 부드러운 등척성 수축(20-25% MVC)</strong>을 사용합니다. PNF가 스트레칭·근력 회복에 중점이라면, MET는 <strong>관절 분절 기능 회복(joint dysfunction)</strong>이 목표입니다. Osteopathic medicine의 표준 기법이며 카이로프랙틱·물리치료에서도 채택했습니다.'
        },
        { h: '📋 표준 실기 절차',
          body: '<ol><li>환자를 제한 방향으로 부드럽게 신장 — <strong>barrier 직전</strong>까지만</li><li>환자가 반대 방향으로 <strong>매우 부드러운 등척성 수축</strong> (20-25% MVC) — 5-7초</li><li>완전 이완 2-3초</li><li>시술자가 새로운 barrier로 진행</li><li><strong>3-5 cycle 반복</strong></li><li>매 cycle 마다 ROM 점진적 증가 확인</li></ol>'
        },
        { h: '🩻 작용 기전',
          body: '<ul><li>PNF와 동일하게 autogenic·reciprocal inhibition</li><li>관절 내 활액 분포 변화 → joint cavitation 없이 활주 개선</li><li>Aα 운동신경 발화 패턴 재조직</li><li>심리적 안정감 — 환자의 능동 참여 유도</li></ul>'
        },
        { h: '✅ 적응증',
          body: '<ul><li><strong>비특이성 LBP</strong> (특히 골반·sacroiliac dysfunction)</li><li>경추 후관절 제한 (HVLA 불내성 환자)</li><li>견갑상완관절 운동 제한</li><li>고관절 굴곡근·내전근 단축</li><li><strong>임산부·고령자</strong> — HVLA 회피가 필요할 때</li></ul>'
        },
        { h: '📊 근거 수준',
          body: '<strong>Franke H, Fryer G et al. (2015) Cochrane Review</strong> — 비특이성 LBP에 단기 통증·기능 개선 효과 (낮은 근거). HVLA보다 안전성이 높아 임상 활용도 증가.'
        }
      ]
    },

    oi: {
      title: '⑨ Origin-Insertion Technique (기시-정지부 기법)',
      founder: 'Kaleida Health 임상 진료지침에 명시된 카이로프랙틱 표준 5 기법 중 하나',
      sections: [
        { h: '🎯 핵심 원리',
          body: '근육의 기시(origin)부터 정지(insertion)까지 <strong>전 영역을 longitudinal stripping</strong>으로 훑어 nodule(과긴장 결절)을 발견하고 즉석에서 ischemic compression을 적용하는 통합 기법. Trigger Point Therapy의 변형이지만 <strong>전 근육을 체계적으로 검색</strong>한다는 점에서 차별됩니다.'
        },
        { h: '📋 표준 실기 절차',
          body: '<ol><li>근육의 해부학적 기시·정지 정확히 확인</li><li>엄지(또는 검지+중지 보강)로 기시부에 접촉</li><li><strong>1 cm/초의 매우 느린 속도</strong>로 근복을 따라 깊게 활주</li><li>발견된 모든 nodule에서 정지 → <strong>5-7초 ischemic compression</strong></li><li>다시 활주 → 다음 nodule</li><li>정지부까지 도달 → 반대 방향 한 번 더 (총 2회)</li><li>치료 후 능동·저항 운동 확인</li></ol>'
        },
        { h: '✅ 적응증',
          body: '근복 전체 hypertonicity, 만성 fibrotic 변화, 운동선수 회복 관리, 다발성 trigger points (한 근육에 3개 이상).'
        },
        { h: '📊 권위 출처',
          body: '<strong>Kaleida Health Clinical Guidelines</strong>의 "Therapeutic Soft Tissue Techniques" 섹션에 표준 5개 기법(Friction Massage · Ischemic Compression · Trigger Point Therapy · Soft Tissue Massage · Origin-Insertion Technique) 중 하나로 명시.'
        }
      ]
    },

    dn: {
      title: '⑩ Dry Needling (건침요법)',
      founder: 'Karel Lewit, MD (1979 체코) → 미국 도입 1980s',
      sections: [
        { h: '🎯 침술과의 구분',
          body: '<strong>Dry Needling은 한의학의 침술(acupuncture)과 다른 서양의학 패러다임</strong>입니다. 침술은 경락·기 이론에 기반하지만, dry needling은 <strong>현대 근골격 해부학·통증유발점 이론</strong>(Travell-Simons)에 기반합니다. 사용하는 도구는 동일(filiform needle)하지만 자입 위치 결정 논리가 완전히 다릅니다.'
        },
        { h: '🩻 작용 기전',
          body: '<ul><li>침이 통증유발점의 <strong>contraction knot</strong>을 기계적으로 분리</li><li><strong>Local twitch response (LTR)</strong> — 침 자입 시 taut band의 일시적 떨림 → 분리 신호</li><li>국소 혈류 증가 → ATP 회복 → actin-myosin cross-bridge 풀림</li><li>중추 통증 처리(descending modulation) 활성화</li><li>endorphin·serotonin 분비</li></ul>'
        },
        { h: '📋 표준 실기 절차',
          body: '<ol><li>통증유발점 정확한 위치 결정 (palpation)</li><li>피부 소독 (알코올 swab)</li><li>0.25-0.30mm 직경의 가는 filiform needle 선택</li><li>한 손으로 taut band 고정 (pinch grasp)</li><li>다른 손으로 침을 빠르게 자입 (5-30mm 깊이, 근육에 따라)</li><li><strong>LTR이 나올 때까지 in-and-out</strong> (pistoning) 가볍게 반복</li><li>LTR 3-5회 확보 후 침 제거</li><li>지혈 + 능동 ROM 즉시 확인</li></ol>'
        },
        { h: '⚠ 한국에서의 법적 제한',
          body: '<strong>한국에서 dry needling은 카이로프랙틱·물리치료 면허 범위 외</strong>입니다. 한의사(침술), 일부 통증의학과·재활의학과 의사(IMS — Intramuscular Stimulation) 만 시행 가능합니다.<br><br>미국·캐나다·호주·영국에서는 카이로프랙틱·물리치료 면허에 포함 (주별·국가별 상이).'
        },
        { h: '⚠ 절대 금기',
          body: '<ul><li>출혈성 질환·항응고제 복용</li><li>임신(특정 부위·이론적 위험)</li><li>면역억제 상태</li><li>침 공포증·관련 vasovagal 반응 병력</li><li>피부 감염 부위</li><li>흉부 자입 시 기흉 위험 — 충분한 해부학적 지식 필수</li></ul>'
        },
        { h: '📊 근거 수준',
          body: '<strong>Gattie E, Cleland JA, Snodgrass S (2017) J Orthop Sports Phys Ther</strong> — Systematic Review and Meta-analysis. 만성 근골격 통증에 단기 효과 입증 (Low–Moderate). 장기 추적 부족.'
        }
      ]
    },

    cup: {
      title: '⑪ Cupping Therapy (Myofascial Decompression)',
      founder: '고대 다문화 기원 (이집트 · 그리스 · 중국 · 중동) — 현대 스포츠의학 재해석 1990s',
      sections: [
        { h: '🎯 현대적 재정의',
          body: '전통 부항은 다양한 문화권에 존재했지만, <strong>현대 스포츠의학·도수치료에서는 "Myofascial Decompression (MFD)"이라는 용어로 재해석</strong>하여 근막 음압 치료로 활용합니다. 2016 리우 올림픽 마이클 펠프스의 어깨 부항 자국이 큰 화제가 되며 주류로 진입.'
        },
        { h: '🩻 작용 기전 (현대 가설)',
          body: '<ul><li><strong>음압(negative pressure)</strong>으로 피부·근막·근육 lift → 근막층 분리</li><li>국소 미세순환 증가 — 헤모글로빈 분광학 연구로 검증</li><li>림프 배액 촉진</li><li>Gate Control Theory — 큰 직경 신경섬유 자극으로 통증 신호 차단</li><li>근막 hydration 회복</li><li>Mechanotransduction — 세포외기질 변형으로 fibroblast 활성 변화</li></ul>'
        },
        { h: '📋 두 가지 적용 양식',
          body: '<strong>Static Cupping</strong> — 한 자리에 5-10분 유지. 깊은 근막 release. 둥근 자국(petechiae) 정상.<br><br><strong>Dynamic Cupping (활주식)</strong> — 오일·로션 도포 후 컵을 부착한 채로 미끄러뜨림. 광역 근막 활주 개선. 흔적이 적음.<br><br><strong>도구</strong>: 실리콘 컵(현대·재사용 가능), 유리 컵+화염(전통), 펌프식 플라스틱 컵(임상).'
        },
        { h: '✅ 적응증',
          body: '만성 경추통, 만성 LBP, 광배근·승모근 만성 긴장, 만성 비복근 긴장, 스포츠 회복(DOMS), IT band syndrome, 만성 두통.'
        },
        { h: '⚠ 금기·주의',
          body: '항응고제 복용(petechiae 악화), 출혈성 질환, 피부 감염·열상, 임신 복부·요부, 활동성 종양 부위, 심한 정맥류, 노인 thin skin.'
        },
        { h: '📊 근거 수준',
          body: '<strong>Cao H, Li X, Liu J (2012) PLOS ONE</strong> — Systematic Review. 만성 통증·근골격계 질환에 short-term 효과 (Moderate). Bridgett 등 후속 RCT 다수.'
        }
      ]
    }
  };

  // ---------- 스타일 주입 ----------
  function ensureStyles() {
    if (document.getElementById('stt-modal-styles')) return;
    var s = document.createElement('style');
    s.id = 'stt-modal-styles';
    s.textContent =
      '[data-stt]{cursor:pointer; color:#0b5cad; text-decoration:underline; text-decoration-style:dotted; text-underline-offset:3px;}' +
      '[data-stt]:hover{color:#c0392b; text-decoration-style:solid;}' +
      '.stt-overlay{position:fixed; inset:0; z-index:10000; background:rgba(15,15,20,.78); ' +
        'display:none; align-items:flex-start; justify-content:center; padding:3vh 2vw; ' +
        '-webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); overflow-y:auto; animation:stt-fade .2s ease-out;}' +
      '.stt-overlay.is-open{display:flex;}' +
      '@keyframes stt-fade{from{opacity:0}to{opacity:1}}' +
      '.stt-dialog{background:#fff; max-width:880px; width:100%; border-radius:14px; ' +
        'box-shadow:0 24px 80px rgba(0,0,0,.5); position:relative; padding:0; overflow:hidden; ' +
        'font-family:-apple-system, "Pretendard", "Noto Sans KR", sans-serif;}' +
      '.stt-header{padding:1.4rem 1.6rem 1rem; border-bottom:1px solid #e6ebf0; background:linear-gradient(135deg,#f8fafc 0%,#e6f0fa 100%); position:sticky; top:0; z-index:2;}' +
      '.stt-title{font-size:1.25rem; font-weight:700; color:#0b3b5c; margin:0 0 .2rem 0; padding-right:2.5rem; line-height:1.35;}' +
      '.stt-founder{font-size:.85rem; color:#666; margin:0;}' +
      '.stt-close{position:absolute; top:1rem; right:1rem; appearance:none; border:0; ' +
        'background:rgba(0,0,0,.06); width:34px; height:34px; border-radius:50%; ' +
        'font-size:1.2rem; cursor:pointer; color:#333; display:flex; align-items:center; justify-content:center;}' +
      '.stt-close:hover{background:rgba(0,0,0,.15);}' +
      '.stt-body{padding:1.2rem 1.6rem 1.8rem; max-height:75vh; overflow-y:auto;}' +
      '.stt-figure{margin:0 0 1.2rem 0; background:#fafbfc; border:1px solid #e6ebf0; border-radius:8px; padding:.6rem; text-align:center;}' +
      '.stt-figure svg{max-width:100%; height:auto; display:block; margin:0 auto;}' +
      '.stt-section{margin-bottom:1.1rem;}' +
      '.stt-section h4{font-size:.98rem; font-weight:700; color:#0b3b5c; margin:0 0 .4rem 0; padding-bottom:.3rem; border-bottom:1px solid #e6ebf0;}' +
      '.stt-section p, .stt-section li{font-size:.92rem; line-height:1.55; color:#222;}' +
      '.stt-section ul, .stt-section ol{padding-left:1.4rem; margin:.3rem 0;}' +
      '.stt-section li{margin-bottom:.2rem;}' +
      '.stt-section table{margin-top:.4rem; font-size:.88rem;}' +
      '@media (max-width:640px){' +
        '.stt-dialog{border-radius:10px; max-width:100%;}' +
        '.stt-header{padding:1rem 1.1rem .8rem;}' +
        '.stt-title{font-size:1.1rem; padding-right:2rem;}' +
        '.stt-body{padding:1rem 1.1rem 1.4rem; max-height:80vh;}' +
        '.stt-section h4{font-size:.95rem;}' +
        '.stt-section p, .stt-section li{font-size:.88rem;}' +
      '}';
    document.head.appendChild(s);
  }

  // ---------- 모달 DOM 생성 ----------
  function ensureOverlay() {
    var ov = document.getElementById('stt-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'stt-overlay';
    ov.className = 'stt-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="stt-dialog" role="document">' +
        '<div class="stt-header">' +
          '<h3 class="stt-title" id="stt-title"></h3>' +
          '<p class="stt-founder" id="stt-founder"></p>' +
          '<button class="stt-close" aria-label="닫기">✕</button>' +
        '</div>' +
        '<div class="stt-body" id="stt-body"></div>' +
      '</div>';
    document.body.appendChild(ov);
    // close handlers
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.classList.contains('stt-close')) {
        close();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ov.classList.contains('is-open')) close();
    });
    return ov;
  }

  function open(key) {
    var data = TECHNIQUES[key];
    if (!data) return;
    ensureStyles();
    var ov = ensureOverlay();
    document.getElementById('stt-title').textContent = data.title;
    document.getElementById('stt-founder').textContent = '창시자/출처: ' + data.founder;
    var body = document.getElementById('stt-body');
    var svg = SVG[key] ? '<figure class="stt-figure">' + SVG[key] + '</figure>' : '';
    var sections = (data.sections || []).map(function (s) {
      return '<div class="stt-section"><h4>' + s.h + '</h4><div>' + s.body + '</div></div>';
    }).join('');
    body.innerHTML = svg + sections;
    body.scrollTop = 0;
    ov.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
  }

  function close() {
    var ov = document.getElementById('stt-overlay');
    if (ov) ov.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  }

  // ---------- 이벤트 위임 ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-stt]');
    if (!el) return;
    e.preventDefault();
    var key = el.getAttribute('data-stt');
    open(key);
  });

  // expose for console debugging
  window.SoftTissueModal = { open: open, close: close, data: TECHNIQUES };
})();
