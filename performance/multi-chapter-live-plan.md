# Multiple LIVE Chapters in one Course Section

## Scope and context

Allow distinct Chapters in the same Course Section to stay ACTIVE concurrently.
One Chapter still has at most one ACTIVE Session. Each Session keeps its own
participants, attendance, lesson presentation, feedback, quiz results, reflections
and summary. A started Chapter Session continues to count as one class meeting.
Students still verify their MSSV separately for each Chapter Session.

The current phase is the existing persistent Chapter Session flow. It depends on
`session_lessons`, per-session attendance and the completed section presentation
change. AGENTS.md references `docs/01_...10_...`, `CODE_REVIEW.md` and `PLANS.md`,
which are absent; current requirements, architecture, security and database rules
were read in `document/requirements_summary.md`, `TECHNICAL_DOCUMENTATION.md` and
`DATABASE_DOCUMENTATION.md`, plus the installed Next.js component guide.
Existing uncommitted changes, including section presentation, must be preserved.

## Execution

1. Add a new migration replacing the Course Section-wide active unique index
   with a Chapter-scoped one and a safe legacy Lesson guard. Update both start
   RPCs while retaining ownership checks, course-level advisory locks and roster
   snapshots. Do not change End, Done, join or reflection scope.
2. Add a typed active Chapter Session model and a reusable emerald/sky panel.
   Course Section derives it from existing query data; Teacher Dashboard fetches
   only sibling ACTIVE Session metadata to make switching Chapters clear.
3. Update start error handling and invalidation. Name the current Chapter in End
   and Done confirmation popups and explain that other Chapters are unaffected.
   Keep the public LIVE cards and existing per-Chapter join paths.
4. Test independent starts, duplicate starts (including concurrent requests),
   ownership/negative input, public listing/catalog, isolation of join/release/
   End/reflection/summary, attendance/export and roster updates. Cover the UI on
   desktop/mobile with the existing real-component browser harness.
5. Run lint, typecheck, unit tests, browser tests and production build. Inspect
   screenshots and diffs. Record actual results and deployment requirements.

## Expected files

- `supabase/migrations/202611050002_multiple_live_chapters.sql`
- `supabase/tests/040_multiple_live_chapters.sql`
- `src/features/rooms/active-chapter-sessions.ts` and panel/tests
- Teacher Course Section and Dashboard pages and room query
- Lesson start actions/button/tests and lifecycle confirmation components
- Existing browser test harness; README usage notes

## Results

- Added `202611050002_multiple_live_chapters.sql`: unique ACTIVE Session per
  Chapter, legacy Lesson duplicate protection, updated Chapter and compatibility
  start RPCs with ownership checks and the existing course-level advisory lock.
- Teacher Course Section shows all ACTIVE Chapters using existing query data.
  Dashboard loads only same-course ACTIVE Chapter metadata in parallel with the
  existing content queries, with a current-Chapter indicator and switch links.
- Start/End invalidate Teacher and public lists. Done/End confirmations include
  the Chapter name and clarify that other Chapters keep running. Public LIVE
  cards retain separate per-Chapter entry links and long-title truncation.
- Existing documentation changes and section-presentation work were preserved.

## Validation

- `pnpm test`: 69 files / 434 tests passed.
- `pnpm test:e2e`: 20 desktop/mobile browser integration cases passed, including
  the 12 previous section-presentation cases. The new cases cover multiple
  starts, Dashboard links, selected Chapter, scoped Done/End with confirmation,
  student LIVE cards and connection failure/retry. Real application components
  are used with simulated server actions and Realtime transport.
- Inspected desktop/mobile screenshots; the panel and long titles fit within
  the viewport. Screenshots are under ignored `test-results/`.
- Real isolated PostgreSQL 18: all eight assertion groups in
  `supabase/tests/040_multiple_live_chapters.sql` passed. Coverage includes
  per-Chapter duplicate guards, invalid/foreign input, owner and Student rights,
  public catalog, separate participants/reactions/quiz visibility and attempts,
  scoped release/End/reflections/summary, all-ACTIVE roster updates, preserved
  ended snapshots, independent restarts and attendance/export totals.
- `node test/multi-chapter-live/concurrency.mjs` passed three real multi-connection
  races: same Chapter starts create exactly one Session; different Chapters both
  start; concurrent roster replacement and a fourth start keep all snapshots
  consistent. This script targets only the disposable localhost:55439 cluster.
- Re-ran `039_section_presentation.sql`: all six assertion groups passed.
- Fresh database upgrade: applied all 68 prerequisite migrations, created an
  ACTIVE Chapter Session, then applied the new migration. The existing Session
  row was unchanged byte-for-byte after upgrade.
- Typecheck and production build passed. Lint has zero errors and only the
  pre-existing unused `lessonTitle` warning (also reported from `.kilo` worktree).
  `git diff --check` passed. ESLint now ignores generated Playwright artifacts;
  Vitest excludes the Playwright harness from its unit-test discovery.
- Updated the old Chapter SQL regression expectation to allow different Chapters
  concurrently; historical migration files were not changed.

## Deployment and limits

Apply `supabase/migrations/202611050002_multiple_live_chapters.sql` to the intended
Supabase project before using the new feature, after the preceding section
presentation migration. Use `pnpm exec supabase db push --dry-run` to review the
pending migrations and then `pnpm exec supabase db push`.

No hosted Supabase database was modified or used for test fixtures. Browser
integration uses simulated transport; actual SQL constraints, locks, ownership
and RLS were exercised on the isolated PostgreSQL cluster with test-only Supabase
service schemas. The full historical pgTAP suite was not run because pgTAP is not
installed on that server and local Docker is unavailable. Each Chapter remains
one independent attendance Session, and Students verify each LIVE Chapter
separately. The local test cluster is stopped after verification.
