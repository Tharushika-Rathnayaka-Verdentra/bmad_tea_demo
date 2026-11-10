---
runScope: 'epic-level'
runKey: 'epic-1'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-11-10'
inputDocuments:
	- '_bmad/tea/config.yaml'
	- 'package.json'
	- 'playwright.config.ts'
	- 'tests/e2e/todomvc.spec.ts'
	- 'tests/api/site-availability.spec.ts'
	- 'tests/README.md'
	- '.agents/skills/bmad-tea/resources/knowledge/risk-governance.md'
	- '.agents/skills/bmad-tea/resources/knowledge/probability-impact.md'
	- '.agents/skills/bmad-tea/resources/knowledge/test-levels-framework.md'
	- '.agents/skills/bmad-tea/resources/knowledge/test-priorities-matrix.md'
	- '.agents/skills/bmad-testarch-test-design/resources/knowledge/playwright-cli.md'
---

# Epic 1 Test Design Progress

## Step 1: Mode and Prerequisites

- Mode: epic-level; Epic 1.
- Scope supplied: browser tests for todo creation, completion, deletion, and All, Active, Completed filters, with priority on creation and filters.
- Project context: root Playwright TypeScript setup exists; Chromium starter tests passed against the supplied React TodoMVC URL.
- No formal epic/story file was supplied; the user-provided action list is the current requirements scope.

## Step 2: Context and Coverage

- Config: frontend stack is inferred from the root Playwright config; Playwright Utils is enabled and installed; browser automation mode is `auto`; Pact utilities are enabled but no contract-testing boundary or artifacts exist, so Pact context is not applicable.
- No separate Epic 1 story, PRD, architecture document, or prior system-level test design was found.
- Existing coverage: `tests/e2e/todomvc.spec.ts` covers add and complete; `tests/api/site-availability.spec.ts` covers only root-document availability. Delete and filter coverage are gaps.
- Live exploration confirmed the textbox name `New Todo Input`; the All/Active/Completed links appear after an item exists; checking a row moves it out of Active and into Completed; “Delete todo” is the accessible name of the row delete button.
- Temporary exploration items were removed. The page emitted a failed external Google Analytics request, unrelated to core TodoMVC behavior; tests should not gate on that third-party request.
- `playwright-cli` is unavailable in this environment; the shared browser automation was used as the available fallback.
- Knowledge loaded: risk governance, probability/impact, test levels, test priorities, and Playwright CLI guidance. Official Playwright best-practice and assertion guidance was cross-checked.

## Step 3: Testability and Risk Assessment

### Testability Observations

- **Controllability:** No application API or authentication flow was identified. Create and state-transition tests should set up todos through the UI, using unique titles, then perform assertions in the same test.
- **Observability:** The live UI exposes a named `New Todo Input`, row checkboxes, `All` / `Active` / `Completed` links, and a `Delete todo` button. Use accessible roles/names and auto-retrying visibility, checked-state, count, and text assertions.
- **Reliability:** Keep each journey independent in Playwright's fresh browser context. Filter checks should use a known mix of active and completed todos, not rely on prior tests or persisted shared data.
- **External dependency:** The target is a public demo app, and one unrelated analytics request failed during exploration. Do not assert analytics behavior or treat that request as a TodoMVC feature failure.

### Risk Register

Risk score is probability × impact (each 1–3). Priority is assigned separately from user impact and requested emphasis.

| ID | Category | Risk grounded in scope/evidence | P | I | Score | Priority | Mitigation | Owner / timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| E1-R1 | BUS | A submitted todo may not appear as one visible active item, losing or duplicating user work. Grounding: user-requested create action; current `tests/e2e/todomvc.spec.ts` covers one creation path. | 2 | 2 | 4 | P1 | Add a uniquely titled todo through the textbox and assert one matching row plus active count/state. | QA / feature owner, before Epic 1 sign-off |
| E1-R2 | BUS | A filter may show the wrong set of active/completed items, hiding work or showing completed work as active. Grounding: user explicitly prioritizes All, Active, and Completed filters; live exploration confirmed all three links. | 2 | 2 | 4 | P1 | With one active and one completed item, assert exact membership under each filter and return to All. | QA / feature owner, before Epic 1 sign-off |
| E1-R3 | BUS | Completing a todo may not persist its completed state or move it between filter views. Grounding: user-requested complete action; current test checks a completed class but not filter membership. | 2 | 2 | 4 | P1 | Assert the row checkbox is checked and the item appears only in Completed, then remains visible in All. | QA / feature owner, before Epic 1 sign-off |
| E1-R4 | DATA | Deletion may leave a stale row or remove a different todo, causing incorrect visible list state. Grounding: user-requested delete action; live exploration confirmed a row button named `Delete todo`. | 2 | 2 | 4 | P2 | Delete one uniquely titled row and assert that row is absent while a neighboring todo remains. | QA / feature owner, before Epic 1 sign-off |
| E1-R5 | OPS | A public demo outage or unannounced change may fail E2E checks independently of this test plan. Grounding: supplied target URL and `playwright.config.ts` default `BASE_URL` point to an externally hosted demo. | 2 | 2 | 4 | P2 | Keep `BASE_URL` overridable; classify reachability failures as environment/target failures and rerun before treating them as product regressions. | Test owner, at test execution and when target changes |

No risk scores 6–9, so the risk matrix does not identify a high-risk mitigation blocker. P1 coverage remains required due to the user’s stated priority and the core list workflow.

### NFR Planning

- No security, performance, scalability, compliance, or operational acceptance threshold was supplied for Epic 1.
- No numeric responsiveness or cross-browser support target is assumed. The current runner is Chromium-only; confirm a wider browser matrix only if Epic 1 requires it.
- Planned reliability evidence is repeatable isolated Playwright execution with auto-retrying user-visible assertions. This is not a release NFR assessment.

## Step 4: Coverage Plan and Execution Strategy

### Coverage Matrix

Provisional IDs use `1.0` for Epic 1 with no story ID supplied. Feature behavior remains browser E2E; no lower-level app source/API exists in this project to test.

| ID | Scenario / acceptance outcome | Level | Priority | Risk Link | Coverage / notes |
| --- | --- | --- | --- | --- | --- |
| 1.0-E2E-001 | Create a uniquely titled todo; exactly one matching row becomes visible and is active in the default All view. | E2E | P1 | E1-R1 | Existing `tests/e2e/todomvc.spec.ts` partially covers creation; add uniqueness/count and active-state checks. |
| 1.0-E2E-002 | With one active and one completed todo, All shows both; Active shows only the active item; Completed shows only the completed item. The completed row remains checked and filter membership changes correctly. | E2E | P1 | E1-R2, E1-R3 | New test. Create both items via UI in the same test; complete one; use role/name locators and auto-retrying visibility/count/checked assertions. |
| 1.0-E2E-003 | Delete one of two todos; the selected row disappears and the other todo remains. | E2E | P2 | E1-R4 | New test. Scope the accessible `Delete todo` button to the named row. |
| 1.0-API-001 | Confirm the configured public target root responds successfully. | API | P2 | E1-R5 | Existing `tests/api/site-availability.spec.ts`; environment availability only, not feature coverage. Rerun after failures before classifying a feature regression. |

Traceability: every risk E1-R1 through E1-R5 maps to at least one row. The three requested filters are explicit assertions in 1.0-E2E-002. There is no duplicate feature coverage at API/component/unit levels.

### Coverage Gaps

- Existing E2E coverage currently creates and completes a todo, but completion is asserted by CSS class only; assert user-visible checkbox state and filter membership instead.
- All/Active/Completed membership and deletion are not yet covered by automated feature tests.
- Planned functional coverage is 3 browser scenarios for the 3 requested behavior groups; the 1 API availability check is separate.

### NFR Evidence Plan

- No NFR categories with explicit acceptance thresholds are in scope. Reliability evidence is the Playwright result, trace, and HTML report for the isolated functional scenarios; no `nfr-assess` decision is implied.
- Cross-browser evidence is not planned until the supported browser matrix is confirmed.

### Execution Strategy

- **PR (once CI is added):** Run all three functional E2E scenarios and the existing target-availability check; expected runtime is under 15 minutes. CI implementation remains out of scope for this plan.
- **Nightly/Weekly:** None proposed; there are no long-running, load, or large-data scenarios in scope.
- **Local:** `npm run test:e2e`; rerun the availability check separately when the public target appears unavailable.

### Resource Estimates

- P1: approximately 3–5 hours to strengthen create/completion/filter coverage and review.
- P2: approximately 2–3 hours for delete coverage and target-failure handling.
- Total: approximately 5–8 hours, or 1–2 working days including review, assuming the public demo remains available.

### Quality Gates

- P0: none identified.
- P1: at least 95% pass rate per workflow guidance; because there are only two P1 scenarios, target both green before sign-off and do not accept unexplained flakes.
- P2: delete test passes; target availability failures are distinguished from feature failures.
- All five registered risks have a mapped validation row; feature coverage target is 100% of the three requested behavior groups.
- No high risks (score ≥6) exist. No NFR PASS/CONCERNS/FAIL decision is made without scoped thresholds and implementation evidence.

## Step 5: Output and Validation

- Final epic-level plan: `_bmad-output/test-artifacts/test-design-epic-1.md`.
- Validated against the workflow template and checklist: risk IDs map to coverage rows, all requested behavior groups are covered, NFR thresholds are not invented, execution strategy and ranged estimates are present, and no template tokens remain.
- Browser exploration used the shared browser because `playwright-cli` is unavailable; temporary todos were removed and no browser session was left open.
- Open assumptions: no formal story/acceptance-criteria document or named owners were supplied; cross-browser and explicit NFR targets remain unspecified.