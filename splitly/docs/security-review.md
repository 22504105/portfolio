# Splitly — Security review (stage 5)

**Date:** 2026-10-12. **By:** the agent that wrote the code. This is a
self-review: it is honest about what was looked at, but it is not the
independent look the brief's "Agent C" would have been, and it should not be
read as one. What was checked is listed with how; what was not is listed too.

## What was checked, and how

| Area                              | Result                       | How it was checked                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in cannot be forged          | Holds                        | `tests/server.test.ts`, `tests/db/api.test.ts`: wrong token, altered fields, stale and future dates, malformed data all refused, one answer                                                                                                                                                         |
| Nothing without a session         | Holds                        | Every route but `POST session` reads the session first (24 of 25); tests call each with no, forged and expired tokens                                                                                                                                                                               |
| One group cannot reach another    | Holds                        | Every route that names a group, called by an outsider, answers exactly as for a group that does not exist; on a real database and on the live site (`scripts/live-check.mjs`)                                                                                                                       |
| Roles                             | Holds                        | Decided in one place on the server; the matrix in `security.md` is tested route by route                                                                                                                                                                                                            |
| Money cannot be made inconsistent | Holds                        | Shares are computed on the server; the database refuses an expense or a receipt line that does not add up, at commit                                                                                                                                                                                |
| Queries                           | Holds                        | Every query is parameterised; none is built from request text (searched for)                                                                                                                                                                                                                        |
| What a page may load              | Holds, with a known weakness | Policy read from the live site: own origin, Telegram's script, Telegram's photo hosts. Inline scripts are allowed (see below)                                                                                                                                                                       |
| Secrets                           | Holds                        | The built browser files were searched for the token, the session secret and the database address: none. `.env*` is ignored by git and by Vercel uploads                                                                                                                                             |
| Raw HTML                          | Holds                        | One use, the theme script, a constant with no input in it                                                                                                                                                                                                                                           |
| Requests from other sites         | Holds                        | The session travels in a header only the site's own script can set; state-changing requests also check `Origin`                                                                                                                                                                                     |
| Guessing and flooding             | Holds                        | Limits per address (sign-in) and per person (writes, invitations), counted outside the request's transaction                                                                                                                                                                                        |
| The receipt photo                 | Holds                        | A browser test fails if anything leaves the page's own origin during a scan                                                                                                                                                                                                                         |
| The spreadsheet export            | Holds                        | Formula-like cells are written as text; tested                                                                                                                                                                                                                                                      |
| Dependencies                      | Holds for what ships         | `npm audit --omit=dev`: 0. With development tools: 5 "high", all one advisory (`braces`, denial of service by a crafted pattern) inside the linter's own dependencies; it runs on this code only and is not shipped. Its only offered "fix" is downgrading the linter two major versions: not taken |

## Known weaknesses, accepted for a portfolio project

1. **Inline scripts are allowed** (`script-src 'unsafe-inline'`): Next.js
   starts pages with them. A script injected into a page could therefore run,
   and could read the session kept by the page. There is no place where
   people's text is put into a page as HTML, which is what would be needed
   first. Removing this means per-request nonces and giving up static pages.
2. **Sign-in data can be replayed for an hour** by someone who captured it
   (Telegram signs it once; `auth_date` is the only freshness). The session it
   buys lasts six hours.
3. **A leaked bot token forges sign-ins.** It lives in the host's settings
   only. If it leaks: revoke it in @BotFather, set the new one, redeploy.
4. **The server's database connection is all-powerful** over its schema: the
   database's own row rules deny everyone else, and the application is the
   only guard for its own queries. A mistake in `service.ts` would not be
   caught by the database, except for the money rules.
5. **Per-address limits trust the host's header** for the address. Correct on
   Vercel; on another host it would need looking at.
6. **Invented data in the demo is editable by the visitor** (it is in their
   browser). It reaches nobody else.

## Not checked

- No penetration test, and no review by a second person.
- Not used with a screen reader; accessibility was checked by machine only
  (`e2e/a11y.spec.ts`, WCAG 2.2 A and AA, every screen, both themes: clean).
- Telegram's own clients were not driven by tests: the real thing was opened
  by the owner on a phone, not systematically.
- Load: nothing was measured beyond single requests.
