import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

// Deliberately fixed to the disposable test cluster; never reads .env.local.
const run = promisify(execFile);
const args = ["-h", "127.0.0.1", "-p", "55439", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
const auth = `set local role authenticated; select set_config('request.jwt.claims',
  '{"sub":"fc100000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"email":"thaybao@minclass.local"}',true);`;
const start = (chapter) => `select session_id from public.start_chapter_session(
  'fc300000-0000-4000-8000-000000000001','fc400000-0000-4000-8000-${String(chapter).padStart(12, "0")}');`;
const sql = (source) => run("psql", [...args, "-c", source], { env: { ...process.env, PGCLIENTENCODING: "UTF8" } });

await run("psql", [...args, "--single-transaction", "-f", fileURLToPath(new URL("./concurrency-seed.sql", import.meta.url))]);
try {
  const same = await Promise.allSettled([1, 1].map((chapter) => sql(`begin; ${auth} ${start(chapter)} select pg_sleep(0.25); commit;`)));
  assert.equal(same.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = same.find((result) => result.status === "rejected");
  assert.match(rejected.reason.stderr, /Chapter already has a LIVE Session/);
  console.log("PASS concurrent starts of the same Chapter create exactly one Session");

  const different = await Promise.allSettled([2, 3].map((chapter) => sql(`begin; ${auth} ${start(chapter)} select pg_sleep(0.25); commit;`)));
  assert.equal(different.filter((result) => result.status === "fulfilled").length, 2);
  console.log("PASS concurrent starts of different Chapters both succeed");

  await Promise.all([
    sql(`begin; ${auth} ${start(4)} select pg_sleep(0.25); commit;`),
    sql(`begin; ${auth} select public.replace_course_section_roster('fc300000-0000-4000-8000-000000000001',array['SV002','SV003']); commit;`),
  ]);
  const result = await sql(`select count(*)=4 and bool_and(roster_count=2 and expected_count=2) from (
    select rooms.id,count(a.mssv) roster_count,count(a.mssv) filter (where a.mssv in ('SV002','SV003')) expected_count
    from public.rooms left join public.session_attendance a on a.session_id=rooms.id
    where rooms.course_section_id='fc300000-0000-4000-8000-000000000001'
    group by rooms.id) progress;`);
  assert.equal(result.stdout.trim(), "t");
  console.log("PASS racing roster replacement and Chapter start leaves all four snapshots consistent");
} finally {
  await sql(`begin; ${auth} select public.delete_subject('fc200000-0000-4000-8000-000000000001'); reset role;
    delete from auth.users where id='fc100000-0000-4000-8000-000000000001'; commit;`);
}
