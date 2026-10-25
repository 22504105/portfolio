-- The frozen-version trigger of migration 4 had two faults, found when the live check deleted its
-- teacher (2026-10-25):
--   * on DELETE it returned NEW, which is NULL there, so a BEFORE trigger silently cancelled the
--     delete of any draft;
--   * it refused to delete a published version even when its whole quest was being deleted (the
--     teacher's account removed), so no teacher with a published campaign could ever be deleted.
-- A published version still cannot be changed or deleted on its own; it goes only with its quest.
-- On a cascade from questling.quests the parent row is already gone when this runs.

create or replace function questling.quest_versions_frozen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' then
    if tg_op = 'DELETE' and not exists (select 1 from questling.quests where id = old.quest_id) then
      return old;
    end if;
    raise exception 'published quest versions are immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
