# User Feedback Outreach (September 2026)

## Purpose

Companion to `seo-libguide-outreach.md`. That document is about acquiring new
users. This one is about understanding the users already here, and it should be
worked through **before** the libguide outreach begins.

The reason for the ordering: as of 2026-09-02 production holds 40 users, and once
the internal accounts are set aside the external picture is small. Brandy's
workspace (`f993fdb6`) is the company's own, and its seven members are the
founders plus the EPI 6070 class cohort. That leaves roughly seven genuinely
external users with any activity in the 25 days of logs available (Loki retention
starts 2026-08-08):

| User               | Events | Window          |
| ------------------ | ------ | --------------- |
| Linda Schultz      | 145    | Aug 15 - Aug 30 |
| Sarah              | 17     | Sep 2           |
| Sophie-Marie Roth  | 9      | Aug 20          |
| gomezyaz12         | 8      | Aug 27          |
| Ahmed A Morsy      | 2      | Aug 24          |
| Francesco Motolese | 1      | Aug 22          |
| Lyle Gilbert       | 1      | Aug 25          |

Four projects have ever been created: three in the internal workspace and one by
Sharon Duncan. The dominant pattern is signup, one session, no return. The
libguide playbook is a machine for driving more signups into that pattern, so the
leak is worth finding first.

Related context:

- Free plan has `project.create: false` and `projects.max: 0`
  (`packages/shared/src/plans/plans.ts`), so a free user cannot save an appraisal
  or invite a reviewer without paying. This is the leading hypothesis for the
  leak and these emails are partly designed to test it.
- Of the two active `starter_team` subscriptions, one is the internal workspace.
  **Sharon Duncan is the only external paying customer.** That makes email 2 the
  most important message on this list by a wide margin.

## Principles

1. **Ask what happened, not what they think.** "What do you like?" returns
   politeness. "What were you hoping it would do?" returns the truth, because it
   is past tense and carries no implied criticism of the person.
2. **For active users, ask for a complaint specifically.** "What is the most
   annoying part right now?" gets a real list where "any feedback?" gets nothing.
3. **Do not lead with a free plan or discount.** Attaching an offer converts a
   feedback request into a sales email and the answer becomes polite. Offer the
   comp after they reply, as a thank you.
4. **One question per email.** Multiple questions sharply reduce reply rate.
5. **Send individually, from a personal address.** No marketing tool, no tracking
   pixels, no template footer. Replies must land in an inbox that gets read.
6. **Reply within 24 hours.** Every time.
7. Timing rules from `seo-libguide-outreach.md` apply: Tuesday through Thursday
   morning in the recipient's local time.

## Contactability: a pre-fix backlog, not an open bug

Nine of the 40 users have no deliverable email address. ORCID frequently
withholds the user's email, and the auth config falls back to a synthesized
address:

    email: profile.email || `${profile.sub}@orcid.org`
    -- packages/workers/src/auth/config.ts:184

`0009-0002-8318-1718@orcid.org` does not deliver anywhere.

**This is already fixed for new signups.** `complete-profile.tsx` detects the
placeholder with `isSyntheticEmail()` and requires a real address before the
profile can be completed (`needsRealEmail`, then `changeEmail()`). That landed
2026-09-01 in `f8c0f44b`, "Fix sign-in failures behind the EPI 6070 class-session
incident".

All nine affected users registered before that date, so they are a backlog rather
than an ongoing leak. They completed the older profile flow, which never asked.
Nothing to fix in code; the only question is whether these nine are worth
recovering by hand.

| Name                | Placeholder email               |
| ------------------- | ------------------------------- |
| Ahmed A Morsy       | `0009-0002-8318-1718@orcid.org` |
| Caio Camargo Calarga| `0000-0001-6405-2270@orcid.org` |
| David               | `0000-0002-4624-3337@orcid.org` |
| Elisabetta Brigo    | `0000-0001-9052-9749@orcid.org` |
| Isabella Klarenbeek | `0009-0001-2980-8607@orcid.org` |
| Megan L Hammersley  | `0000-0003-4326-480x@orcid.org` |
| Mohamed Ahmed Deyab | `0009-0008-3496-5712@orcid.org` |
| Peter Atef          | `0009-0006-8345-763x@orcid.org` (recovered 2026-09-04, see below) |
| Sharon Duncan       | `0009-0003-8111-0104@orcid.org` |

Two consequences:

- **Sharon Duncan is recoverable.** She has an active paid subscription, so
  Stripe holds her real billing email under customer `cus_UhX3HFTqEqv1cn`. Pull
  it from the Stripe dashboard before sending email 2.
- **Peter Atef is recovered.** He returned on 2026-09-04, signed in with ORCID,
  then tried Google and was given a second empty account because the placeholder
  email can never match another provider. The duplicate was merged into his
  original account the same day: Google is now linked to it, the email is his
  Gmail, and the Stripe customer was updated to match. Eight placeholder accounts
  remain, and each is one alternate-provider sign-in away from the same split.
- **Ahmed Morsy probably is not.** He registered 2026-08-24, a week before the
  fix, and never paid, so his Stripe record almost certainly carries the same
  placeholder. Fall back to his ORCID public record, or act in-app instead (see
  email 4).

---

## Email 1: Sarah

**To:** `szhao@hotmail.co.uk`
**Send:** immediately, 2026-09-02 or 2026-09-03
**Subject:** Quick question about your ROBINS-I appraisals

    Hi Sarah,

    I'm Jacob, I build CoRATES. I saw you ran through a batch of ROBINS-I
    appraisals yesterday and exported them, which is the most anyone has done
    with it in one sitting in a while.

    Would you tell me what you're working on, and whether there was anything
    you wanted it to do that it didn't? I'm especially curious whether you
    were looking for a way to save the appraisals or have a second reviewer
    on them, since that part isn't obvious right now.

    No pitch, I just want to know what you needed.

    Jacob

**Why this one first.** Signed up 2026-09-02 and completed six ROBINS-I
appraisals with a PDF export after each, between 08:14 and 10:26 CDT, entirely
in the local `/checklist` tool. Her memory is a day old. The second question is
the important one: she could not save any of that work, and her answer says
whether she noticed or cared. Based in Hook, England.

---

## Email 2: Sharon Duncan

**To:** real billing email from Stripe customer `cus_UhX3HFTqEqv1cn`
**Subject:** First Bite SLR

    Hi Sharon,

    Jacob here, I built CoRATES. You started a project called First Bite SLR
    back in June and you're on a paid plan, but I haven't seen you back in the
    app in a while and I'd really like to know why.

    Did something get in the way, or did the review move somewhere else?
    Either answer is useful and I'd rather hear it than guess. If it's
    something I can fix I'd like the chance to.

    Happy to refund you if it hasn't been worth it.

    Jacob

**Why.** Active `starter_team` subscriber, registered 2026-06-14, created project
"First Bite SLR" on 2026-06-15, sole member of her workspace, no activity in the
available log window. She was convinced enough to pay and then something after
that lost her, which makes her the most informative single contact on this list.
The refund offer costs 8 USD and signals the question is genuine.

---

## Email 3: Linda Schultz

**To:** `linda.schultz@uni-wh.de`
**Subject:** How did the review go?

    Hi Linda,

    I'm Jacob, the developer behind CoRATES. You were using it steadily through
    the second half of August and then stopped, and I'm trying to work out
    whether that's because you finished what you were doing or because you ran
    into a wall.

    Whichever it was, I'd like to know. You've used it more than almost anyone
    outside my own university, so your view is worth a lot to me.

    Jacob

**Why.** Universität Witten/Herdecke. 145 logged events across 2026-08-15 to
2026-08-30, then a hard stop. That is the most legible churn signal in the data
and the largest external usage by a wide margin.

**Second touch, only after she replies.** She is a strong candidate for an
introduction to the evidence synthesis librarian at Witten/Herdecke. The Tier 1
list in `seo-libguide-outreach.md` is 13 of 15 US or UK institutions and has no
European path; a warm faculty introduction is worth far more than a cold email.
Do not put this ask in the first message.

---

## Email 4: Ahmed A Morsy

**To:** no valid address on file; try ORCID record `0009-0002-8318-1718`
**Send:** before 2026-09-07
**Subject:** Your CoRATES trial

    Hi Ahmed,

    Jacob here, I built CoRATES. You started a trial on 24 August and it
    expires on the 7th. You only got one session in, and I'd like to know what
    stopped you rather than just letting it lapse.

    If you want more time I'll extend it, no charge. And if it wasn't what you
    expected, telling me that is worth more to me than the trial is.

    Jacob

**Why.** Trial grant runs 2026-08-24 to 2026-09-07. He used it on the first day
for two events and never returned. Only three trials have ever been issued and
the other two expired unused in July, so the trial mechanism itself is worth
understanding.

**If he cannot be reached,** extend the grant in `org_access_grants` before
2026-09-07 anyway. It costs nothing and leaves the door open.

---

## Email 5: Sophie-Marie Roth

**To:** `marie.roth@campus.lmu.de`
**Subject:** You may have landed in an empty CoRATES account

    Hi Sophie-Marie,

    I'm Jacob, I build CoRATES. I owe you a small explanation. When you signed
    in with ORCID on 20 August it created a second, empty account instead of
    opening the one you already had, so you would have seen a blank slate. That
    was our bug, and I've now merged the two - your ORCID login and your LMU
    email both open the same account.

    If that's what made you give up on it, I'm sorry, and it's fixed. If it was
    something else, I'd genuinely like to know what.

    Jacob

**Why.** LMU Munich, registered 2026-05-12. On 2026-08-20 she was active on two
separate accounts within three minutes of each other, which is the signature of
signing in via ORCID and landing in a fresh empty account. Her churn may be
literally caused by that bug rather than by the product. The accounts were merged
on 2026-09-02, so this is a genuine service notice rather than a pretext, which
makes it the easiest of the five to send and the most likely to get a reply.

## Not an email: the internal quota conversation

Brandy is a cofounder, not a customer, so she does not belong in this list. The
underlying facts still need acting on internally:

- Her workspace holds 3 of 3 permitted projects on `starter_team` ("Testing",
  "STC review", "EPI 6070" created 2026-08-31) and 7 of 10 seats. The next
  project will hit the ceiling.
- Since this is the company's own workspace, the fix is an access grant or a plan
  change, not a checkout.
- EPI 6070 is a founder-run class pilot rather than organic adoption, so treat it
  as a design partner: the best available source of detail on what a teaching
  cohort needs, but not evidence of market pull.

---

## After the five

Once the individual emails are out, work the quiet cohort: roughly 24 external
users with no activity in the log window, most of them registered between May and
July. One question, three sentences, batched in tens so
every reply can be answered the same day.

    Hi [name] - you signed up for CoRATES back in [month] and I noticed you
    didn't get far into it. I'm not trying to sell you anything, I'd genuinely
    just like to know what you were hoping it would do. Even one line would
    help a lot.

Be careful with EU recipients (Linda Schultz, Sophie-Marie Roth, Francesco
Motolese, Micol Cigna, Isabella Klarenbeek). A personal note to your own
registered user is defensible; a promotional blast is a different thing.

## What to watch for in the replies

The hypothesis under test is that the Free plan is the leak: a new user cannot
save a single appraisal or invite a single reviewer without paying first. If
three or four replies say some version of "I couldn't try the actual thing",
that is the answer, and giving Free one project and two collaborators is a
config change in `packages/shared/src/plans/plans.ts` that can be tested
immediately.

Record replies somewhere durable. The sample is small enough that three
consistent answers is a finding.
