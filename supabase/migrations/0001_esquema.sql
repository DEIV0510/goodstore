-- ═════════════════════════════════════════════════════════════════════════════
-- GOOD GAME · 0001 · Esquema
--
-- Se ejecuta una sola vez, en el editor SQL de Supabase.
-- Crea todas las tablas del negocio. Las políticas de acceso van en 0002 y la
-- auditoría en 0003: así se puede releer cada parte por separado.
--
-- Criterio general:
--   • Los campos que el negocio todavía no confirmó admiten NULL, y la tienda
--     los muestra como "por confirmar" en vez de inventar un valor.
--   • Los precios se guardan como enteros en pesos colombianos (sin decimales),
--     que es como los maneja el negocio.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Perfiles de administrador ────────────────────────────────────────────────
-- Cuelga de auth.users: la contraseña la gestiona Supabase Auth, aquí solo
-- vive el rol y el estado. Nunca se guarda una contraseña en estas tablas.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  name          text not null default '',
  role          text not null default 'editor'
                check (role in ('super_admin', 'admin', 'editor')),
  status        text not null default 'activo'
                check (status in ('activo', 'suspendido')),
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Administradores del panel. El primero que se registra queda como super_admin.';

-- ── Categorías navegables ────────────────────────────────────────────────────
-- Son las tarjetas de "Explora por categoría" de la tienda. No confundir con
-- products.category, que es el TIPO de producto (videojuego / consola / accesorio).
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  subtitle    text not null default '',
  description text not null default '',
  href        text not null default '/catalogo',
  image_url   text,
  -- Portadas reales de productos usadas como imagen de la tarjeta. Se guardan
  -- por SLUG de producto, no por nombre de archivo: así no se rompen cuando se
  -- corrige el nombre de un juego.
  cover_slugs text[] not null default '{}',
  sort_order  integer not null default 0,
  active      boolean not null default true,
  -- Categoría anunciada pero sin inventario confirmado todavía.
  soon        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Productos ────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,

  platform     text not null
               check (platform in ('ps5', 'ps4', 'switch', 'switch2', 'xbox')),
  category     text not null default 'videojuegos'
               check (category in ('videojuegos', 'consolas', 'accesorios')),
  -- NULL cuando no se pudo clasificar el título con certeza.
  genre        text
               check (genre is null or genre in ('accion', 'aventura', 'rpg',
                      'terror', 'deportes', 'carreras', 'familiar',
                      'plataformas', 'lucha')),
  condition    text not null default 'consultar'
               check (condition in ('nuevo', 'usado', 'consultar')),
  region       text
               check (region is null or region in ('america', 'europa', 'japon', 'asia')),

  -- NULL → la tienda muestra "Consultar precio". Nunca se inventa un valor.
  price        integer check (price is null or price >= 0),
  old_price    integer check (old_price is null or old_price >= 0),
  -- NULL → disponibilidad por confirmar. 0 → agotado.
  stock        integer check (stock is null or stock >= 0),
  sku          text,

  images       text[] not null default '{}',
  image_w      integer,
  image_h      integer,

  description  text not null default '',
  -- Aclaración honesta cuando algo del producto no se pudo confirmar.
  note         text,
  tags         text[] not null default '{}',

  featured     boolean not null default false,
  on_sale      boolean not null default false,
  new_release  boolean not null default false,
  best_seller  boolean not null default false,

  -- 'borrador' y 'archivado' no se muestran en la tienda pública.
  status       text not null default 'publicado'
               check (status in ('publicado', 'borrador', 'archivado')),
  sort_index   integer not null default 0,
  views        integer not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_platform_idx on public.products (platform);
create index if not exists products_category_idx on public.products (category);
create index if not exists products_status_idx   on public.products (status);
create index if not exists products_featured_idx on public.products (featured) where featured;
create index if not exists products_name_idx     on public.products using gin (to_tsvector('spanish', name));

-- ── Clientes ─────────────────────────────────────────────────────────────────
-- Solo lo mínimo para atender un pedido. No se guarda nada que el negocio no
-- necesite: sin documento de identidad, sin datos de pago.
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  whatsapp   text not null,
  email      text,
  city       text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (whatsapp)
);

-- ── Pedidos ──────────────────────────────────────────────────────────────────
-- Hoy la venta se cierra por WhatsApp; la tabla queda lista para registrarla.
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  customer_id    uuid references public.customers (id) on delete set null,
  status         text not null default 'pendiente'
                 check (status in ('pendiente', 'confirmado', 'preparando',
                        'enviado', 'entregado', 'cancelado')),
  payment_method text,
  channel        text not null default 'whatsapp',
  subtotal       integer not null default 0,
  shipping       integer not null default 0,
  total          integer not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists orders_status_idx   on public.orders (status);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_created_idx  on public.orders (created_at desc);

-- Se guarda una copia del nombre y el precio del momento de la venta: si el
-- producto cambia de precio después, el pedido histórico no debe cambiar.
create table if not exists public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  product_id         uuid references public.products (id) on delete set null,
  name_snapshot      text not null,
  platform_snapshot  text,
  image_snapshot     text,
  unit_price         integer not null default 0,
  qty                integer not null default 1 check (qty > 0),
  created_at         timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ── Banners promocionales ────────────────────────────────────────────────────
create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text not null default '',
  image_url  text,
  cta_label  text not null default '',
  cta_href   text not null default '/catalogo',
  starts_at  timestamptz,
  ends_at    timestamptz,
  active     boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Preguntas frecuentes ─────────────────────────────────────────────────────
create table if not exists public.faq (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Contenido editable de la tienda ──────────────────────────────────────────
-- Clave → JSON. Guarda el hero, los beneficios y qué secciones se muestran.
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Configuración general ────────────────────────────────────────────────────
-- Empresa, contacto, redes, envíos y SEO. Mismo formato clave → JSON.
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Mensajes de WhatsApp ─────────────────────────────────────────────────────
-- Separado de settings porque el negocio lo edita con mucha más frecuencia.
create table if not exists public.whatsapp_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Auditoría ────────────────────────────────────────────────────────────────
-- Qué administrador cambió qué y cuándo. Se llena sola con los disparadores
-- de 0003; nunca se escribe desde la aplicación.
create table if not exists public.admin_logs (
  id         bigserial primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  actor_name text not null default '',
  action     text not null check (action in ('crear', 'actualizar', 'eliminar', 'acceso')),
  entity     text not null,
  entity_id  text,
  label      text not null default '',
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_logs_created_idx on public.admin_logs (created_at desc);
create index if not exists admin_logs_entity_idx  on public.admin_logs (entity);

-- ── updated_at automático ────────────────────────────────────────────────────
create or replace function public.gg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'categories', 'products', 'customers',
                           'orders', 'banners', 'faq', 'site_content',
                           'settings', 'whatsapp_settings']
  loop
    execute format(
      'drop trigger if exists gg_touch on public.%I;
       create trigger gg_touch before update on public.%I
       for each row execute function public.gg_touch_updated_at();', t, t);
  end loop;
end;
$$;

-- ── Alta automática de perfil ────────────────────────────────────────────────
-- Cuando alguien se registra con Supabase Auth se le crea el perfil. El PRIMER
-- usuario queda como super_admin; los siguientes entran como 'editor' y un
-- super_admin decide si los asciende. Así nunca hay credenciales en el código.
create or replace function public.gg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primero boolean;
begin
  select count(*) = 0 into primero from public.profiles;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when primero then 'super_admin' else 'editor' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists gg_on_auth_user_created on auth.users;
create trigger gg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.gg_handle_new_user();

-- ── Contador de vistas de producto ───────────────────────────────────────────
-- Se llama desde la tienda pública. Es la única escritura que puede hacer un
-- visitante anónimo, y solo incrementa un contador: no puede tocar nada más.
create or replace function public.gg_registrar_vista(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products set views = views + 1 where slug = p_slug;
$$;
