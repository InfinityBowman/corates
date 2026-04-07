# SEO Libguide Outreach Kit

## Purpose

CoRATES is in the "early-but-healthy" SEO state identified in the April 2026
audit: all 3 resource pages (`/resources/amstar2`, `/resources/robins-i`,
`/resources/rob2`) are indexed and ranking for relevant queries, impressions
are trending up, and on-page SEO is solid. The dominant remaining gap is
**off-page authority**: the site has effectively zero inbound links from
high-trust domains.

In this niche, the dominant link channel is **university library research
guides ("libguides")**. Reference librarians at medical, public health, and
social science libraries maintain these guides to help researchers find
appraisal tools. Getting listed on a libguide produces:

- A `.edu` backlink from a high-authority domain (major SEO signal)
- Real human traffic from researchers actually working on systematic reviews
- Implicit peer endorsement alongside the canonical tools (AMSTAR, riskofbias.info, Cochrane, robvis)
- Compounding effects: other librarians notice listings on peer guides and
  copy them

Realistic conversion: 30-50% response rate, of which 60-70% accept. So 15
emails roughly yields 4-6 new backlinks.

This document contains the outreach templates, target list, and operational
playbook. It is the next high-leverage SEO action after the in-code changes
from the April 2026 audit are deployed.

---

## Prerequisites (do these BEFORE sending any outreach)

1. Deploy the changes from the April 2026 audit. The expanded resource pages
   are the concrete thing you will be pointing librarians at. Outreach
   before deploy means they click the links and see the old thin content.
2. Verify `curl -I https://corates.org/about/` returns HTTP 301 (not 307)
   to confirm the trailing-slash `_redirects` rules are live.
3. Verify the 3 resource pages are serving the expanded content. Open each
   in a browser and check for the "Bias domains assessed", "Frequently asked
   questions", and "Common pitfalls" sections.
4. Record a 60-90 second screencast of a complete appraisal flow (create
   project, add a study, answer a few signalling questions, see the
   auto-computed judgement, view the reconciliation view). Upload to
   YouTube or Loom. You will send this link to anyone who asks to "see it
   in action." Having it ready prevents deal-killing delays.
5. Set up a simple tracking spreadsheet. Columns:
   - Institution
   - Guide URL
   - Librarian name
   - Librarian email
   - Date email 1 sent
   - Date email 2 sent
   - Response received (Y/N/date)
   - Listing live (Y/N/URL)
   - Notes
6. Create a dedicated reply address if you don't want replies going to your
   personal inbox. Example: `partnerships@corates.org` or
   `outreach@corates.org`.

---

## Email 1: Initial outreach to a librarian (cold)

Subject line:

    Suggestion for [LIBRARY NAME]'s critical appraisal guide: CoRATES

Body:

    Hi [FIRST NAME],

    I came across [LIBRARY NAME]'s systematic review guide ([LIBGUIDE URL])
    while looking at how libraries cover critical appraisal tools, and I
    noticed you list [TOOL ALREADY LISTED, e.g. "Robvis and the Risk of
    Bias 2 tool"]. I lead development on CoRATES, a free collaborative
    appraisal tool that supports AMSTAR 2, ROBINS-I V2, and RoB 2, and I
    think it might fit alongside the tools you already feature.

    CoRATES gives review teams a structured digital workflow for the three
    tools (signalling questions, automatic scoring with the official
    algorithms, side-by-side reconciliation between independent reviewers,
    and exportable risk-of-bias visual summaries). It runs in the browser,
    has a free tier, and does not modify or replace the official
    instruments.

    Relevant pages if you want to evaluate:
      - https://corates.org/                       (overview)
      - https://corates.org/resources/amstar2      (AMSTAR 2)
      - https://corates.org/resources/robins-i     (ROBINS-I V2)
      - https://corates.org/resources/rob2         (RoB 2)

    If it would help, I can send a short draft entry sized to match your
    existing tool listings, or jump on a 15-minute call to walk through it.
    Either way, no pressure - I just wanted to put it on your radar.

    Thanks for the work you do supporting evidence synthesis at
    [INSTITUTION],

    Jacob Maynard
    CoRATES (Syntch LLC)
    jacob@corates.org   |   https://corates.org

Approximately 220 words. Long enough to establish credibility, short enough
that a busy librarian will read it.

Design rationale:

- Names them, names their guide, names a tool they already list. Proves
  you actually looked at their page, which separates this from spam.
- One factual sentence on what CoRATES is, no marketing language.
- Concrete URLs directly to the right pages, not just "visit our site".
- Explicitly says "free" and "does not replace the official instruments".
  Academic librarians are wary of vendor lock-in and copyright concerns
  with appraisal tool implementations.
- Two low-pressure CTAs: "draft entry" (preferred - zero work for them)
  and "15-minute call" (for those who want to see it live).
- Sign-off thanks them for their work, does not ask them to do work
  for you.

---

## Email 2: Follow-up if no response

Send 10-14 days after email 1. **Send only one follow-up.** No third touch.
If they don't respond after two emails, move on.

Subject line:

    Re: Suggestion for [LIBRARY NAME]'s critical appraisal guide: CoRATES

Body:

    Hi [FIRST NAME],

    Following up on the note below in case it got buried. No pressure at
    all - if CoRATES isn't a fit for the guide that's totally fine, just
    wanted to make sure the message reached you.

    If it would save you time, here is a draft entry sized to match the
    other tools on your guide:

      CoRATES - Collaborative Research Appraisal Tool for Evidence
      Synthesis
      Free, browser-based collaborative platform for AMSTAR 2,
      ROBINS-I V2, and RoB 2 appraisals. Supports independent
      multi-reviewer assessment with side-by-side reconciliation,
      automatic scoring using the official algorithms, and
      exportable risk-of-bias visual summaries.
      https://corates.org

    Happy to revise the wording if you'd like a different framing.

    Thanks,
    Jacob

    [ORIGINAL EMAIL QUOTED BELOW]

Design rationale:

- Acknowledges they may have skipped the first email without guilt-tripping.
- Reduces friction further by providing the actual draft text inline.
- Quotes the original below so they don't have to dig for context.
- Explicitly invites revision, which makes librarians feel ownership of
  the listing rather than like they are copy-pasting vendor copy.

---

## Email 3: Variant for methods groups, tool authors, and aggregators

This is for a different audience: peers who maintain the official tools
and the aggregators that list them. Examples: Cochrane Bias Methods Group,
riskofbias.info maintainers, JBI critical appraisal team, Luke McGuinness
(robvis author), Latitudes Network, NCCMT.

The framing is different: you are asking for peer feedback and a potential
link, not for inclusion in a customer-facing research guide. Do not send
this email before you have solid content on the resource pages and have
verified the methodological accuracy of each tool's description against
the current official guidance.

Subject line:

    CoRATES - open implementation of AMSTAR 2 / ROBINS-I V2 / RoB 2 for
    evidence synthesis teams

Body:

    Hi [FIRST NAME],

    I wanted to share a tool I've been working on in case it's of interest,
    or in case you've seen others working in similar territory. CoRATES is
    a free, browser-based collaborative platform that implements AMSTAR 2,
    ROBINS-I V2, and RoB 2 as structured workflows: signalling questions
    in context, automatic scoring with the official algorithms,
    multi-reviewer reconciliation, and exportable visual summaries.

    The implementation is careful about copyright. We do not reproduce the
    instruments, modify the algorithms, or present an alternative to the
    published guidance. We point users at the official sources at every
    step. The goal is to provide the workflow infrastructure that
    spreadsheets and PDF forms can't, while keeping the appraisal itself
    faithful to the published methodology.

    A few specific things I'd value your input on:
      1. Whether the framing of [TOOL] in our resource page accurately
         reflects [GROUP'S] current guidance:
         [LINK TO RELEVANT RESOURCE PAGE]
      2. Whether you'd be open to a link or mention from your own
         resources, where appropriate
      3. Anything we're getting wrong methodologically that you'd like
         corrected

    Happy to share more, or just leave this as a heads-up. Either way,
    thank you for the work your group has put into [TOOL] - it's the
    foundation the rest of us build on.

    Jacob Maynard
    CoRATES (Syntch LLC)
    jacob@corates.org   |   https://corates.org

Design rationale:

- Acknowledges they are peers, not customers.
- Asks for their feedback, not their listing. "Would you be open to a
  link" gives them an out.
- Treats methodological accuracy as the primary concern (which it is
  for tool authors).
- Explicitly addresses the IP/copyright concern up front. Tool authors
  have seen their checklists pirated by SaaS clones and this is one of
  their biggest concerns when evaluating third-party implementations.

This is a longer game than the libguide outreach. Do not expect every
recipient to reply. Do not follow up aggressively.

---

## Tier 1 target list: university library guides (15 targets)

These are guides that already list multiple appraisal tools and are
maintained by named librarians. Start here.

| Institution                   | Guide URL                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------- |
| WashU Becker Medical Library  | `beckerguides.wustl.edu/SystematicReviews/riskofbias`                        |
| GWU Himmelfarb                | `guides.himmelfarb.gwu.edu/systematic_review/reporting-quality-risk-of-bias` |
| Harvard Countway              | `guides.library.harvard.edu/meta-analysis/countwayRoB`                       |
| Mayo Clinic Libraries         | `libraryguides.mayo.edu/evidencesynthesis/criticalappraisal`                 |
| Duke Medical Center Library   | `guides.mclibrary.duke.edu/sysreview/assess`                                 |
| University of Minnesota       | `libguides.umn.edu/c.php?g=1264119&p=9285838`                                |
| Weill Cornell Medical College | `med.cornell.libguides.com/systematicreviews/riskofbias`                     |
| Imperial College London       | `library-guides.imperial.ac.uk/systematic-review/critical_appraisal`         |
| NYU Health Sciences           | `hslguides.med.nyu.edu/systematicreviews/criticalappraisal`                  |
| Anglia Ruskin University      | `anglia.libguides.com/criticalappraisal/tools`                               |
| Emory University Libraries    | `guides.libraries.emory.edu/SRs/qa_tools`                                    |
| Virginia Tech                 | `guides.lib.vt.edu/SRMA/appraisal`                                           |
| Rutgers (Social Sciences)     | `libguides.rutgers.edu/es_social/criticalappraisal`                          |
| Colorado State                | `libguides.colostate.edu/sres/Tools`                                         |
| MUSC                          | `musc.libguides.com/ebp/appraisal`                                           |

Rutgers Social Sciences is worth particular attention: it expands reach
beyond medical libraries, where CoRATES has a potential audience that
most competitors do not target.

## Tier 2 target list: methods groups and aggregators (use email 3 variant)

| Group                                       | URL                                   |
| ------------------------------------------- | ------------------------------------- |
| Cochrane Bias Methods Group                 | `methods.cochrane.org/bias`           |
| riskofbias.info                             | `riskofbias.info`                     |
| JBI                                         | `jbi.global/critical-appraisal-tools` |
| Centre for Evidence-Based Medicine (Oxford) | `cebm.ox.ac.uk`                       |
| Latitudes Network                           | `latitudes-network.org`               |
| NCCMT (Canada)                              | `nccmt.ca`                            |

Do NOT cold-email these groups until you have at least 3-5 tier-1 listings
live. You want to show them you are already in the ecosystem when you
reach out.

---

## Operational playbook

### Finding the right person to email

Most libguides show a "maintained by" line at the top of the page with a
name, a photo, and a contact form or email link. Email that person
directly.

If no name is shown:

1. Search the institution's library directory for "systematic review",
   "evidence synthesis", or "research methods" librarian.
2. Use the subject librarian for health sciences, nursing, or medicine,
   depending on the guide's audience.
3. As a last resort, use the generic library email address, but expect
   lower response rates.

Do NOT use LinkedIn InMail for first contact. Librarians generally prefer
email and find LinkedIn spammy.

### Personalization minimum

The single phrase "I noticed you list [tool already on their guide]" is
what separates this outreach from spam. Spend 30 seconds per guide
actually looking at it before sending.

If you don't have time to do that for every target, cut the list down.
15 well-personalized emails will outperform 50 generic ones by a wide
margin and will not burn the institution for future contact.

### Timing

- Send Tuesday, Wednesday, or Thursday morning in the recipient's local
  time.
- Avoid Mondays (inbox cleanup) and Fridays (wind-down).
- Avoid academic holidays: Christmas/New Year, late August (end of summer
  before fall term), US Spring Break (mid-March), Thanksgiving week.
- Summer (June-August) is generally fine in the US and UK but avoid the
  first 2 weeks of August when European academics take vacation.

### Tracking

Keep the spreadsheet up to date after every action. Review weekly. Before
sending any new email, search the spreadsheet to make sure you haven't
already emailed that person.

After 4-6 weeks, re-export Google Search Console's Performance report and
look at the Referring Pages and Top Linking Sites data (if you have any
backlink tool access). Each new `.edu` referring domain is a win. Compare
against the baseline from the April 2026 audit.

### Things to NEVER do

- Do NOT buy backlinks. Google penalizes paid links and the sites that
  sell them are low quality. The only sustainable path is earned listings.
- Do NOT hire a link-building agency. They will send mass emails using
  your name, get marked as spam, damage your sender reputation across
  hundreds of academic mailboxes you actually wanted to reach later, and
  produce mostly garbage low-authority links.
- Do NOT use tracking pixels in outreach emails. Librarians notice and
  resent them. If you need to know whether emails were opened, use
  response rate as the signal instead.
- Do NOT send more than one follow-up. Two touches is professional,
  three is harassment.
- Do NOT email the same institution about multiple guides. Pick the most
  relevant guide per institution and focus on that one librarian.

### When a librarian says yes

Respond within 24 hours. Send the draft entry text from email 2 if you
haven't already. Offer to provide a screenshot or screencast link.
Answer any questions about pricing, data handling, or institutional
access.

Follow up 2 weeks later to confirm the listing went live. Once it is
live, note the URL in your tracking spreadsheet and thank the librarian.

### When a librarian asks for something specific

- "Can you show it to me?" Send the screencast link immediately. Do not
  schedule a call unless they specifically ask for one.
- "Is there a FERPA/GDPR/data residency issue?" Be honest. CoRATES is
  hosted on Cloudflare Workers. Data handling specifics should come from
  your actual privacy policy, not this document.
- "Can we get an institutional/site license?" This is a positive signal.
  Even if you do not have formal site licenses yet, engage with the
  conversation.
- "Do you have a competitor comparison?" Do not trash competitors.
  Describe CoRATES's distinctives factually: real-time multi-reviewer
  collaboration, automatic scoring with official algorithms, export to
  publication-ready visual summaries. Let them draw the comparison.
- "What is your long-term sustainability plan?" Honest answer: early
  access, free tier, paid tiers for teams, supported by Syntch LLC.

### When a librarian says no

Thank them. Do not argue. Ask if there is a different guide at their
institution where it might fit better (there often is - many institutions
have multiple systematic review guides maintained by different subject
librarians).

Revisit the same institution in 12-18 months with updated content. By
then you will have more backlinks, more content, and a stronger pitch.

---

## What to do AFTER you have the first few backlinks

Once 3-5 libguide listings are live, the next tier is harder to reach but
gets CoRATES in front of more researchers per conversion:

1. **Systematic review workshop instructors.** Most universities offer
   hands-on SR training through the library or a methods center. The
   instructors decide which tools they demonstrate. Finding and emailing
   them is similar to the libguide playbook but requires more research
   per contact.

2. **Authors of recent SR methodology papers.** Search PubMed for papers
   published in the last 12 months that use AMSTAR 2, ROBINS-I V2, or
   RoB 2. Email the corresponding author with a short note about CoRATES
   and offer to demo it. This is lower conversion but higher-value per
   conversion.

3. **Cochrane Training / Cochrane Learning Live.** If you can get CoRATES
   mentioned in a Cochrane-endorsed training context, the SEO and direct
   traffic value is enormous. This takes months of relationship building
   and requires genuine methodological credibility.

4. **Conference-adjacent outreach.** Evidence Synthesis and Meta-Analysis
   Conference, Cochrane Colloquium, JBI Scientific Symposium, EQUATOR
   Network events. Not sponsorships - just be present, introduce yourself
   to methods people in conversation, and follow up with a short email.

These are all longer games than libguide outreach and should not be
attempted until the libguide playbook has produced measurable results.

---

## Success metrics

Track monthly:

- Number of `.edu` and other high-authority referring domains (from GSC
  or any backlink tool you gain access to)
- Number of tier-1 libguides with CoRATES listed
- `/resources/robins-i`, `/resources/amstar2`, `/resources/rob2` average
  position in GSC Performance for their respective head terms
- Total non-branded clicks from GSC Performance (this is the leading
  indicator that the strategy is working)
- Referring domain diversity (count of distinct referring domains)

Do not obsess over month-to-month numbers. SEO is a multi-month game and
week-to-week variance is noise. Review the data quarterly for real
decisions and ignore short-term fluctuations.

---

## Maintenance

When the audit or the underlying tool pages change materially (a new
version of ROBINS-I, a new appraisal tool added, pricing changes, etc.),
revisit the email templates and the draft listing text to keep them
accurate. Email a short update to any librarians who previously listed
CoRATES so they can refresh their guide if they want to.

When a new public marketing or resources route is added to corates.org,
remember to also add the corresponding trailing-slash 301 entry to
`packages/web/public/_redirects` so Google does not flag it under "Page
with redirect" in Search Console (see `.claude/CLAUDE.md` for the
maintenance rule).
