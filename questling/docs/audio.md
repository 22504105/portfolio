# Audio

How Questling speaks English: built-in recordings, teachers' recordings, and the device's voice as the
last resort. Built 2026-10-25 at the owner's request ("Reliable Audio & Listening System").

## Playback (`lib/client/audio.ts`, `components/student/line-audio.tsx`)

Every speaker button asks one player, in this order:

1. **A recording**: the teacher's, if the scene or word has one; else the line's built-in recording.
2. **The device's English voice** (Web Speech API), only if the device lists an English voice. The
   list is checked when the screen opens; WebViews that never list a voice count as having none.
3. **Nothing**: the button is disabled, and a press shows "Озвучка недоступна…".

What the user sees:

| Situation                                                 | The button                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A recording exists                                        | enabled; while loading `aria-busy`, while playing `aria-pressed` and its icon pulses; a second press stops it                      |
| The recording fails (network, format, a WebView refusing) | falls back to the device's voice once; if there is none, the notice "Не удалось воспроизвести звук…" and the button state `failed` |
| No recording, an English voice                            | enabled, the device reads the line                                                                                                 |
| No recording, no English voice                            | disabled; the listening quest's button reads "Озвучка недоступна на этом устройстве"                                               |
| Sound switched off (hero screen)                          | enabled; a press shows "Звук выключен…" rather than staying silent                                                                 |

One sound at a time: starting another line, or leaving the screen, stops the one playing. Playback
starts inside the tap itself (no wait before `play()`), which iOS and Telegram require.

## Built-in recordings (`scripts/build-audio.ts`, `public/audio`, `lib/audio/manifest.json`)

- **What**: every word of the day and its example; every listening line of the quick quests; for both
  campaigns, every scene's line (narration, dialogue, choice, question, puzzle, evidence, ending), every
  dialogue line, every chapter word. **91 lines, 303 s, 1.79 MB** (mono MP3, 22 kHz, 48 kbit/s).
- **How**: Piper 2023.11.14-2 (MIT) with the voice `en_US-ljspeech-high` (trained on LJ Speech, public
  domain), at 0.9× speed for learners; ffmpeg trims the silence, evens the loudness (EBU R128, −18 LUFS)
  and encodes. Each file is named by a hash of its normalized text (`lib/audio/clip.ts`): the screens
  find it from the text they show, and a line is never recorded twice. Nothing is generated at runtime.
- **Checked automatically**: every file is between 0.2 s and a length its text can have, and not silent
  (mean volume above −40 dB); `tests/audio.test.ts` checks that every line a screen can play has a file.
- **Pronunciation**: transcribed back with an offline recogniser (Vosk, `vosk-model-en-us-0.22-lgraph`).
  Of the 62 sentences, 35 come back word for word, 51 with fewer than 15 % of words different; mean
  word error 6 %, mostly the recogniser's own (I've → "I have", anyone → "any one", the name Eleanor).
  Single words are not judged this way (the recogniser has no context for them). **No person has
  listened to all of them yet.**
- **Re-record** after changing content: `npx tsx scripts/build-audio.ts` (tools on `E:\Tools`, see the
  script's header; `--list` shows the lines, `--force` re-records everything).

## Teachers' recordings

- **Where**: the quest builder's inspector for narration, dialogue and question scenes (listening riddles
  included), and the word of the day editor: pick an uploaded recording, upload a new one, listen in the
  browser's own player, replace, remove. The demo studio says it needs the signed-in studio.
- **Checked by content** (`lib/server/media.ts`): the file's signature must be MP3 (ID3 or an MPEG
  frame), M4A (`ftyp` with an audio brand) or WAV (`RIFF…WAVE`), and it must decode as that (music-metadata,
  MIT): the codec fits the container, there are channels, the length is readable. At most **2 MB** and
  **60 s**, at least 0.3 s; **50 MB** per teacher. The database repeats the limits (migration 7).
- **Stored**: table `questling.media_assets` (migration `20261026000100_media_assets.sql`), row level
  security on, no grants to Supabase's API roles: only the server reads it. A Supabase Storage bucket
  would need the project's service-role key, which this server does not hold (it talks to PostgreSQL
  directly); the storage functions in `lib/server/media.ts` are the only place to change for a bucket.
- **Who may do what**: only a teacher uploads; only the owner removes, and not while a draft, a published
  version or a word of the day uses it (409); a campaign cannot be published with another teacher's
  recording; replacing or removing a recording in the builder also deletes the old file when unused.
- **Who may hear it**: `<audio>` sends no headers, so each link carries a signed ticket for that viewer and
  that recording, valid for a session (6 h). The teacher gets links to their own; a student gets links only
  to the recordings in the teacher campaign versions in their world (assigned to their groups, or bound to
  their runs) and in their groups' words of the day, and only when the recording belongs to the teacher
  of that campaign or entry. Served with byte ranges (Safari on iOS needs them), `Cache-Control: private`.
- **Published versions keep working**: recordings are referenced by id from the graph; a version that uses
  one stops it being deleted.

## Tests

| What                                                                                                                                                                                                                        | Where                                                      | Result |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| Every built-in line has a recording; lengths sane                                                                                                                                                                           | `tests/audio.test.ts`                                      | ✓      |
| Content checks: MP3, M4A, WAV accepted with their length; a renamed PNG, an "MP3" that is text, empty bytes, a 75 s file, a 2 MB+ file refused                                                                              | `tests/media.test.ts`                                      | ✓      |
| Upload by teachers only, by content; owner-only removal; no publishing another teacher's recording; student access by assignment only; whole file, ranges, 416; forged and other-id tickets refused; in-use recordings kept | `tests/db/studio.test.ts`                                  | ✓      |
| Recording plays and ends; plays again; download fails → device voice; fails with no voice → notice; sound off → notice; switching lines stops the first                                                                     | `e2e/audio.spec.ts` (device voice stubbed)                 | ✓      |
| Builder: demo note; upload → name, length, player; replace removes the old; remove; refused file says why; >2 MB not sent                                                                                                   | `e2e/studio-audio.spec.ts` (server stood in for by routes) | ✓      |

## Not tested (needs devices or the owner)

- **No physical device has been used**: iOS Safari, Android Chrome, Telegram on Android and iOS are
  untested. `docs/telegram-checklist.md` lists what to check (row 17 and the audio rows below).
- A real device without an English voice (simulated in the browser only).
- Uploads against the real database: migration 7 is **not applied** to the production database (it needs
  the owner's word), and staging has no database. Until it is applied, the studio's upload answers with
  a server error on production.

Manual audio checks to add to a device session: play the word of the day (recording); turn on airplane
mode and play a line (device voice or the notice); play two lines quickly (only the second); leave the
screen while playing (it stops); in a listening riddle, play, answer, play again; as a teacher, upload an
M4A recorded on the phone and hear it in the preview.
