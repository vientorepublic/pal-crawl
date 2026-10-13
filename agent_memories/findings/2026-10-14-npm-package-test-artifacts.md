---
id: 2026-10-14-npm-package-test-artifacts
type: finding
title: 게시 tarball에 컴파일된 테스트 산출물과 .freebuff 상태 파일이 실린다
status: active
author: buffy
created: 2026-10-14
updated: 2026-10-14
tags: [npm, package, build, hygiene]
supersedes: null
---

## 문제

`pal-crawl` 패키지에 런타임에 필요 없는 파일이 실린다 — 컴파일된 테스트 산출물과 에이전트 상태 파일.
`.npmignore`는 `src/`·`scripts/`·`.github/`·`agent_memories/`를 제외하지만 `dist/`는 `!/dist/**`로
통째로 포함하고, `tsconfig.json`이 `src/**/*.test.ts`까지 컴파일하기 때문이다.

## 사실 (실측 2026-10-14)

- 게시된 `pal-crawl@2.2.1` tarball **33파일** 중 테스트 산출물 **6개**
  (`dist/likms.test.*`·`dist/pal.test.*`), `.freebuff/project-id`(에이전트 상태 파일) 포함.
- 2.3.0 후보 로컬 `npm pack --dry-run` **42파일** 중 테스트 산출물 **12개**
  (`dist/likms.live.test.*`·`dist/nsm-compat.test.*`가 추가됨). `.freebuff/project-id`도 그대로 포함.
- `src/`·`agent_memories/` 누출은 없다(0건) — `.npmignore`가 의도대로 동작한다.
- 영향: 사이트 HTML 축약 픽스처와 실사이트를 호출하는 live 테스트 코드가 패키지에 함께 게시된다.
  런타임 동작에는 영향이 없지만 패키지가 커지고 소비자에게 불필요한 표면이 노출된다.
- 2.3.0 게시(2FA 단계에서 보류) 시점의 패키지 크기: 132.5 kB(tarball) / 646.2 kB(unpacked) / 42파일.

## 결론/행동

- `.npmignore`에 `dist/*.test.*`와 `.freebuff/`를 추가했다(`chore/npm-package-hygiene`).
  `!/dist/**` 뒤에 오므로 테스트 파일에서만 제외가 이긴다(gitignore 의미론상 마지막 일치 패턴 우선).
- 근본 대안은 `package.json`의 `files: ["dist"]`로 바꾸는 것 — 게시물 구성이 달라지는 결정이라
  별도로 다룬다. `tsconfig`에서 테스트를 빼는 방법은 `ts-jest`가 독립 컴파일하므로 가능하지만
  `npm run typecheck`의 테스트 커버리지가 줄어든다(권장하지 않음).
- 연관: `2026-10-14-npm-publish-otp`(게시 자체의 2FA 제약), `2026-10-14-release-v2.3.0`(릴리스 실행).
