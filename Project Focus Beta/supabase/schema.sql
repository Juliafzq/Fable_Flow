-- =============================================================================
-- Fable / Flow — Phase 3 Supabase Schema & Row-Level Security (RLS)
-- Free Tier ($0/mo): Supports up to 50,000 MAUs, 500 MB Postgres DB, 1 GB Storage
-- Instructions: Paste into Supabase Dashboard -> SQL Editor -> Run
-- =============================================================================

create table if not exists public.fable_flow_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable Row-Level Security so each user can only access their own cards & timers
alter table public.fable_flow_user_state enable row level security;

drop policy if exists "Users can read own state" on public.fable_flow_user_state;
create policy "Users can read own state"
  on public.fable_flow_user_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own state" on public.fable_flow_user_state;
create policy "Users can insert own state"
  on public.fable_flow_user_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own state" on public.fable_flow_user_state;
create policy "Users can update own state"
  on public.fable_flow_user_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own state" on public.fable_flow_user_state;
create policy "Users can delete own state"
  on public.fable_flow_user_state
  for delete
  using (auth.uid() = user_id);
