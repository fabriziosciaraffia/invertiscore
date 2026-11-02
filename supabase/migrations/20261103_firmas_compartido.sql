-- Las firmas de los enlaces compartidos (03-nov-2026, goal «los enlaces compartidos llevan una firma»). Aditiva: una tabla
-- nueva; nada existente cambia.
--
-- Al tocar «Compartir», el servidor firma el enlace de ESE aviso (y de quien comparte, si tiene cuenta: su código de
-- invitación entra en la firma) — src/lib/explorar/firma-compartido.ts. Cada firma emitida deja una fila acá: el tope de
-- 60 por hora por sesión y por IP (src/lib/explorar/firmas-servidor.ts) se cuenta sobre ella, para que nadie las genere en
-- serie. La sesión y la IP van en hash, como en `regalos_alta` (la sesión: la cuenta, o la cookie del dispositivo). La firma
-- no se guarda: se verifica recalculándola. Solo el service role la lee y la escribe (RLS sin políticas, el diseño).
create table if not exists public.firmas_compartido (
  id bigserial primary key,
  creada_at timestamptz not null default now(),
  aviso_id uuid not null,
  sesion_hash text,
  ip_hash text,
  con_cuenta boolean not null default false
);
alter table public.firmas_compartido enable row level security;

-- Los dos conteos del tope: las de esta sesión y las de esta IP en la última hora.
create index if not exists firmas_compartido_sesion on public.firmas_compartido (sesion_hash, creada_at) where sesion_hash is not null;
create index if not exists firmas_compartido_ip on public.firmas_compartido (ip_hash, creada_at) where ip_hash is not null;
