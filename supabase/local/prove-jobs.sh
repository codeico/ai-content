#!/usr/bin/env bash
# Concurrency proof for the jobs table, against a real Postgres.
#
# Marcus's pushback, accepted: "claim safely, prevent duplicate execution,
# recover stale jobs" cannot be verified with a mocked client. This runs N
# genuinely parallel psql sessions, each as job_worker, all racing for the same
# pending jobs, and then checks the invariants from the resulting rows.
set -euo pipefail
export LC_ALL=en_US.UTF-8
PG=/opt/homebrew/opt/postgresql@17/bin
DB="${DB:-ai_content_test}"
H=127.0.0.1
Q() { "$PG/psql" -h "$H" -d "$DB" -qtAX -v ON_ERROR_STOP=1 "$@"; }

WS=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
USR=11111111-1111-1111-1111-111111111111

fail=0
check() { # check <label> <actual> <expected>
  if [[ "$2" == "$3" ]]; then echo "  ok    $1 = $2"; else echo "  FAIL  $1 = $2 (expected $3)"; fail=1; fi
}

echo "== fixture =="
Q -c "insert into auth.users (id,email) values ('$USR','p7@test') on conflict do nothing;
      insert into public.workspaces (id,name,owner_id) values ('$WS','WS','$USR') on conflict do nothing;
      delete from public.jobs;"

# ---------------------------------------------------------------------------
echo "== 1. N workers race for 1 job: exactly one wins =="
Q -c "select public.enqueue_job('$WS','proof','{}'::jsonb)" >/dev/null 2>&1 || \
Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)" >/dev/null
N=12
for i in $(seq 1 $N); do
  Q -c "set role job_worker; select coalesce((public.claim_job('racer-$i')).id::text,'')" &
done | grep -c . > /tmp/wins.txt || true
wait
wins=$(cat /tmp/wins.txt)
check "winners among $N racers" "$wins" "1"
check "running rows" "$(Q -c "select count(*) from public.jobs where status='running'")" "1"
check "attempt_count after single claim" "$(Q -c "select attempt_count from public.jobs")" "1"

# ---------------------------------------------------------------------------
echo "== 2. N workers, N jobs: every job claimed exactly once, no double claim =="
Q -c "delete from public.jobs;"
for i in $(seq 1 $N); do
  Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{\"i\":$i}'::jsonb)" >/dev/null
done
for i in $(seq 1 $N); do
  Q -c "set role job_worker; select (public.claim_job('w-$i')).id" &
done > /tmp/claims.txt
wait
check "distinct jobs claimed" "$(sort -u /tmp/claims.txt | grep -c .)" "$N"
check "total claims returned" "$(grep -c . /tmp/claims.txt)" "$N"
check "distinct lock tokens" "$(Q -c "select count(distinct locked_by) from public.jobs where status='running'")" "$N"

# ---------------------------------------------------------------------------
echo "== 3. fencing: a worker that lost its lease writes zero rows =="
Q -c "delete from public.jobs;"
Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)" >/dev/null
JID=$(Q -c "set role job_worker; select (public.claim_job('zombie')).id")
# Simulate lease expiry: age the lock past job_lease_for('proof') = 2 minutes.
Q -c "update public.jobs set locked_at = now() - interval '3 minutes' where id='$JID'"
RECLAIM=$(Q -c "set role job_worker; select (public.claim_job('fresh')).id")
check "stale job reclaimed by fresh worker" "$RECLAIM" "$JID"
check "locked_by rewritten" "$(Q -c "select locked_by from public.jobs where id='$JID'")" "fresh"
check "attempt_count incremented on reclaim" "$(Q -c "select attempt_count from public.jobs where id='$JID'")" "2"
# Zombie resumes and tries to complete with its old token.
check "zombie complete_job returns" "$(Q -c "set role job_worker; select public.complete_job('$JID','zombie','{\"from\":\"zombie\"}'::jsonb)")" "f"
check "row untouched by zombie (still running)" "$(Q -c "select status from public.jobs where id='$JID'")" "running"
check "result untouched by zombie" "$(Q -c "select coalesce(result::text,'null') from public.jobs where id='$JID'")" "null"
# Fresh worker completes.
check "fresh complete_job returns" "$(Q -c "set role job_worker; select public.complete_job('$JID','fresh','{\"from\":\"fresh\"}'::jsonb)")" "t"
check "final status" "$(Q -c "select status from public.jobs where id='$JID'")" "completed"
check "lock cleared" "$(Q -c "select locked_by is null and locked_at is null from public.jobs where id='$JID'")" "t"

# ---------------------------------------------------------------------------
echo "== 4. retry: fail reschedules with backoff until max_attempts, then terminal =="
Q -c "delete from public.jobs;"
Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)" >/dev/null
for attempt in 1 2 3; do
  # Pull scheduled_for into the past so the job is due regardless of backoff.
  Q -c "update public.jobs set scheduled_for = now() - interval '1 second'"
  JID=$(Q -c "set role job_worker; select (public.claim_job('retrier')).id")
  NEXT=$(Q -c "set role job_worker; select public.fail_job('$JID','retrier','proof_failed',true)")
  if [[ $attempt -lt 3 ]]; then
    check "attempt $attempt -> next status" "$NEXT" "pending"
    check "attempt $attempt -> scheduled in future" "$(Q -c "select scheduled_for > now() from public.jobs")" "t"
  else
    check "attempt $attempt -> terminal" "$NEXT" "failed"
  fi
done
check "final attempt_count" "$(Q -c "select attempt_count from public.jobs")" "3"
check "last_error_code recorded" "$(Q -c "select last_error_code from public.jobs")" "proof_failed"
check "terminal job not claimable" "$(Q -c "update public.jobs set scheduled_for=now()-interval '1s'; set role job_worker; select coalesce((public.claim_job('x')).id::text,'none')")" "none"

# ---------------------------------------------------------------------------
echo "== 5. non-retryable failure is terminal on first attempt =="
Q -c "delete from public.jobs;"
Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)" >/dev/null
JID=$(Q -c "set role job_worker; select (public.claim_job('w')).id")
check "non-retryable -> failed" "$(Q -c "set role job_worker; select public.fail_job('$JID','w','bad_payload',false)")" "failed"
check "attempt_count stays 1" "$(Q -c "select attempt_count from public.jobs")" "1"

# ---------------------------------------------------------------------------
echo "== 6. dedup: same active key is rejected; completed key can be reused =="
Q -c "delete from public.jobs;"
Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb,'k1')" >/dev/null
DUP_OUT=$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb,'k1')" 2>&1 || true)
if grep -q "duplicate key\|23505" <<<"$DUP_OUT"; then DUP="duplicate key"; else DUP="accepted"; fi
check "duplicate active key" "$DUP" "duplicate key"
JID=$(Q -c "set role job_worker; select (public.claim_job('w')).id")
Q -c "set role job_worker; select public.complete_job('$JID','w',null)" >/dev/null
check "same key after completion accepted" "$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb,'k1') is not null")" "t"

# ---------------------------------------------------------------------------
echo "== 7. cancel: pending -> failed/cancelled; running -> flag only, not claimable =="
Q -c "delete from public.jobs;"
P=$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)")
R=$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)")
Q -c "set role job_worker; select (public.claim_job('w')).id" >/dev/null   # claims $P (earlier scheduled_for)
check "cancel pending" "$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.cancel_job('$R')")" "t"
check "pending -> failed" "$(Q -c "select status||'/'||last_error_code from public.jobs where id='$R'")" "failed/cancelled"
check "cancel running" "$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.cancel_job('$P')")" "t"
check "running stays running, flagged" "$(Q -c "select status||'/'||cancel_requested from public.jobs where id='$P'")" "running/true"
Q -c "update public.jobs set locked_at = now() - interval '3 minutes' where id='$P'"
check "cancel-requested stale job NOT reclaimed" "$(Q -c "set role job_worker; select coalesce((public.claim_job('x')).id::text,'none')")" "none"

# ---------------------------------------------------------------------------
echo "== 8. cross-tenant: other user cannot cancel this workspace's job =="
Q -c "insert into auth.users (id,email) values ('22222222-2222-2222-2222-222222222222','o@test') on conflict do nothing;
      insert into public.workspaces (id,name,owner_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','O','22222222-2222-2222-2222-222222222222') on conflict do nothing;
      delete from public.jobs;"
JID=$(Q -c "set role authenticated; set request.jwt.claim.sub='$USR'; select public.enqueue_job('$WS','proof','{}'::jsonb)")
check "other tenant cancel returns" "$(Q -c "set role authenticated; set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222'; select public.cancel_job('$JID')")" "f"
check "job unaffected" "$(Q -c "select status||'/'||cancel_requested from public.jobs where id='$JID'")" "pending/false"
check "other tenant enqueue into foreign workspace" "$(Q -c "set role authenticated; set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222'; select public.enqueue_job('$WS','proof','{}'::jsonb)" 2>&1 | grep -c "not a member")" "1"

# ---------------------------------------------------------------------------
echo "== 9. workspace delete is blocked while jobs exist (restrict, not cascade) =="
check "delete workspace with jobs" "$(Q -c "delete from public.workspaces where id='$WS'" 2>&1 | grep -c "violates foreign key")" "1"

echo
Q -c "delete from public.jobs;"
if [[ $fail -eq 0 ]]; then echo "ALL CONCURRENCY CHECKS PASSED"; else echo "SOME CHECKS FAILED"; exit 1; fi
