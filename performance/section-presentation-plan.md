# Section presentation and student synchronization

## Scope

Implement the approved second request only: present any already released section
and synchronize students currently viewing the same Lesson. Keep private teacher
navigation, Done release behavior, quiz results, attendance and reflection intact.
Multiple simultaneous Chapter Sessions are outside this change.

## Repository context

The application already uses Chapter Sessions and per-Lesson `session_lessons`
progress. The `docs/01_...10_...`, `CODE_REVIEW.md` and `PLANS.md` referenced by
AGENTS.md are absent. Current requirements, architecture and database rules are
documented in `document/requirements_summary.md`, `TECHNICAL_DOCUMENTATION.md`
and `DATABASE_DOCUMENTATION.md`; these and the installed Next.js Client Component
guide were consulted. Existing uncommitted documentation edits are preserved.

## Execution

1. Add a migration to allow the teaching pointer behind the release frontier.
   Keep the legacy waiting state valid. Add a presentation revision, bumped for
   explicit presentation and progress changes, including Done entire Chapter.
2. Add guarded presentation and extended student snapshot RPCs. Retain old RPC
   contracts. Lock the room before progress rows to serialize End/Done/Present.
   Done advances from the current pointer without ever shrinking released access.
3. Add typed RPC clients and reconciliation rules. Initial LIVE views use the
   teaching pointer; new teacher commands override student browsing; ordinary
   refetches preserve browsing. Ended sessions retain independent review.
4. Add an emerald/sky styled classroom control panel to Teacher LIVE, retain
   private Previous/Next, and let a teacher present a previously released section.
   Add a compact student follow/return indicator. Synchronize from database on
   Realtime, reconnect, visibility/focus and degraded polling.
5. Verify with unit/component tests, database authorization/invariant tests and
   browser interaction coverage where local tooling permits. Run lint, typecheck,
   the full unit suite and production build. Review diffs and record limitations.

## Acceptance checks

- Teacher can go backward/forward within released content and re-present the
  current section without unlocking future content.
- Students at different sections follow a new command, including a command whose
  target is unchanged or changed away and back while offline.
- Release frontier, quiz results and feedback never regress or reset.
- Outsiders/students cannot present; ended sessions cannot mutate; future,
  nonexistent and foreign-Lesson positions are rejected.
- Old snapshot/release RPC signatures still work; original Chapter LIVE limit
  remains unchanged.
- Reconnect catches up; polling stops after recovery; events coalesce; cleanup
  prevents late responses from updating another Lesson or unmounted component.

## Validation results

- Implemented a guarded presentation RPC, a compatible extended student snapshot
  and a monotonic release invariant. Existing migrations and RPC return types were
  preserved. Only already released sections can be presented.
- Unit suite: 67 files / 423 tests passed (`pnpm test`).
- Browser integration: 12 cases passed on desktop (1440px) and mobile (390px),
  using the real Teacher/Student players and a simulated RPC/Realtime transport.
  Includes multiple student pages, independent Lessons, private teacher preview,
  Done, same-target re-presentation, reconnect/polling, command failure, ended
  reflection, event coalescing and polling shutdown. Screenshots were inspected.
- PostgreSQL: all 68 migrations, including the new migration, applied to an
  isolated local PostgreSQL 18 cluster with test-only Supabase service schemas.
  `supabase/tests/039_section_presentation.sql` passed all six assertion groups:
  ownership/permissions, progress and invalid targets, multi-device snapshots and
  preserved quiz/feedback/attendance, outsider access, Chapter Done/invariants,
  and ended-session read-only behavior. The test rolls back its fixtures.
- Lint: no errors. The existing unused `lessonTitle` warning remains in
  `edit-lesson-button.tsx` (also reported from an existing `.kilo` worktree).
- Typecheck and production build passed; `git diff --check` passed.
- Installed Playwright and Vite as development-only dependencies and added
  `pnpm test:e2e` for the reproducible browser harness.

## Deployment and limits

Apply `supabase/migrations/202611050001_present_released_section.sql` to the
intended Supabase project before deploying the new application. No hosted
database was changed by this task. Hosted Supabase WebSocket delivery was not
tested end-to-end; the browser transport was simulated, while SQL/RLS checks ran
on a real isolated PostgreSQL server. Full historical pgTAP suites were not run
because the local server lacks the pgTAP extension and Docker is not running.
Synchronization is scoped to the currently viewed Lesson; it does not switch
students to a different Lesson or Chapter. The multiple-LIVE-chapter restriction
is unchanged.
