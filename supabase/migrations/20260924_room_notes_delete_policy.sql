-- Allow authenticated users to manage (including delete and update) room notes
drop policy if exists "Authenticated users can manage room notes" on public.room_notes;
create policy "Authenticated users can manage room notes"
  on public.room_notes for all to authenticated using (true) with check (true);
