# Chiropracticos App Issue Report

이 문서는 Chiropracticos 프로젝트 앱의 현재 문제점 및 누락된 콘텐츠(placeholder, TODO)를 요약한 리포트입니다. Claude Code가 이 문서를 읽고 아래의 문제점들을 단계적으로 해결해야 합니다.

## 1. TODO 항목 (역사적 사실 기반 수정)
- **대상 파일**: 
  - `chapter01_introduction.html` (Line 127, 133)
  - `index.html` (Line 87)
- **문제점**: D.D. Palmer의 첫 교정 사건(Harvey Lillard 사례)과 관련된 내용이 TODO로 남아있습니다. Harvey Lillard의 청각 회복 서사를 신화로 명확히 구분하고, 역사적 사실로만 기술해야 하며, National College의 탈생기론(vitalism) 관련 역사를 보완해야 합니다.
- **해결 방안**: EBM(근거중심의학) 기조에 맞춰 해당 섹션의 텍스트를 수정 및 완성합니다.

## 2. 각 기법 챕터의 상세 이론 및 프로토콜 누락 (Placeholder)
- **대상 파일**: 
  - `chapter04_gonstead.html`
  - `chapter05_toggle_recoil.html`
  - `chapter06_thompson.html`
  - `chapter07_activator.html`
  - `chapter08_cox.html`
  - `chapter09_logan.html`
  - `chapter10_sot.html`
  - `chapter11_cbp.html`
  - `chapter12_ak.html`
- **문제점**: 각 파일에 `<div class="placeholder">[상세 이론 본문 자리]...</div>` 및 `<div class="placeholder">[임상 프로토콜 본문 자리]...</div>`가 그대로 남아있습니다. 창시자, 역사, 생체역학, 신경생리 등 세부 내용이 비어있습니다.
- **해결 방안**: Chapter 2(Functional Neurology)에서 확립된 **Afferentation → Central Processing → Efferentation** 프레임워크를 기반으로 각 기법의 상세 이론 및 임상 프로토콜(적응증, 환자 자세, 접촉점, 추력 벡터, 안전 및 다학제 협진 등)을 EBM 기준에 맞게 채워 넣어야 합니다.

## 3. Chapter 3 (Diversified) 세부 주차 내용 및 자막 누락
- **대상 파일**: `chapter03_diversified.html`
- **문제점**: 
  - Week 1 ~ Week 4까지의 상세 내용이 `[WEEK X 상세 내용 자리]`로 비어있습니다.
  - 비디오 자막이 `placeholder` 상태입니다. (`video_part1_week12.ko.vtt`, `video_part2_week34.ko.vtt`)
- **해결 방안**: 주차별(평가 플로우, 기초 교정, 고급 응용 등) 내용을 추가하고 자막 처리 로직이나 안내를 업데이트해야 합니다.

## 4. 이미지 에셋 누락
- **대상 파일**: `images/chapter1/` 폴더 내 다수의 SVG (08_gonstead, 09_thompson, 10_fuhr, 11_cox, 12_logan, 13_dejarnette, 14_carrick, 15_harrison, 16_goodheart 등)
- **문제점**: "Photo placeholder · 실사 사진 준비 예정" 텍스트가 들어가 있는 임시 파일입니다.
- **해결 방안**: 실사 사진으로 교체하거나, UI에 맞는 적절한 형태의 에셋으로 교체/생성을 진행해야 합니다.

---

## Claude Code 실행 가이드
Claude Code를 통해 위의 문제들을 해결하려면 커맨드라인에서 아래 명령어를 복사해서 실행하세요.

```bash
claude "issue_report_for_claude.md 파일을 읽고, 1번(TODO 역사적 사실 수정)과 2번(각 챕터별 상세 이론 및 임상 프로토콜 placeholder 작성 - Aff/Def/Eff 프레임 적용) 항목부터 순차적으로 코드를 수정해줘. 모든 내용은 EBM(근거중심의학) 기조를 유지해야 해."
```
