-- A person's Telegram photo: the address Telegram gave at their last sign-in,
-- so that the other people of their groups can see their face. Only the
-- address is kept; the picture stays with Telegram and is never copied here.
-- It is replaced (or cleared) at every sign-in, because these addresses stop
-- working after a while; a page that finds one dead draws a face instead.
alter table splitly.users
  add column photo_url text check (photo_url is null or (char_length(photo_url) <= 500 and photo_url like 'https://%'));
