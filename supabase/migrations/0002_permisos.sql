-- ═════════════════════════════════════════════════════════════════════════════
-- GOOD GAME · 0002 · Permisos (Row Level Security)
--
-- Esta es la seguridad REAL del panel. Ocultar botones en la interfaz no
-- protege nada: cualquiera puede lanzar la petición desde el navegador. Aquí
-- la base de datos rechaza por sí misma lo que el rol no puede hacer.
--
-- Escalera de roles:
--   editor      → crea y edita productos, categorías, banners, FAQ y contenido.
--                 NO puede borrar, ni ver pedidos/clientes, ni tocar ajustes.
--   admin       → todo lo de editor, más borrar, pedidos y clientes.
--                 NO puede tocar ajustes ni administrar usuarios.
--   super_admin → todo, incluidos ajustes y alta/baja de administradores.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Funciones de rol ─────────────────────────────────────────────────────────
-- SECURITY DEFINER para poder leer profiles sin caer en recursión de políticas.

create or replace function public.gg_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid() and status = 'activo'
$$;

create or replace function public.gg_es_super()
returns boolean language sql stable
as $$ select coalesce(public.gg_role() = 'super_admin', false) $$;

/** admin o super_admin: gestión del negocio (pedidos, clientes, borrados). */
create or replace function public.gg_es_admin()
returns boolean language sql stable
as $$ select coalesce(public.gg_role() in ('super_admin', 'admin'), false) $$;

/** cualquier rol activo: puede crear y editar catálogo y contenido. */
create or replace function public.gg_es_staff()
returns boolean language sql stable
as $$ select coalesce(public.gg_role() in ('super_admin', 'admin', 'editor'), false) $$;

-- ── Activar RLS en todo ──────────────────────────────────────────────────────
-- Sin esto las tablas quedarían abiertas con la clave anónima.
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.customers         enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.banners           enable row level security;
alter table public.faq               enable row level security;
alter table public.site_content      enable row level security;
alter table public.settings          enable row level security;
alter table public.whatsapp_settings enable row level security;
alter table public.admin_logs        enable row level security;

-- Limpieza para poder reejecutar el archivo sin errores.
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','categories','products','customers','orders',
                        'order_items','banners','faq','site_content','settings',
                        'whatsapp_settings','admin_logs')
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end;
$$;

-- ── PERFILES ─────────────────────────────────────────────────────────────────
-- Cada quien ve su propio perfil; los administradores ven a todos.
create policy perfil_propio_lectura on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.gg_es_admin());

-- Un usuario puede corregir su nombre, pero NO su rol ni su estado: si pudiera,
-- un editor se ascendería a super_admin desde la consola del navegador.
create policy perfil_propio_edicion on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
  );

create policy perfil_super_todo on public.profiles
  for all to authenticated
  using (public.gg_es_super())
  with check (public.gg_es_super());

-- ── PRODUCTOS ────────────────────────────────────────────────────────────────
-- La tienda pública solo ve lo publicado. Los borradores son invisibles fuera
-- del panel, aunque alguien adivine la URL.
create policy productos_publicos on public.products
  for select to anon, authenticated
  using (status = 'publicado' or public.gg_es_staff());

create policy productos_crear on public.products
  for insert to authenticated with check (public.gg_es_staff());

create policy productos_editar on public.products
  for update to authenticated
  using (public.gg_es_staff()) with check (public.gg_es_staff());

create policy productos_borrar on public.products
  for delete to authenticated using (public.gg_es_admin());

-- ── CATEGORÍAS ───────────────────────────────────────────────────────────────
create policy categorias_publicas on public.categories
  for select to anon, authenticated
  using (active or public.gg_es_staff());

create policy categorias_crear on public.categories
  for insert to authenticated with check (public.gg_es_staff());

create policy categorias_editar on public.categories
  for update to authenticated
  using (public.gg_es_staff()) with check (public.gg_es_staff());

create policy categorias_borrar on public.categories
  for delete to authenticated using (public.gg_es_admin());

-- ── BANNERS ──────────────────────────────────────────────────────────────────
-- Fuera de su ventana de fechas, el banner deja de ser visible sin que nadie
-- tenga que apagarlo a mano.
create policy banners_publicos on public.banners
  for select to anon, authenticated
  using (
    public.gg_es_staff()
    or (
      active
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now())
    )
  );

create policy banners_crear on public.banners
  for insert to authenticated with check (public.gg_es_staff());

create policy banners_editar on public.banners
  for update to authenticated
  using (public.gg_es_staff()) with check (public.gg_es_staff());

create policy banners_borrar on public.banners
  for delete to authenticated using (public.gg_es_admin());

-- ── FAQ ──────────────────────────────────────────────────────────────────────
create policy faq_publica on public.faq
  for select to anon, authenticated
  using (active or public.gg_es_staff());

create policy faq_crear on public.faq
  for insert to authenticated with check (public.gg_es_staff());

create policy faq_editar on public.faq
  for update to authenticated
  using (public.gg_es_staff()) with check (public.gg_es_staff());

create policy faq_borrar on public.faq
  for delete to authenticated using (public.gg_es_admin());

-- ── CONTENIDO DE LA TIENDA ───────────────────────────────────────────────────
create policy contenido_publico on public.site_content
  for select to anon, authenticated using (true);

create policy contenido_escribir on public.site_content
  for all to authenticated
  using (public.gg_es_staff()) with check (public.gg_es_staff());

-- ── AJUSTES ──────────────────────────────────────────────────────────────────
-- Son de lectura pública porque contienen los datos que la tienda muestra
-- (nombre, ciudad, redes, SEO). Nada sensible vive aquí: las claves de
-- servicio son de Supabase y nunca llegan al navegador.
create policy ajustes_publicos on public.settings
  for select to anon, authenticated using (true);

create policy ajustes_escribir on public.settings
  for all to authenticated
  using (public.gg_es_super()) with check (public.gg_es_super());

create policy whatsapp_publico on public.whatsapp_settings
  for select to anon, authenticated using (true);

create policy whatsapp_escribir on public.whatsapp_settings
  for all to authenticated
  using (public.gg_es_admin()) with check (public.gg_es_admin());

-- ── CLIENTES Y PEDIDOS ───────────────────────────────────────────────────────
-- Datos personales: NUNCA visibles con la clave anónima.
create policy clientes_admin on public.customers
  for all to authenticated
  using (public.gg_es_admin()) with check (public.gg_es_admin());

create policy pedidos_admin on public.orders
  for all to authenticated
  using (public.gg_es_admin()) with check (public.gg_es_admin());

create policy pedido_items_admin on public.order_items
  for all to authenticated
  using (public.gg_es_admin()) with check (public.gg_es_admin());

-- ── AUDITORÍA ────────────────────────────────────────────────────────────────
-- Se lee desde el panel; se escribe SOLO desde los disparadores de 0003.
-- Nadie puede insertar, editar ni borrar registros: si se pudiera, el
-- historial no serviría para nada.
create policy auditoria_leer on public.admin_logs
  for select to authenticated using (public.gg_es_admin());

-- ── Permisos de ejecución ────────────────────────────────────────────────────
revoke all on function public.gg_registrar_vista(text) from public;
grant execute on function public.gg_registrar_vista(text) to anon, authenticated;
