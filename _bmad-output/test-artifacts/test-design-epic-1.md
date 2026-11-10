---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-11-10'
---

# Test Design: Epic 1 - TodoMVC Core Todo Actions

**Date:** 2026-11-10  
**Author:** TharushikaRathnayaka  
**Status:** Draft

## Executive Summary

**Scope:** Epic-level browser test design for the supplied React TodoMVC demo.

The requested behaviors are create, complete, delete, and the All, Active, and Completed filters. Creating todos and filter membership are the focus. The plan uses Playwright TypeScript and the existing Chromium project.

**Risk Summary:** 5 risks identified; 0 score 6 or higher. Risks are in BUS, DATA, and OPS categories.

**Coverage Summary:** 0 P0 scenarios; 2 P1 browser scenarios (~3-5 hours); 1 P2 browser scenario plus 1 existing P2 target-availability check (~2-3 hours for new work); total new test-development effort ~5-8 hours (~1-2 working days).

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| Backend/API behavior for todo CRUD | No application API was identified during scoped exploration; the request is for browser behavior. | Exercise create, complete, delete, and filters through the UI. Keep the existing root availability request separate. |
| Third-party analytics behavior | The public page emitted an unrelated failed Google Analytics request during exploration. | Do not assert analytics delivery or treat it as a TodoMVC feature failure. |
| Cross-browser matrix | No browser support requirement was provided; the current framework is Chromium-only. | Confirm browser requirements before adding Firefox or WebKit projects. |
| Security, load, and performance testing | No corresponding Epic 1 requirements or measurable thresholds were supplied. | Record thresholds as unknown/out of scope; revisit if requirements are added. |
| CI pipeline | CI was explicitly deferred. | Run locally with the existing npm script; add PR automation in a separate CI task. |

## Risk Assessment

Probability and impact use a 1-3 scale; score = probability x impact. Priority is assigned separately based on user impact, reach, and workaround. Each risk is grounded in the user-requested actions, the named test artifacts, or the supplied target URL.

### High-Priority Risks (Score >= 6)

None identified.

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | Probability | Impact | Score | Priority | Mitigation | Owner | Timeline |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| E1-R1 | BUS | A submitted todo may fail to appear as one visible active item, losing or duplicating user work. Grounding: create is explicitly requested; `tests/e2e/todomvc.spec.ts` currently covers one create path. | 2 | 2 | 4 | P1 | Create a unique title through the UI; assert exactly one matching row and its active state. | QA / feature owner (TBD) | Before Epic 1 sign-off |
| E1-R2 | BUS | A filter may show the wrong set of active and completed todos, hiding work or showing completed work as active. Grounding: All, Active, and Completed are explicitly prioritized; all three links were observed in the live app. | 2 | 2 | 4 | P1 | With a known active/completed pair, assert exact membership in each filter and in All. | QA / feature owner (TBD) | Before Epic 1 sign-off |
| E1-R3 | BUS | Completion state may not persist or may not move the todo between filter views. Grounding: complete is requested; the current test checks a CSS class but not filter membership. | 2 | 2 | 4 | P1 | Assert the checkbox is checked and the todo appears in Completed, not Active. | QA / feature owner (TBD) | Before Epic 1 sign-off |
| E1-R4 | DATA | Deletion may leave a stale row or remove a different todo. Grounding: delete is requested; the live row exposes a `Delete todo` button. | 2 | 2 | 4 | P2 | Delete one uniquely named row and assert it is absent while a second row remains. | QA / feature owner (TBD) | Before Epic 1 sign-off |
| E1-R5 | OPS | A public demo outage or unannounced change may fail tests independently of the test code. Grounding: the supplied URL is external and is the default `BASE_URL` in `playwright.config.ts`. | 2 | 2 | 4 | P2 | Keep `BASE_URL` overridable; classify reachability failures as target/environment failures and rerun before treating them as feature regressions. | Test owner (TBD) | At test execution and target changes |

### Low-Priority Risks (Score 1-2)

None identified.

### Risk Category Legend

- **TECH:** Technical/architecture
- **SEC:** Security
- **PERF:** Performance
- **DATA:** Data integrity
- **BUS:** Business impact
- **OPS:** Operations/environment

## NFR Planning

No Epic 1 non-functional requirement or measurable threshold was supplied. No security, performance, scalability, compliance, or maintainability validation is planned. Reliability evidence for the functional suite will be the Playwright result, trace, and HTML report from isolated runs; this is not a final NFR audit.

**Unknown thresholds:** Cross-browser support, accessibility conformance, and response-time targets are not specified. Confirm them only if they are intended Epic 1 requirements. No NFR-derived risks were added without such a requirement.

## Entry Criteria

- [ ] Epic 1 behavior scope is agreed: create, complete, delete, and All/Active/Completed filtering.
- [ ] The public target URL is reachable, or an approved `BASE_URL` override is available.
- [ ] Node.js dependencies and Chromium are installed.
- [ ] Tests use unique todo titles and independent Playwright contexts.
- [ ] Any changed locator contract in the public demo is reviewed before updating assertions.

## Exit Criteria

- [ ] Both P1 browser scenarios pass; for this small suite, target 100% green before sign-off.
- [ ] The P2 deletion scenario passes.
- [ ] All three requested behavior groups are mapped to automated scenarios.
- [ ] No open P0/P1 functional defects remain.
- [ ] No unresolved high risks (score >=6); none are currently identified.
- [ ] Public-target failures are distinguished from feature failures.
- [ ] No unexplained flaky test or shared-state dependency remains.

## Test Coverage Plan

Provisional IDs use `1.0` for Epic 1 because no story ID was supplied. P0/P1/P2/P3 indicate priority, not execution timing. Browser workflows are E2E because the tested app is external and no source/component test surface is present in this project.

### P0 (Critical)

No P0 scenarios. The supplied scope identifies no revenue-critical, security-critical, compliance, or no-workaround failure.

**Total P0:** 0 tests, 0 hours.

### P1 (High)

**Criteria:** Core user behavior emphasized in the request, with material impact if list state or filtering is wrong.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | ---: | --- | --- | --- |
| 1.0-E2E-001 | Create a todo and verify it appears exactly once as active in the default All view. | E2E | E1-R1 | 1 | QA | Strengthen the existing `tests/e2e/todomvc.spec.ts` creation scenario with exact row count and active checkbox state. |
| 1.0-E2E-002 | With one active and one completed todo, verify All shows both, Active shows only the active one, and Completed shows only the checked one. | E2E | E1-R2, E1-R3 | 1 | QA | New scenario. Create both through the UI in this test; use role/name locators and auto-retrying assertions. |

**Total P1:** 2 tests, ~3-5 hours.

### P2 (Medium)

**Criteria:** Requested secondary behavior with an acceptable workaround while the core create/filter journey is prioritized.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | ---: | --- | --- | --- |
| 1.0-E2E-003 | Delete one of two todos and verify only the selected row disappears. | E2E | E1-R4 | 1 | QA | New scenario. Scope the `Delete todo` button to the uniquely titled row. |
| 1.0-API-001 | Verify the configured public target root responds successfully. | API | E1-R5 | 1 | QA | Existing `tests/api/site-availability.spec.ts`; environment availability evidence only, not functional feature coverage. |

**Total P2:** 2 checks, ~2-3 hours of new work; the API availability check already exists.

### P3 (Low)

No P3 scenarios identified.

**Total P3:** 0 tests, 0 hours.

## Execution Strategy

Run all functional scenarios in PRs once CI is added; the expected suite is well below 15 minutes. CI implementation is deferred. No nightly or weekly suite is proposed because this scope has no long-running, load, or large-data tests. Locally, run `npm run test:e2e`; rerun the availability check separately when the public target appears unavailable.

**Diagnostic order:** Confirm target availability first, then review P1 create/filter failures, then the P2 delete result. This is a failure-triage order, not a dependency between tests; Playwright may still run independent tests in parallel.

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | ---: | ---: | ---: | --- |
| P0 | 0 | N/A | 0 | None identified |
| P1 | 2 | ~1.5-2.5 | ~3-5 | Create and mixed-state filter coverage |
| P2 | 1 new + 1 existing | ~2-3 for new work | ~2-3 | Delete test; availability check already exists |
| P3 | 0 | N/A | 0 | None identified |
| **Total** | **3 new + 1 existing** | **-** | **~5-8** | **~1-2 working days including review** |

### Prerequisites

**Test data:** Use the existing Faker-backed todo factory for unique titles; create state through the UI because no application API was identified.

**Tooling:** Existing Playwright TypeScript setup, Chromium project, Playwright Utils merged fixtures, and HTML/JUnit reporting.

**Environment:** Public TodoMVC target or an approved `BASE_URL` override; no credentials required.

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100%; no P0 scenarios currently exist.
- **P1 pass rate:** >=95% per workflow guidance; target both P1 scenarios green before sign-off because the suite contains only two.
- **P2/P3 pass rate:** >=90%; target the deletion scenario green before closing its coverage gap.
- **High-risk mitigations:** 100% complete or explicitly waived; no score >=6 risks currently exist.

### Coverage Targets

- **In-scope functional behavior:** 100% mapped across create, complete/filter, and delete scenarios.
- **Critical paths:** >=80%; the requested create/filter path is explicitly covered by both P1 scenarios.
- **Source-code coverage:** Not applicable; the app source is not in this project.
- **NFR evidence:** Not applicable until NFR requirements and thresholds are supplied; full assessment remains with `nfr-assess` if evidence is later collected.

## Mitigation Plans

No score >=6 risks require a separate high-risk mitigation plan. Medium risks and their concrete mitigations are recorded in the risk matrix and traced to coverage rows above.

## Assumptions and Dependencies

### Assumptions

1. The supplied public React TodoMVC demo is the target of the planned browser tests.
2. The requested filter semantics are that All includes active and completed items, Active excludes completed items, and Completed includes completed items; live exploration confirmed these states.
3. Chromium is the initial browser target; broader browser support has not been specified.
4. No application API or authentication flow was identified during the scoped exploration.

### Dependencies

1. The public target remains reachable and retains the observed user-facing controls.
2. The project keeps Playwright, Chromium, and its current test dependencies installed.
3. Tests use independent browser contexts so local app state does not leak between cases.

### Risks to Plan

- **Risk:** The public demo changes or becomes unavailable. **Impact:** E2E failures may not indicate a test-code regression. **Contingency:** Confirm root availability, compare the live accessible controls, and update locators only after reviewing the change.
- **Risk:** No formal Epic 1 story or acceptance-criteria document was supplied. **Impact:** The plan's outcomes are derived from the user's action list. **Contingency:** Confirm these proposed outcomes against story-level criteria before implementation.

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| TodoMVC todo input and list | Create, complete, delete, and filter state are exercised through the browser. | Run all three E2E scenarios; the mixed-state scenario covers All, Active, and Completed together. |
| Public demo host | Controls test availability and observed DOM contract. | Run the existing root availability check and distinguish target outages from feature failures. |

## Appendix

### Knowledge Base References

- `risk-governance.md` - risk categories and mitigation practice
- `probability-impact.md` - probability x impact scoring
- `test-levels-framework.md` - test-level selection
- `test-priorities-matrix.md` - priority criteria
- `playwright-cli.md` - browser exploration guidance
- Official Playwright: [Best Practices](https://playwright.dev/docs/best-practices) and [Assertions](https://playwright.dev/docs/test-assertions)

### Related Documents

- Epic / story: Not supplied; scope taken from the user request.
- Playwright setup: `playwright.config.ts`
- Existing E2E: `tests/e2e/todomvc.spec.ts`
- Existing target check: `tests/api/site-availability.spec.ts`

## Approval

**Test Design Approved By:** Pending review.

## Follow-on Workflows

- `/bmad-testarch-automate` can implement the planned filter and delete coverage when requested.
- CI setup remains a separate workflow and is not included here.

**Generated by:** BMad TEA Test Architect  
**Workflow:** `bmad-testarch-test-design`