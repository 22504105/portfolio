-- The ledger's two check functions name every table with its schema; fixing their search_path
-- makes sure no other schema can ever stand in for questling (Supabase's linter, rule 0011).
alter function questling.ledger_is_append_only() set search_path = '';
alter function questling.coins_not_negative() set search_path = '';
