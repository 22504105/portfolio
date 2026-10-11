-- Trigger functions are run by their triggers, never called. PostgreSQL lets
-- everyone execute a new function by default; take that away, so the list of
-- what the API roles may call is exactly the list of what they are meant to.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.limit_import_batches() from public, anon, authenticated;
revoke all on function public.check_workspace_timezone() from public, anon, authenticated;
