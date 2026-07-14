-- Run this in Supabase SQL Editor (Project: mrnssxulfkacrrgsixnf)

create table if not exists reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id) on delete cascade,
  reviewer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table reviews enable row level security;

-- Anyone can read reviews (needed to show them on the product page)
create policy "Public can read reviews"
  on reviews for select
  using (true);

-- Anyone can submit a review (public review form)
create policy "Public can insert reviews"
  on reviews for insert
  with check (
    rating between 1 and 5
    and length(reviewer_name) between 1 and 60
    and (comment is null or length(comment) <= 1000)
  );

-- No public update or delete — only you (via the dashboard) can remove a review
