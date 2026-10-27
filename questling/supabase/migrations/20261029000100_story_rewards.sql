-- Story rewards (features gate E): a picture search can give a free cosmetic, kept with the source
-- 'story'. Non-destructive: the inventory's source check widened by one value.
-- Rollback: delete from questling.inventory where source = 'story' (if those items must go), then
--   alter table questling.inventory drop constraint inventory_source_check;
--   alter table questling.inventory add constraint inventory_source_check
--     check (source in ('starter', 'purchase', 'achievement', 'chest', 'demo'));

alter table questling.inventory drop constraint inventory_source_check;
alter table questling.inventory add constraint inventory_source_check
  check (source in ('starter', 'purchase', 'achievement', 'chest', 'story', 'demo'));
