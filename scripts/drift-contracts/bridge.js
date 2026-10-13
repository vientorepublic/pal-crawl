'use strict';

/**
 * 교차 점검 계약 — PAL 상세의 contentId를 likms billId로 그대로 쓸 수 있는가.
 *
 * `PalCrawl`은 PAL 상세의 제안이유가 비면 같은 ID로 likms에서 보정한다
 * (`hydrateProposalReason`). 두 사이트의 ID 체계가 어긋나면 보정이 **조용히**
 * no-op이 되므로(설계상 예외를 던지지 않는다) 사이트별 점검과 별개로 확인한다.
 *
 * 표기 규약은 `scripts/drift-contracts/README.md` 참조.
 */

module.exports = {
  id: 'bridge',
  label: '교차 확인 (PAL contentId → likms 제안이유 보정)',

  sourceFiles: ['src/pal.ts', 'src/likms.ts'],

  checks: [
    {
      id: 'bridge/pal-likms-reason',
      label: 'PAL contentId로 likms 제안이유가 채워진다',
      kind: 'flow',
      flow: 'bridge.palLikmsReason',
      options: {
        // 입법예고 시점 의안은 likms에 아직 없을 수 있으므로 앞쪽 몇 건을 시도한다.
        maxTries: 5,
        contentIdPattern: '^PRC_',
      },
      fields: [
        { path: 'tried.length', min: 1, label: '시도한 contentId' },
        { path: 'bridged.length', min: 1, label: '보정된 제안이유 길이' },
        { path: 'bridged.contentId', pattern: '^PRC_', label: 'contentId' },
      ],
      summary: '{bridged.contentId} → 제안이유 {bridged.length}자',
    },
  ],
};
