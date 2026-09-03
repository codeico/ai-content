# Instagram Publishing — Feasibility

Research only. Nothing here is implemented, and nothing here needed credentials
to establish. Written because the answer to one question reorders the roadmap,
and finding it out at Phase 9 instead of now would be expensive.

Sources are Meta's own docs, retrieved 2026-09-03:

- https://developers.facebook.com/documentation/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/instagram-api/guides/content-publishing

---

## The finding that changes sequencing

**Media must already be at a publicly fetchable URL. Meta pulls it; you cannot
upload bytes in the request.**

Meta's wording, verbatim:

> We cURL media used in publishing attempts, so the media must be hosted on a
> publicly accessible server at the time of the attempt.

And again on the container endpoint:

> `image_url` or `video_url` – Set to the path of the image or video. We will
> cURL your image using the passed in URL so it must be on a public server.

### What this means for us

Object storage stops being an optional convenience and becomes a **prerequisite
for the entire publishing phase**. Every media file we intend to publish must
be:

1. stored somewhere we control,
2. reachable over public HTTPS with no auth at the moment Meta fetches it,
3. still there when the fetch happens — this is a pull, not a push, so a
   pre-signed URL has to outlive the publish call.

Point 3 is the uncomfortable one. Public-but-unguessable URLs are the usual
answer, and that is a real exposure decision, not a detail: anyone holding the
URL can fetch the file. It needs a deliberate call on expiry, and it is a
security question, not a storage question.

**Sequencing consequence:** storage moves ahead of publishing in the roadmap.
Building the publish flow first would produce something that cannot publish
anything.
## Account requirements

Blocking, but ordinary.

- The target account must be an Instagram **professional** account (Business or
  Creator). A personal account cannot publish through the API at all.
- Two integration paths exist, with different hosts and tokens:
  - **Instagram Login** — `graph.instagram.com`, Instagram User access token,
    permissions `instagram_business_basic` + `instagram_business_content_publish`
  - **Facebook Login for Business** — `graph.facebook.com`, Facebook Page
    access token, requires the account to be connected to a Facebook Page
- **Page Publishing Authorization (PPA)** may be required on the linked Page.
  Meta's own guidance is telling: *"Since there's no way for you to determine if
  an app user's Page requires PPA, we recommend that you advise app users to
  preemptively complete PPA."* We cannot detect this state — so the onboarding
  flow has to instruct the user rather than check for them, and a publish can
  fail for a reason our UI cannot see in advance.

Older documentation says Creator accounts are unsupported; the current
Instagram Platform docs describe professional accounts generally. **This is one
place where the docs disagree with each other**, and it should be settled
against a real Creator account before we promise support for one.

## App Review

`instagram_business_content_publish` requires **Advanced Access** to work on
accounts other than the developer's own. Standard Access covers testing with
your own account only.

Practical consequence: we can build and test the entire flow with one account
we control, with no review. Shipping it to users requires App Review, which
means business verification, a privacy policy URL, and a screencast of the
flow. That is a lead time to plan for, not a technical blocker — but it must
start before the feature is "done", not after.

## Hard limits worth knowing now

- **25 API-published posts per account per rolling 24 hours.** A carousel counts
  as one. Meta explicitly recommends the app enforce this itself, especially if
  it offers scheduling — so the limit is our concern, not just theirs.
- **No native scheduling.** The API publishes on request. Any "schedule a post"
  feature is entirely our own job queue, which lines up with Phase 5.
- Two-step container model: create a media container, then publish it. Reels and
  stories differ from feed posts; `alt_text` is supported on images only.
- JPEG is the safest image format; other types have historically been rejected.

## Token lifecycle

Long-lived tokens expire and must be refreshed before they lapse. There is no
push signal when a user changes their password or revokes access — the next
call simply fails. So the design has to treat a dead token as an expected
state with a visible reconnect path, not as an error to log.

## Verdict

**Not a blocker. A reordering.**

Nothing here makes Instagram publishing infeasible. But the media-hosting
requirement means storage is a prerequisite for the publishing phase, and the
App Review lead time means the paperwork should start before the code is
finished.

The one thing I could not settle from documentation: whether Creator accounts
publish successfully today. The docs contradict each other, and only a real
account resolves it.
