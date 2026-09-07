#!/usr/bin/env python3
"""
Generador de texturas de marca — refranco.ai
Receta aprobada 06-sep-2026 (chat landing): composición F3i-b, paleta T1, grano 0,035.
Uso:
  python tools/texturas/generar.py hero   1440 1600 public/landing/textura-hero-desktop.webp
  python tools/texturas/generar.py hero    900 1600 public/landing/textura-hero-mobile.webp
  python tools/texturas/generar.py cierre 1440 1000 public/landing/textura-cierre-desktop.webp
  python tools/texturas/generar.py cierre  900 1400 public/landing/textura-cierre-mobile.webp
  python tools/texturas/generar.py hero   1200  630 public/landing/og-hero.jpg   # fondo del OG (JPEG, lo lee Satori)
Requiere: numpy, Pillow (`python -m pip install numpy pillow`).
Determinista (seed fija): mismo tamaño → misma imagen. El formato lo decide la extensión de salida
(.webp con QUALITY, .jpg con calidad 88; WebP no lo lee el runtime edge del OG).
No cambiar paleta, grano ni composición sin decisión explícita; sí se puede cambiar tamaño, calidad y formato.
Las texturas generadas se commitean junto con el script: el build de Vercel no corre Python.
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

def field(w, h, seed=7, cells=3):
    r = np.random.default_rng(seed)
    n = r.random((cells, cells))
    img = Image.fromarray((n * 255).astype('uint8')).resize((w, h), Image.BICUBIC)
    img = img.filter(ImageFilter.GaussianBlur(radius=min(w, h) * FIELD_BLUR))
    a = np.asarray(img, dtype=float) / 255
    return (a - a.min()) / (a.max() - a.min())

def colormap(v):
    out = np.zeros(v.shape + (3,))
    for (p0, c0), (p1, c1) in zip(STOPS[:-1], STOPS[1:]):
        m = (v >= p0) & (v <= p1)
        t = ((v - p0) / (p1 - p0))[m][:, None]
        out[m] = hexc(c0) * (1 - t) + hexc(c1) * t
    return out

def render(kind, w, h, out, seed=7):
    bias_fn = COMPOSICION[kind]
    f = field(w, h, seed)
    yy, xx = np.mgrid[0:h, 0:w]
    v = np.clip(f * FIELD_W + bias_fn(xx / w, yy / h) * (1 - FIELD_W * 0.4), 0, 1)
    rgb = colormap(v)
    g = np.random.default_rng(seed).normal(0, 1, (h, w))
    rgb = rgb + (g[:, :, None] * GRAIN * 255)
    img = Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'))
    if out.lower().endswith(('.jpg', '.jpeg')):
        img.save(out, quality=88, optimize=True, progressive=True)
    else:
        img.save(out, quality=QUALITY, method=6)
    print(f'{out}: {w}x{h}')

if __name__ == '__main__':
    kind, w, h, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
    render(kind, w, h, out)
