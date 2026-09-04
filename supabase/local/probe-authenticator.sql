-- Does "grant job_worker to authenticator" widen anything for anon/authenticated?
--
-- PostgREST's model: connect as authenticator (NOINHERIT), then SET ROLE to
-- the role named by the verified JWT claim. The question is whether a request
-- that PostgREST has already switched into anon or authenticated can reach
-- job_worker from there. If it can, option A is unsafe. If it cannot, the
-- grant widens nothing: only a JWT that already says role=job_worker gets
-- there, and only our worker can mint one.
\set ON_ERROR_STOP off
\pset format unaligned
\pset tuples_only on

grant job_worker to authenticator;

\echo === 1. authenticator -> job_worker directly (this is what a valid worker JWT does) ===
\c ai_content_test authenticator
set role job_worker;
select 'as ' || current_user || ': claim callable -> ' || (select has_function_privilege('public.claim_job(text)', 'execute'));
reset role;

\echo === 2. authenticator -> anon -> job_worker (an anon request trying to climb) ===
set role anon;
set role job_worker;
select 'after anon tried to climb, current_user = ' || current_user;
reset role;

\echo === 3. authenticator -> authenticated -> job_worker (a signed-in tenant trying to climb) ===
set role authenticated;
set role job_worker;
select 'after authenticated tried to climb, current_user = ' || current_user;
reset role;

\echo === 4. does anon or authenticated have any privilege on the verbs via membership? ===
set role anon;
select 'anon claim -> ' || has_function_privilege('public.claim_job(text)', 'execute');
reset role;
set role authenticated;
select 'authenticated claim -> ' || has_function_privilege('public.claim_job(text)', 'execute');
reset role;

\echo === 5. authenticator itself, without SET ROLE (NOINHERIT) ===
select 'authenticator bare claim -> ' || has_function_privilege('public.claim_job(text)', 'execute');
select 'authenticator bare table -> ' || has_table_privilege('public.jobs', 'select');
