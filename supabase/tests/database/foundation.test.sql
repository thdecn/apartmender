begin;

select plan(1);

select has_column(
  'auth',
  'users',
  'id',
  'the local Supabase Auth schema is available'
);

select * from finish();

rollback;
