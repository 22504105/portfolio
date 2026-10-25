-- Covering indexes for foreign keys the Supabase performance advisor found without one (2026-10-25):
-- a delete of the referenced row (a teacher, a user, an inventory item) would otherwise scan the table.

create index if not exists daily_entries_teacher on questling.daily_entries (teacher_id);
create index if not exists mentor_messages_teacher on questling.mentor_messages (teacher_id);
create index if not exists audit_log_actor on questling.audit_log (actor);
create index if not exists equipped_user_item on questling.equipped (user_id, item);
