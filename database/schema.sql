create extension if not exists pgcrypto;

create table if not exists public.learner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_examples (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learner_profiles(id) on delete cascade,
  title text not null,
  tag text not null default 'My learning',
  code text not null,
  insight text not null default 'Saved by the learner in My learning.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.learner_profiles enable row level security;
alter table public.learning_examples enable row level security;

create policy "Learners can read their own profile"
on public.learner_profiles
for select
using (auth.uid() = id);

create policy "Learners can create their own profile"
on public.learner_profiles
for insert
with check (auth.uid() = id);

create policy "Learners can update their own profile"
on public.learner_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Learners can read their own examples"
on public.learning_examples
for select
using (auth.uid() = learner_id);

create policy "Learners can create their own examples"
on public.learning_examples
for insert
with check (auth.uid() = learner_id);

create policy "Learners can update their own examples"
on public.learning_examples
for update
using (auth.uid() = learner_id)
with check (auth.uid() = learner_id);

create policy "Learners can delete their own examples"
on public.learning_examples
for delete
using (auth.uid() = learner_id);

create index if not exists learning_examples_learner_updated_idx
on public.learning_examples (learner_id, updated_at desc);
