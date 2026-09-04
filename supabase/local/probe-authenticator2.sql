\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

-- Hypothesis: SET ROLE checks membership against the SESSION user
-- (authenticator), not the CURRENT role (anon). So "anon -> job_worker" in
-- the previous probe was never anon climbing; it was authenticator switching
-- twice. The test that matters: can a session whose SESSION user is anon or
-- authenticated reach job_worker? That is what an attacker who somehow held
-- such a session would have.

\echo === session_user vs current_user after the "climb" ===
set role anon;
set role job_worker;
select 'session_user=' || session_user || ' current_user=' || current_user;
reset role;

\echo === is job_worker reachable because ANON is a member, or because AUTHENTICATOR is? ===
select 'anon member of job_worker -> ' || pg_has_role('anon', 'job_worker', 'member');
select 'authenticated member of job_worker -> ' || pg_has_role('authenticated', 'job_worker', 'member');
select 'authenticator member of job_worker -> ' || pg_has_role('authenticator', 'job_worker', 'member');

\echo === can a SQL statement running AS anon (a security-invoker function body, an RLS policy, a view) SET ROLE? ===
-- This is the realistic attack surface: PostgREST has done SET ROLE anon;
-- the attacker controls only SQL text that runs as anon. Can that SQL escalate?
set role anon;
create or replace function pg_temp.try_climb() returns text language plpgsql as $$
begin
  execute 'set role job_worker';
  return 'ESCALATED to ' || current_user;
exception when others then
  return 'blocked: ' || sqlerrm;
end $$;
select pg_temp.try_climb();
reset role;