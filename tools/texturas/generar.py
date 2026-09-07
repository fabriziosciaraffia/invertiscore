#!/usr/bin/env python3
"""
Generador de texturas de marca — refranco.ai
Receta aprobada 06-sep-2026 (chat landing): composición F3i-b, paleta T1, grano 0,035.
Regla de composición v2 (QA de Fabrizio, 07-sep-2026): el rojo ocupa una ALTURA FIJA
medida desde abajo (`rojo`, en px de la imagen), no una proporción del lienzo. Sobre el
bloque rojo la rampa sigue hasta papel en RAMPA × rojo (1,3 desde FASE 1.5; 0,6 = rojo pleno); lo que quede
más arriba es papel liso #FAFAF8 puro y SIN grano (v2.1), que es el fondo de la página, así la
imagen se puede recortar por arriba sin costura; el CSS además la enmascara en el borde superior. En CSS la banda se sirve con altura fija en vh y `object-fit:
cover` anclado abajo: hero 62,5 svh (rojo = 30 vh), cierre 104 svh (rojo = 50 vh), con un 20 % de papel puro arriba.

Uso:
  python tools/texturas/generar.py banda ANCHO ALTO ROJO salida.webp
  # set de la landing (2x/3x, servido por <picture> + srcset, nada se estira). El alto es
  # 1,25 × RAMPA × ROJO: el 20 % superior queda de papel puro, que es lo que la máscara CSS
  # del borde (18 %) funde con el fondo. En CSS la banda mide 1,25 × (rojo + rampa) en vh.
  # Mobile (rampa 1,3, onda v1): hero 30 vh de rojo → 48,75 svh; cierre 50 vh → 81,25 svh.
  #   python tools/texturas/generar.py banda 1200  975  600 public/landing/textura-hero-m2x.webp
  #   python tools/texturas/generar.py banda 1800 1463  900 public/landing/textura-hero-m3x.webp
  #   python tools/texturas/generar.py banda 1200 1463  900 public/landing/textura-cierre-m2x.webp
  # PC (v2.4, FASE 1.6): casi sin rojo pleno, lo que se ve es la rampa; onda 0,22 relativa
  # al ancho. Hero: 10 vh de rojo + 40 de rampa (factor 5,0) → banda 62,5 svh. Cierre: 22 vh
  # + 40 (factor 2,8182) → banda 77,5 svh.
  #   python tools/texturas/generar.py banda 3000 1375  220 public/landing/textura-hero-d2x.webp 5.0 0.22
  #   python tools/texturas/generar.py banda 3000 1691  480 public/landing/textura-cierre-d2x.webp 2.8182 0.22
  python tools/texturas/generar.py banda 1200  630  190 public/landing/og-hero.jpg   # OG (JPEG: Satori no lee WebP)
  # receta v1 (proporción del lienzo), por si hace falta reproducirla:
  python tools/texturas/generar.py hero 1440 1600 salida.webp · cierre 1440 1000 salida.webp
Requiere: numpy, Pillow (`python -m pip install numpy pillow`).
Determinista (seed fija): mismo tamaño → misma imagen. El formato lo decide la extensión
(.webp con QUALITY, .jpg con calidad 88).
No cambiar paleta, grano ni composición sin decisión explícita; sí se puede cambiar tamaño,
calidad y formato. Las texturas generadas se commitean junto con el script: el build de
Vercel no corre Python.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

# --- Paleta T1: papel → Signal Red → rojo profundo (hex del design system) ---
STOPS = [(0.00, '#FAFAF8'), (0.30, '#F3D6D7'), (0.60, '#E08A90'), (0.85, '#C8323C'), (1.00, '#9A2630')]
GRAIN = 0.035     # desviación del grano (0..1 sobre 255). Aprobado: 0,035
FIELD_W = 0.18    # peso de la ondulación orgánica. Aprobado: 0,18 (receta S2)
FIELD_BLUR = 0.45 # difuminado relativo al lado menor. Aprobado: 0,45
QUALITY = 72      # WebP. Subir a 80 solo si el banding se nota en degradados largos

# --- Composición: cuánto sube el rojo desde abajo (y = 0 arriba, 1 abajo) ---
COMPOSICION = {
    'hero':   lambda x, y: np.clip(2.2 * y - 1.1, 0, 1),   # F3i-b: rojo solo en el tercio inferior
    'cierre': lambda x, y: np.clip(1.6 * y - 0.35, 0, 1),  # F3i: rojo desde la mitad
}

def hexc(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)

def field(w, h, seed=7, cells=3, ref='min'):
    """Ondulación orgánica. `ref='min'`: difuminado relativo al lado menor (receta v1,
    mobile). `ref='w'` (v2.4, PC): relativo al ANCHO, así la onda recorre la imagen a lo
    largo y la transición no queda como una recta horizontal."""
    r = np.random.default_rng(seed)
    n = r.random((cells, cells))
    img = Image.fromarray((n * 255).astype('uint8')).resize((w, h), Image.BICUBIC)
    base = w if ref == 'w' else min(w, h)
    img = img.filter(ImageFilter.GaussianBlur(radius=base * FIELD_BLUR))
    a = np.asarray(img, dtype=float) / 255
    return (a - a.min()) / (a.max() - a.min())

def colormap(v):
    out = np.zeros(v.shape + (3,))
    for (p0, c0), (p1, c1) in zip(STOPS[:-1], STOPS[1:]):
        m = (v >= p0) & (v <= p1)
        t = ((v - p0) / (p1 - p0))[m][:, None]
        out[m] = hexc(c0) * (1 - t) + hexc(c1) * t
    return out

RAMPA = 1.3  # v2.2: el papel llega a RAMPA × rojo. Se puede pasar otra por línea de comando,
             # pero la landing usa 1,3 en todos los tramos (la rampa larga se descartó en QA)

def bias_banda(h, rojo, rampa=RAMPA):
    """v2.2: rampa desde abajo, en dos tramos. v = 1 en el borde inferior y 0,6 (rojo
    pleno) a `rojo` px; de ahí baja a 0 (papel) en `rampa` × rojo; más arriba, papel liso."""
    def fn(x, y):
        d = (1 - y) * h                      # px desde abajo
        t = d / rojo
        v = np.where(t <= 1, 1 - 0.4 * t, 0.6 * (rampa - t) / (rampa - 1))
        return np.clip(v, 0, 1)
    return fn

def render(kind, w, h, out, seed=7, rojo=None, rampa=RAMPA, field_w=FIELD_W, field_ref='min'):
    bias_fn = bias_banda(h, rojo, rampa) if kind == 'banda' else COMPOSICION[kind]
    f = field(w, h, seed, ref=field_ref)
    yy, xx = np.mgrid[0:h, 0:w]
    b = bias_fn(xx / w, yy / h)
    if kind == 'banda':
        # el campo orgánico entra CON la rampa (pleno en su primer 12 %): si entrara de
        # golpe donde bias > 0 dejaría un escalón de hasta 0,18 justo en el borde del
        # papel, que es la costura que se veía (QA 07-sep).
        f = f * np.clip(b / 0.12, 0, 1)
    v = np.clip(f * field_w + b * (1 - field_w * 0.4), 0, 1)
    rgb = colormap(v)
    g = np.random.default_rng(seed).normal(0, 1, (h, w))
    if kind == 'banda':
        # v2.1 (costura, QA 07-sep): el tramo superior es #FAFAF8 PURO, sin grano — el
        # grano de página lo pone la capa CSS y el empalme con el fondo tiene que ser
        # invisible. El grano entra con la rampa (sube a pleno en el primer 12 % de ella).
        g = g * np.clip(b / 0.12, 0, 1)
    rgb = rgb + (g[:, :, None] * GRAIN * 255)
    img = Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'))
    if out.lower().endswith(('.jpg', '.jpeg')):
        img.save(out, quality=88, optimize=True, progressive=True)
    else:
        img.save(out, quality=QUALITY, method=6)
    print(f'{out}: {w}x{h}')

if __name__ == '__main__':
    kind = sys.argv[1]
    if kind == 'banda':
        w, h, rojo, out = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
        rampa = float(sys.argv[6]) if len(sys.argv) > 6 else RAMPA
        # PC (v2.4): peso de la onda 0,22 y difuminado relativo al ancho
        field_w = float(sys.argv[7]) if len(sys.argv) > 7 else FIELD_W
        ref = 'w' if len(sys.argv) > 7 else 'min'
        render(kind, w, h, out, rojo=rojo, rampa=rampa, field_w=field_w, field_ref=ref)
    else:
        w, h, out = int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
        render(kind, w, h, out)
