#!/usr/bin/env python3
"""
Generador de texturas de marca — refranco.ai

RECETA VIGENTE (v3, FASE 1.7 · 07-sep-2026): `hero` — fondo completo del hero y del cierre.
  Escala A1:  #16264A 0% · #1D3A6B 40% · #4A2E44 62% · #7A1F27 80% · #C8323C 94% · #E8626B 100%
              (la tríada nueva del informe: azul tinta COMPRAR, ciruela AJUSTAR, Signal Red BUSCAR OTRO).
  Composición diagonal: peso Y 0,35 · X 0,65 (oscuro arriba a la izquierda, rojo abajo a la derecha),
              con el campo orgánico (FIELD_W, difuminado relativo al ancho).
  Grano:      gaussiano monocromo σ = 0,06 (ruido aleatorio, no patrón: sin moiré). Con el grano
              completo el WebP de mobile 2x pesa 438 KB (tope ~250), así que la landing usa
              `--sin-grano`: el fondo lleva solo un grano-dither de σ = 0,02 a calidad 80 (117 KB a
              780×1688, 292 tonos en el tramo azul → ciruela contra 68 con dither de ±0,5 LSB, que
              el WebP se comía y bandeaba) y el grano visible lo pone el CSS con el tile
              `grano-256.png` (σ 0,06, opacity ~.08, soft-light).
  Bloom (S1): máscara = ((luminancia − 0,45) / 0,55)², difuminada con radio 28 px a 760 px de ancho
              (escala con el ancho), sumada con factor 70/255.
  Cada variante se genera a su resolución final (m1x/m2x/m3x, d1x/d2x): nunca se escala una
  textura ya generada. WebP calidad 82.

Uso:
  python tools/texturas/generar.py hero ANCHO ALTO salida.webp [--sin-grano] [--invertir]
  python tools/texturas/generar.py grano-tile public/landing/grano-256.png
  # set de la landing:
  #   hero  m1x 390×844 · m2x 780×1688 · m3x 1170×2532 · d1x 1440×900 · d2x 2880×1800
  #   cierre: mismo set con la misma receta (misma dirección; `--invertir` da el recorrido al revés)
  #   og: python tools/texturas/generar.py hero 1200 630 public/landing/og-hero.jpg --sin-grano

Recetas anteriores, para reproducirlas: `banda W H ROJO salida [RAMPA] [FIELD_W]` (v2, papel →
rojo desde abajo) y `hero-v1` / `cierre-v1` (v1, proporción del lienzo). Ya no se usan en la página.

Requiere: numpy, Pillow (`python -m pip install numpy pillow`). Determinista (seed fija).
No cambiar paleta, grano ni composición sin decisión explícita; sí se puede cambiar tamaño,
calidad y formato. Las texturas generadas se commitean junto con el script: el build de Vercel
no corre Python.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

# ── receta v3 ────────────────────────────────────────────────────────────────
A1 = [(0.00, '#16264A'), (0.40, '#1D3A6B'), (0.62, '#4A2E44'), (0.80, '#7A1F27'), (0.94, '#C8323C'), (1.00, '#E8626B')]
PESO_X, PESO_Y = 0.65, 0.35
GRANO_V3 = 0.06        # σ del grano gaussiano (0..1 sobre 255)
BLOOM_UMBRAL = 0.45    # máscara = ((lum − umbral) / (1 − umbral))²
BLOOM_RADIO_760 = 28   # px a 760 px de ancho
BLOOM_FACTOR = 70      # /255, sumado
CALIDAD_V3 = 82
GRANO_DITHER = 0.02    # `--sin-grano`: σ del grano-dither (mata el banding sin pesar)
CALIDAD_DITHER = 80

# ── receta v1/v2 (paleta T1 papel → rojo) ─────────────────────────────────────
STOPS = [(0.00, '#FAFAF8'), (0.30, '#F3D6D7'), (0.60, '#E08A90'), (0.85, '#C8323C'), (1.00, '#9A2630')]
GRAIN = 0.035
FIELD_W = 0.18    # peso de la ondulación orgánica
FIELD_BLUR = 0.45 # difuminado relativo (al ancho en v3, al lado menor en v1)
QUALITY = 72
RAMPA = 1.3

COMPOSICION = {
    'hero-v1':   lambda x, y: np.clip(2.2 * y - 1.1, 0, 1),
    'cierre-v1': lambda x, y: np.clip(1.6 * y - 0.35, 0, 1),
}


def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)


def field(w, h, seed=7, cells=3, ref='min'):
    """Ondulación orgánica. `ref='w'`: difuminado relativo al ancho (la onda recorre la
    imagen a lo largo); `ref='min'`: relativo al lado menor (receta v1)."""
    r = np.random.default_rng(seed)
    n = r.random((cells, cells))
    img = Image.fromarray((n * 255).astype('uint8')).resize((w, h), Image.BICUBIC)
    base = w if ref == 'w' else min(w, h)
    img = img.filter(ImageFilter.GaussianBlur(radius=base * FIELD_BLUR))
    a = np.asarray(img, dtype=float) / 255
    return (a - a.min()) / (a.max() - a.min())


def colormap(v, stops):
    out = np.zeros(v.shape + (3,))
    for (p0, c0), (p1, c1) in zip(stops[:-1], stops[1:]):
        m = (v >= p0) & (v <= p1)
        t = ((v - p0) / (p1 - p0))[m][:, None]
        out[m] = hexc(c0) * (1 - t) + hexc(c1) * t
    return out


def guardar(rgb, out, calidad):
    img = Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'))
    if out.lower().endswith(('.jpg', '.jpeg')):
        img.save(out, quality=88, optimize=True, progressive=True)
    elif out.lower().endswith('.png'):
        img.save(out, optimize=True)
    else:
        img.save(out, quality=calidad, method=6)


def render_hero(w, h, out, seed=7, grano=True, invertir=False, field_w=FIELD_W):
    """Receta v3 (ver cabecera)."""
    f = field(w, h, seed, ref='w')
    yy, xx = np.mgrid[0:h, 0:w]
    bias = PESO_X * (xx / (w - 1)) + PESO_Y * (yy / (h - 1))
    if invertir:
        bias = 1 - bias
    v = np.clip(f * field_w + bias * (1 - field_w * 0.4), 0, 1)
    rgb = colormap(v, A1)
    # bloom en las luces (S1)
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]) / 255
    mask = np.clip((lum - BLOOM_UMBRAL) / (1 - BLOOM_UMBRAL), 0, 1) ** 2
    radio = BLOOM_RADIO_760 * w / 760
    bloom = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(radius=radio))
    bloom = np.asarray(bloom, dtype=float) / 255
    rgb = rgb + bloom[:, :, None] * BLOOM_FACTOR
    rng = np.random.default_rng(seed)
    sigma = GRANO_V3 if grano else GRANO_DITHER
    rgb = rgb + rng.normal(0, 1, (h, w))[:, :, None] * sigma * 255
    guardar(rgb, out, CALIDAD_V3 if grano else CALIDAD_DITHER)
    print(f'{out}: {w}x{h} · grano={"0,06" if grano else "dither 0,02"} · invertido={invertir}')


def grano_tile(out, tam=256, seed=11):
    """Tile de grano para el CSS (soft-light, opacity ~.08): gris medio + N(0, σ 0,06)."""
    rng = np.random.default_rng(seed)
    g = 128 + rng.normal(0, 1, (tam, tam)) * GRANO_V3 * 255
    Image.fromarray(np.clip(g, 0, 255).astype('uint8'), mode='L').save(out, optimize=True)
    print(f'{out}: {tam}x{tam}')


# ── recetas anteriores ───────────────────────────────────────────────────────
def bias_banda(h, rojo, rampa=RAMPA):
    def fn(x, y):
        d = (1 - y) * h
        t = d / rojo
        v = np.where(t <= 1, 1 - 0.4 * t, 0.6 * (rampa - t) / (rampa - 1))
        return np.clip(v, 0, 1)
    return fn


def render_legacy(kind, w, h, out, seed=7, rojo=None, rampa=RAMPA, field_w=FIELD_W, field_ref='min'):
    bias_fn = bias_banda(h, rojo, rampa) if kind == 'banda' else COMPOSICION[kind]
    f = field(w, h, seed, ref=field_ref)
    yy, xx = np.mgrid[0:h, 0:w]
    b = bias_fn(xx / w, yy / h)
    if kind == 'banda':
        f = f * np.clip(b / 0.12, 0, 1)
    v = np.clip(f * field_w + b * (1 - field_w * 0.4), 0, 1)
    if kind == 'banda':
        v = np.where(b > 0, v, 0)
    rgb = colormap(v, STOPS)
    g = np.random.default_rng(seed).normal(0, 1, (h, w))
    if kind == 'banda':
        g = g * np.clip(b / 0.12, 0, 1)
    rgb = rgb + (g[:, :, None] * GRAIN * 255)
    guardar(rgb, out, QUALITY)
    print(f'{out}: {w}x{h}')


if __name__ == '__main__':
    kind = sys.argv[1]
    if kind == 'hero':
        w, h, out = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
        flags = set(sys.argv[5:])
        render_hero(w, h, out, grano='--sin-grano' not in flags, invertir='--invertir' in flags)
    elif kind == 'grano-tile':
        grano_tile(sys.argv[2])
    elif kind == 'banda':
        w, h, rojo, out = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
        rampa = float(sys.argv[6]) if len(sys.argv) > 6 else RAMPA
        field_w = float(sys.argv[7]) if len(sys.argv) > 7 else FIELD_W
        render_legacy(kind, w, h, out, rojo=rojo, rampa=rampa, field_w=field_w, field_ref='w' if len(sys.argv) > 7 else 'min')
    else:
        w, h, out = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
        render_legacy(kind, w, h, out)
