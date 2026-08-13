create table if not exists public.db_bot_callback_receipts (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  bot_id_matches boolean not null,
  signature_valid boolean not null,
  event_type text,
  content_type text
);

alter table public.db_bot_callback_receipts enable row level security;

comment on table public.db_bot_callback_receipts is
  'Minimal NAVER WORKS callback diagnostics; excludes message text and user identifiers.';
