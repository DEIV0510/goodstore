-- ═════════════════════════════════════════════════════════════════════════════
-- GOOD GAME · 0003 · Auditoría
--
-- Deja constancia de quién cambió qué. Se escribe desde disparadores de la
-- propia base de datos, no desde la aplicación: así el registro no se puede
-- saltar aunque alguien llame a la API directamente.
--
-- En las ediciones guarda SOLO los campos que cambiaron, con su valor anterior
-- y el nuevo. Un registro de "se actualizó el producto" sin decir qué cambió no
-- sirve para nada cuando hay que revisar un precio raro tres semanas después.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.gg_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_nombre   text;
  v_accion   text;
  v_id       text;
  v_etiqueta text;
  v_detalle  jsonb := '{}'::jsonb;
  -- Columna que sirve de nombre legible; se pasa al crear el disparador.
  v_campo    text := coalesce(TG_ARGV[0], 'name');
  v_fila     jsonb;
begin
  select coalesce(nullif(name, ''), email) into v_nombre
  from public.profiles where id = v_actor;

  if TG_OP = 'DELETE' then
    v_accion := 'eliminar';
    v_fila   := to_jsonb(old);
  elsif TG_OP = 'INSERT' then
    v_accion := 'crear';
    v_fila   := to_jsonb(new);
  else
    v_accion := 'actualizar';
    v_fila   := to_jsonb(new);
  end if;

  v_id       := coalesce(v_fila ->> 'id', v_fila ->> 'key');
  v_etiqueta := coalesce(nullif(v_fila ->> v_campo, ''), v_fila ->> 'key', '');

  if TG_OP = 'UPDATE' then
    select jsonb_object_agg(
             nuevo.key,
             jsonb_build_object('antes', viejo.value, 'ahora', nuevo.value)
           )
      into v_detalle
    from jsonb_each(to_jsonb(new)) as nuevo
    join jsonb_each(to_jsonb(old)) as viejo on viejo.key = nuevo.key
    where nuevo.value is distinct from viejo.value
      -- Estos cambian solos (vistas de producto, marca de último acceso):
      -- registrarlos llenaría el historial de ruido y escondería los cambios
      -- que sí importan. El acceso se registra aparte, con su propia acción.
      and nuevo.key not in ('updated_at', 'views', 'last_login_at');

    v_detalle := coalesce(v_detalle, '{}'::jsonb);
    if v_detalle = '{}'::jsonb then
      return coalesce(new, old);
    end if;
  end if;

  insert into public.admin_logs
    (actor_id, actor_name, action, entity, entity_id, label, detail)
  values
    (v_actor, coalesce(v_nombre, 'sistema'), v_accion, TG_TABLE_NAME,
     v_id, left(v_etiqueta, 160), v_detalle);

  return coalesce(new, old);
end;
$$;

-- ── Disparadores ─────────────────────────────────────────────────────────────
-- El segundo argumento es la columna que se usa como nombre legible en el
-- historial ("cambió el precio de Elden Ring", no "cambió la fila 3f2a…").
do $$
declare
  fila record;
begin
  for fila in
    select * from (values
      ('products',          'name'),
      ('categories',        'title'),
      ('banners',           'title'),
      ('faq',               'question'),
      ('site_content',      'key'),
      ('settings',          'key'),
      ('whatsapp_settings', 'key'),
      ('orders',            'code'),
      ('customers',         'name'),
      ('profiles',          'email')
    ) as t(tabla, campo)
  loop
    execute format(
      'drop trigger if exists gg_auditoria on public.%I;
       create trigger gg_auditoria
         after insert or update or delete on public.%I
         for each row execute function public.gg_auditar(%L);',
      fila.tabla, fila.tabla, fila.campo);
  end loop;
end;
$$;

-- ── Registro de acceso ───────────────────────────────────────────────────────
-- La aplicación la llama justo después de un inicio de sesión correcto. Deja
-- la marca de "último acceso" y una línea en el historial.
create or replace function public.gg_registrar_acceso()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
     set last_login_at = now()
   where id = auth.uid()
  returning coalesce(nullif(name, ''), email) into v_nombre;

  if v_nombre is null then
    return;
  end if;

  insert into public.admin_logs
    (actor_id, actor_name, action, entity, entity_id, label)
  values
    (auth.uid(), v_nombre, 'acceso', 'sesion', auth.uid()::text, 'Inició sesión');
end;
$$;

revoke all on function public.gg_registrar_acceso() from public;
grant execute on function public.gg_registrar_acceso() to authenticated;
