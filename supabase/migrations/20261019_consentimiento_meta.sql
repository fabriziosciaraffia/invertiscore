-- El consentimiento de cookies (19-oct-2026, src/lib/consentimiento.ts). El último navegador de la cuenta guarda si dijo
-- «si» en el aviso: un evento que sale de un webhook (el pago confirmado) manda a Meta el correo hasheado, el id de la
-- cuenta y las cookies del pixel SOLO si ese navegador aceptó. Lo que ya estaba no tiene elección conocida: false.
alter table public.meta_contexto add column if not exists consentimiento boolean not null default false;
