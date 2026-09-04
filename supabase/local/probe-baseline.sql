\pset format unaligned
\pset tuples_only on
-- Baseline WITHOUT any job_worker grant: can anon-running SQL climb to service_role today?
set role anon;
create or replace function pg_temp.try_climb() returns text language plpgsql as $$
begin
  execute 'set role service_role';
  return 'ESCALATED to ' || current_user || ' (bypassrls=' || (select rolbypassrls from pg_roles where rolname=current_user) || ')';
exception when others then
  return 'blocked: ' || sqlerrm;
end $$;
select pg_temp.try_climb();
