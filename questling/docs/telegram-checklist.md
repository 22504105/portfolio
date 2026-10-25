# Manual check in Telegram (Android, iOS, Desktop)

What automated tests cannot see: the real Telegram WebView, its safe areas, its back button, its
downloader. **None of this has been done yet** (no physical device was available to the developer); the
columns are for whoever runs it. Mark each cell ✓, ✗ (with a note) or n/a.

The interface alone (no sign-in) can be checked on phones in a browser on the staging site,
https://questling-staging.vercel.app/ru/demo. The rows below need the real app.

Open the bot @QuestlingEnglish_bot → menu button "Играть" (it opens `https://questling-dusky.vercel.app/ru/app`).

| #   | Check                                                                                                                         | Android | iOS | Desktop |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | --- | ------- |
| 1   | The app opens signed in (no "открывается внутри Telegram" screen); the welcome or home screen appears                         |         |     |         |
| 2   | First run: choosing a hero is kept after closing and reopening the app                                                        |         |     |         |
| 3   | Nothing is hidden under Telegram's header or the phone's notch / home indicator (top and bottom)                              |         |     |         |
| 4   | The bottom navigation is fully visible and tappable on every main screen                                                      |         |     |         |
| 5   | No sideways scrolling on any screen; the map path stays within the screen                                                     |         |     |         |
| 6   | Story: play a scene, close Telegram mid-chapter, reopen — the story resumes at the same scene                                 |         |     |         |
| 7   | Quick quest and the day's quiz are graded; XP and coins change; reopening shows the same numbers                              |         |     |         |
| 8   | Shop: buying an item takes coins once; buying again is refused; the item appears in the inventory                             |         |     |         |
| 9   | Wardrobe: putting on the witch hat hides the cat's ears; taking it off shows them; the look is saved                          |         |     |         |
| 10  | Settings: switching the language to English and back changes the interface, not the story text                                |         |     |         |
| 11  | Settings → "Скачать мои данные": Telegram offers to save `questling-my-data.json`; the file opens                             |         |     |         |
| 12  | Settings → "Удалить мои данные" asks first; "Отмена" keeps everything; confirming shows the deleted note                      |         |     |         |
| 13  | After deleting, reopening the bot starts from the welcome screen (a fresh record)                                             |         |     |         |
| 14  | A group invite link `t.me/QuestlingEnglish_bot?startapp=<CODE>` opens the app and joins the group                             |         |     |         |
| 15  | The mentor's reply appears in Settings → "Ответы наставника" after the teacher answers                                        |         |     |         |
| 16  | Dark theme only: text stays readable in bright sunlight / low brightness (subjective)                                         |         |     |         |
| 17  | Speaker buttons play the recording; with no network they use the device's voice or say audio is unavailable (`docs/audio.md`) |         |     |         |
| 18  | Leaving the app for 6+ hours and returning signs in again without an error                                                    |         |     |         |
| 19  | Airplane mode mid-action: an error message appears, nothing is granted twice after reconnecting                               |         |     |         |
| 20  | Android hardware back button / iOS swipe-back moves within the app, not out of it unexpectedly                                |         |     |         |

Teacher Studio is desktop-first and opens in a browser, not in Telegram: `/{ru,en}/studio`. Its checks
are automated (`e2e/gate4.spec.ts`, `scripts/live-check.mjs`); manually, sign up with a real address only
once the owner has set up email (see `docs/security.md`, finding 7).

Record the date, the Telegram app version and the device model with the results.

## Before a device session (state on 2026-10-25)

- The bot: @QuestlingEnglish_bot, menu button "Играть" → `https://questling-dusky.vercel.app/ru/app`,
  Main Mini App on (checked through the Bot API).
- **The deployed site runs the Gate 4 code.** Rows 11–13 (my data), 17 (audio), 20 (back button) and the
  audio checks of `docs/audio.md` need the Gate 5 code deployed first: that is the owner's decision.
  Everything else can be checked now.
- The database is ready (migration 7 applied, backup taken); test accounts made on a phone are real rows
  of the development data: delete them in the app (Settings → My data) when done.
- Teachers: signing up a new teacher needs confirmation off or SMTP (`docs/security.md`, finding 7);
  the owner's own teacher account signs in already.
