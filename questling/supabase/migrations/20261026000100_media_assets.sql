-- Teachers' recordings (lib/server/media.ts): checked by content on upload, kept here, served only
-- through the server to the teacher and to students whose assigned campaign or word of the day uses
-- them. Limits are repeated here so that no path around the server can store more.
--   * MP3, M4A (AAC in MP4) or WAV; at most 2 MB and 60 seconds each;
--   * a teacher's recordings go with the teacher;
--   * like every questling table: row level security on, no grants to Supabase's API roles.
-- Rollback: drop table questling.media_assets (nothing else refers to it; graphs name ids as text).

create table questling.media_assets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references questling.teachers (user_id) on delete cascade,
  kind text not null check (kind = 'audio'),
  mime text not null check (mime in ('audio/mpeg', 'audio/mp4', 'audio/wav')),
  bytes bytea not null,
  size integer not null check (size between 1 and 2097152 and size = octet_length(bytes)),
  duration_ms integer not null check (duration_ms between 300 and 60000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create index media_assets_teacher on questling.media_assets (teacher_id, created_at desc);

alter table questling.media_assets enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on questling.media_assets from anon, authenticated';
  end if;
end;
$$;
