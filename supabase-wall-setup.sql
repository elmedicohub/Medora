-- Motivea / Medora Wall backend
-- Run once in Supabase SQL Editor.
-- Designed for project eoitruybmrgsrnbyioze.
-- RLS is enabled on every exposed table.

begin;

create table if not exists public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 3000),
  post_type text not null default 'update'
    check (post_type in ('update','goal','achievement','question')),
  visibility text not null default 'public'
    check (visibility in ('public','connections','circle','private')),
  circle_id uuid null references public.circles(id) on delete set null,
  goal_id uuid null references public.goals(id) on delete set null,
  achievement_id uuid null references public.achievements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wall_circle_visibility_consistency
    check (
      (visibility = 'circle' and circle_id is not null)
      or
      (visibility <> 'circle' and circle_id is null)
    )
);

create table if not exists public.wall_reactions (
  post_id uuid not null references public.wall_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'support' check (reaction in ('support')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.wall_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wall_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wall_posts_created_at_idx
  on public.wall_posts (created_at desc);

create index if not exists wall_posts_user_id_created_at_idx
  on public.wall_posts (user_id, created_at desc);

create index if not exists wall_posts_circle_id_idx
  on public.wall_posts (circle_id)
  where circle_id is not null;

create index if not exists wall_comments_post_id_created_at_idx
  on public.wall_comments (post_id, created_at);

alter table public.wall_posts enable row level security;
alter table public.wall_reactions enable row level security;
alter table public.wall_comments enable row level security;

grant select, insert, update, delete on public.wall_posts to authenticated;
grant select, insert, update, delete on public.wall_reactions to authenticated;
grant select, insert, update, delete on public.wall_comments to authenticated;

drop policy if exists wall_posts_select_visible on public.wall_posts;
create policy wall_posts_select_visible
on public.wall_posts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or visibility = 'public'
  or (
    visibility = 'connections'
    and exists (
      select 1
      from public.connections c
      where c.status::text = 'accepted'
        and (
          (c.requester_id = wall_posts.user_id and c.addressee_id = (select auth.uid()))
          or
          (c.addressee_id = wall_posts.user_id and c.requester_id = (select auth.uid()))
        )
    )
  )
  or (
    visibility = 'circle'
    and circle_id is not null
    and (
      exists (
        select 1
        from public.circles ci
        where ci.id = wall_posts.circle_id
          and ci.owner_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = wall_posts.circle_id
          and cm.user_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists wall_posts_insert_self on public.wall_posts;
create policy wall_posts_insert_self
on public.wall_posts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    visibility <> 'circle'
    or (
      circle_id is not null
      and (
        exists (
          select 1 from public.circles ci
          where ci.id = circle_id and ci.owner_id = (select auth.uid())
        )
        or exists (
          select 1 from public.circle_members cm
          where cm.circle_id = circle_id and cm.user_id = (select auth.uid())
        )
      )
    )
  )
  and (
    goal_id is null
    or exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
  )
  and (
    achievement_id is null
    or exists (
      select 1 from public.achievements a
      where a.id = achievement_id and a.user_id = (select auth.uid())
    )
  )
);

drop policy if exists wall_posts_update_self on public.wall_posts;
create policy wall_posts_update_self
on public.wall_posts
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists wall_posts_delete_self on public.wall_posts;
create policy wall_posts_delete_self
on public.wall_posts
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists wall_reactions_select_visible_post on public.wall_reactions;
create policy wall_reactions_select_visible_post
on public.wall_reactions
for select
to authenticated
using (
  exists (
    select 1 from public.wall_posts p
    where p.id = wall_reactions.post_id
  )
);

drop policy if exists wall_reactions_insert_self on public.wall_reactions;
create policy wall_reactions_insert_self
on public.wall_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.wall_posts p
    where p.id = wall_reactions.post_id
  )
);

drop policy if exists wall_reactions_delete_self on public.wall_reactions;
create policy wall_reactions_delete_self
on public.wall_reactions
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists wall_comments_select_visible_post on public.wall_comments;
create policy wall_comments_select_visible_post
on public.wall_comments
for select
to authenticated
using (
  exists (
    select 1 from public.wall_posts p
    where p.id = wall_comments.post_id
  )
);

drop policy if exists wall_comments_insert_self on public.wall_comments;
create policy wall_comments_insert_self
on public.wall_comments
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.wall_posts p
    where p.id = wall_comments.post_id
  )
);

drop policy if exists wall_comments_update_self on public.wall_comments;
create policy wall_comments_update_self
on public.wall_comments
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists wall_comments_delete_self on public.wall_comments;
create policy wall_comments_delete_self
on public.wall_comments
for delete
to authenticated
using (user_id = (select auth.uid()));

commit;
