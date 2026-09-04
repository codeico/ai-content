#!/usr/bin/env bash
# Behaviour proof for the Phase 8 Storage/Postgres boundary.
#
# This does not pretend plain Postgres is the Storage HTTP service. It tests the
# part we own and can prove locally: the bucket catalogue configuration, path
# reservation, RLS on storage.objects, system-owned media state, and atomic
# confirmation that an object row exists.
set -euo pipefail
export LC_ALL=en_US.UTF-8
PG=/opt/homebrew/opt/postgresql@17/bin
DB="${DB:-ai_content_test}"
H=127.0.0.1
Q() { "$PG/psql" -h "$H" -d "$DB" -qtAX -v ON_ERROR_STOP=1 "$@"; }

WS=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
OWNER=22222222-2222-4222-8222-222222222222
OTHER=33333333-3333-4333-8333-333333333333
CONTENT=cccccccc-cccc-4ccc-8ccc-cccccccccccc

fail=0
check() { # check <label> <actual> <expected>
  if [[ "$2" == "$3" ]]; then
    echo "  ok    $1 = $2"
  else
    echo "  FAIL  $1 = $2 (expected $3)"
    fail=1
  fi
}

fails() { # fails <label> <sql>
  local label="$1"
  local sql="$2"
  if Q -c "$sql" >/tmp/storage-probe-out 2>/tmp/storage-probe-err; then
    echo "  FAIL  $label unexpectedly succeeded"
    fail=1
  else
    echo "  ok    $label rejected"
  fi
}

as_user() { # as_user <uuid> <sql>
  local uid="$1"
  local sql="$2"
  Q -c "set role authenticated; set request.jwt.claim.sub='$uid'; $sql"
}

fails_as_user() { # fails_as_user <label> <uuid> <sql>
  local label="$1"
  local uid="$2"
  local sql="$3"
  fails "$label" "set role authenticated; set request.jwt.claim.sub='$uid'; $sql"
}

echo "== fixture =="
Q -c "insert into auth.users (id,email) values
        ('$OWNER','storage-owner@test'),
        ('$OTHER','storage-other@test')
      on conflict do nothing;
      insert into public.workspaces (id,name,owner_id)
        values ('$WS','Storage proof','$OWNER') on conflict do nothing;
      insert into public.content (id,workspace_id,title)
        values ('$CONTENT','$WS','Media proof') on conflict do nothing;"

check "bucket is private" "$(Q -c "select public from storage.buckets where id='content-media'")" "f"
check "bucket limit (bytes)" "$(Q -c "select file_size_limit from storage.buckets where id='content-media'")" "52428800"
check "bucket MIME count" "$(Q -c "select cardinality(allowed_mime_types) from storage.buckets where id='content-media'")" "2"

echo "== reservation =="
fails_as_user "non-member reserve" "$OTHER" \
  "select public.reserve_content_media('$WS','$CONTENT','mp4')"
fails_as_user "unsupported extension" "$OWNER" \
  "select public.reserve_content_media('$WS','$CONTENT','exe')"

KEY=$(as_user "$OWNER" "select public.reserve_content_media('$WS','$CONTENT','.MP4')")
check "server-generated key prefix" "${KEY%/*}" "$WS/$CONTENT"
check "server-generated extension" "${KEY##*.}" "mp4"
check "reserved row state" "$(Q -c "select media_status from public.content where id='$CONTENT'")" "temporary"
check "reserved row provider" "$(Q -c "select storage_provider from public.content where id='$CONTENT'")" "supabase"
check "same-type reservation is idempotent" \
  "$(as_user "$OWNER" "select public.reserve_content_media('$WS','$CONTENT','mp4')")" "$KEY"
fails_as_user "different-type reservation cannot reuse the old key" "$OWNER" \
  "select public.reserve_content_media('$WS','$CONTENT','mov')"

# Storage columns are outside every client grant. Direct writes fail with
# permission denied for authenticated AND service_role; only the SECURITY
# DEFINER verbs can move them. Ordinary columns must remain editable.
as_user "$OWNER" "update public.content set title='renamed' where id='$CONTENT'" >/dev/null
check "owner still edits ordinary columns" \
  "$(Q -c "select title from public.content where id='$CONTENT'")" "renamed"
fails_as_user "direct storage key write" "$OWNER" \
  "update public.content set storage_key='evil' where id='$CONTENT'"
fails_as_user "direct temporary -> available" "$OWNER" \
  "update public.content set media_status='available' where id='$CONTENT'"
fails_as_user "direct temporary -> missing" "$OWNER" \
  "update public.content set media_status='missing' where id='$CONTENT'"
fails "service_role direct temporary -> available" \
  "set role service_role; update public.content set media_status='available' where id='$CONTENT'"
fails "service_role direct storage key write" \
  "set role service_role; update public.content set storage_key='evil' where id='$CONTENT'"
check "forgery left state temporary" \
  "$(Q -c "select media_status from public.content where id='$CONTENT'")" "temporary"

# Confirm is not a promise: before Storage has written the object catalogue row
# it returns false and leaves the content temporary.
check "confirm before object" \
  "$(as_user "$OWNER" "select public.confirm_content_media('$WS','$CONTENT','$KEY')")" "f"

# The INSERT policy requires the exact reserved key and membership.
fails_as_user "member arbitrary object path" "$OWNER" \
  "insert into storage.objects(bucket_id,name) values ('content-media','$WS/$CONTENT/arbitrary.mp4')"
fails_as_user "non-member reserved path" "$OTHER" \
  "insert into storage.objects(bucket_id,name) values ('content-media','$KEY')"
as_user "$OWNER" \
  "insert into storage.objects(bucket_id,name,metadata) values ('content-media','$KEY','{\"mimetype\":\"video/mp4\",\"size\":12}'::jsonb)" >/dev/null
check "member can read exact object" \
  "$(as_user "$OWNER" "select count(*) from storage.objects where bucket_id='content-media' and name='$KEY'")" "1"
check "non-member sees zero objects" \
  "$(as_user "$OTHER" "select count(*) from storage.objects where bucket_id='content-media'")" "0"

# No UPDATE policy: Postgres does not throw here; RLS silently filters the row
# and reports UPDATE 0. Check durable state, not command exit.
as_user "$OWNER" \
  "update storage.objects set metadata='{}'::jsonb where bucket_id='content-media' and name='$KEY'" >/dev/null
check "client overwrite affects zero rows" \
  "$(Q -c "select metadata->>'mimetype' from storage.objects where bucket_id='content-media' and name='$KEY'")" "video/mp4"

check "confirm after object" \
  "$(as_user "$OWNER" "select public.confirm_content_media('$WS','$CONTENT','$KEY')")" "t"
check "confirm retry is idempotently true" \
  "$(as_user "$OWNER" "select public.confirm_content_media('$WS','$CONTENT','$KEY')")" "t"
check "confirmed row state" \
  "$(Q -c "select media_status from public.content where id='$CONTENT'")" "available"
check "confirmed row keeps key" \
  "$(Q -c "select storage_key from public.content where id='$CONTENT'")" "$KEY"
fails_as_user "direct available -> missing" "$OWNER" \
  "update public.content set media_status='missing' where id='$CONTENT'"
check "forgery left state available" \
  "$(Q -c "select media_status from public.content where id='$CONTENT'")" "available"
fails_as_user "content delete before object cleanup" "$OWNER" \
  "delete from public.content where id='$CONTENT' and workspace_id='$WS'"
check "release while object exists" \
  "$(as_user "$OWNER" "select public.release_content_media('$WS','$CONTENT')")" "f"

# This DELETE simulates Storage API remove(): the real service removes bytes
# and its catalogue row together while evaluating the same policy.
as_user "$OWNER" \
  "delete from storage.objects where bucket_id='content-media' and name='$KEY'" >/dev/null
check "member deletes exact object" \
  "$(Q -c "select count(*) from storage.objects where bucket_id='content-media' and name='$KEY'")" "0"
check "release after object removal" \
  "$(as_user "$OWNER" "select public.release_content_media('$WS','$CONTENT')")" "t"
check "release retry is idempotently true" \
  "$(as_user "$OWNER" "select public.release_content_media('$WS','$CONTENT')")" "t"
check "released row state" \
  "$(Q -c "select media_status from public.content where id='$CONTENT'")" "external_only"
check "released row clears key" \
  "$(Q -c "select count(storage_key) from public.content where id='$CONTENT'")" "0"
as_user "$OWNER" "delete from public.content where id='$CONTENT' and workspace_id='$WS'" >/dev/null
check "content delete after cleanup" \
  "$(Q -c "select count(*) from public.content where id='$CONTENT'")" "0"

if [[ "$fail" -ne 0 ]]; then
  echo "STORAGE CHECKS FAILED"
  exit 1
fi

echo "ALL STORAGE CHECKS PASSED"
