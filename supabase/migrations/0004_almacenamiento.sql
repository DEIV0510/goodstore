-- ═════════════════════════════════════════════════════════════════════════════
-- GOOD GAME · 0004 · Almacenamiento de imágenes
--
-- Las fotos NO se guardan dentro de la base de datos: van al almacenamiento de
-- Supabase y en las tablas queda solo la URL. Meter imágenes en la base la
-- vuelve lenta, cara de respaldar y difícil de servir con caché.
--
-- Carpetas dentro del depósito:
--   productos/    portadas de los juegos
--   categorias/   imágenes de las tarjetas de categoría
--   banners/      banners promocionales
--   marca/        logo y recursos de identidad
-- ═════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gg-media',
  'gg-media',
  true,                               -- lectura pública: son imágenes de tienda
  5242880,                            -- 5 MB por archivo
  array['image/webp', 'image/png', 'image/jpeg', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gg_media_lectura on storage.objects;
drop policy if exists gg_media_subir   on storage.objects;
drop policy if exists gg_media_editar  on storage.objects;
drop policy if exists gg_media_borrar  on storage.objects;

-- Cualquiera puede VER las imágenes: es una tienda, las portadas son públicas.
create policy gg_media_lectura on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'gg-media');

-- Solo el personal del panel puede subir o reemplazar.
create policy gg_media_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gg-media' and public.gg_es_staff());

create policy gg_media_editar on storage.objects
  for update to authenticated
  using (bucket_id = 'gg-media' and public.gg_es_staff())
  with check (bucket_id = 'gg-media' and public.gg_es_staff());

-- Borrar un archivo es destructivo: se reserva a admin y super_admin.
create policy gg_media_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'gg-media' and public.gg_es_admin());
