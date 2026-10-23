#!/usr/bin/env python3
"""Generates the illustrative placeholder artwork in public/assets/seed/.
Replace these from the CMS with your real photographs. Re-run: python3 scripts/make-seed-art.py"""
import math, os, random

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "seed")
os.makedirs(OUT, exist_ok=True)

def write(name, svg):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg)

# ---------- motifs: return <pattern> definitions ----------
def pattern(pid, kind, fg, bg, size=44, op=1):
    s = size
    c = s / 2
    if kind == "buti":  # small flower
        petals = "".join(
            f'<ellipse cx="{c}" cy="{c-s*0.2}" rx="{s*0.08}" ry="{s*0.16}" transform="rotate({a} {c} {c})"/>'
            for a in range(0, 360, 45))
        body = f'<g fill="{fg}">{petals}<circle cx="{c}" cy="{c}" r="{s*0.07}" fill="{bg}"/></g>'
    elif kind == "paisley":
        body = (f'<g fill="{fg}"><path d="M{c} {s*0.15} C{s*0.85} {s*0.3} {s*0.8} {s*0.8} {c} {s*0.85} '
                f'C{s*0.2} {s*0.8} {s*0.25} {s*0.45} {c} {s*0.4} C{s*0.42} {s*0.45} {s*0.45} {s*0.65} {c} {s*0.65} '
                f'C{s*0.62} {s*0.62} {s*0.65} {s*0.35} {c} {s*0.15}Z"/></g>')
    elif kind == "jaali":
        body = (f'<path d="M0 {c} L{c} 0 L{s} {c} L{c} {s}Z" fill="none" stroke="{fg}" stroke-width="1.6"/>'
                f'<circle cx="{c}" cy="{c}" r="{s*0.06}" fill="{fg}"/>')
    elif kind == "stripe":
        body = (f'<rect x="0" y="0" width="{s*0.14}" height="{s}" fill="{fg}"/>'
                f'<circle cx="{s*0.62}" cy="{c}" r="{s*0.06}" fill="{fg}"/>')
    elif kind == "lotus":
        petals = "".join(
            f'<path d="M{c} {c} Q{c-s*0.13} {c-s*0.2} {c} {c-s*0.36} Q{c+s*0.13} {c-s*0.2} {c} {c}Z" transform="rotate({a} {c} {c})"/>'
            for a in range(0, 360, 60))
        body = f'<g fill="{fg}">{petals}</g>'
    else:  # dots (dabu)
        body = "".join(f'<circle cx="{x}" cy="{y}" r="{s*0.07}" fill="{fg}"/>' for x, y in
                       [(s*0.25, s*0.25), (s*0.75, s*0.25), (s*0.25, s*0.75), (s*0.75, s*0.75), (c, c)])
    return (f'<pattern id="{pid}" width="{s}" height="{s}" patternUnits="userSpaceOnUse" opacity="{op}">'
            f'<rect width="{s}" height="{s}" fill="{bg}"/>{body}</pattern>')

def arch_path(x, y, w, h):
    r = w / 2
    return f"M{x} {y+h} V{y+r} A{r} {r} 0 0 1 {x+w} {y+r} V{y+h} Z"

# ---------- kurta silhouettes (viewBox 600x800) ----------
def kurta_path(style):
    if style == "anarkali":
        return ("M235 150 Q300 190 365 150 L430 175 L500 330 L455 345 L420 275 "
                "Q445 520 520 700 Q300 740 80 700 Q155 520 180 275 L145 345 L100 330 L170 175Z")
    if style == "plus":
        return ("M225 150 Q300 195 375 150 L450 175 L520 335 L470 352 L440 285 "
                "L452 640 Q300 668 148 640 L160 285 L130 352 L80 335 L150 175Z")
    return ("M240 150 Q300 188 360 150 L425 175 L490 330 L448 345 L418 280 "
            "L428 640 L318 650 L300 560 L282 650 L172 640 L182 280 L152 345 L110 330 L175 175Z")

def pant_path():
    return "M178 600 L422 600 L450 770 L330 770 L300 650 L270 770 L150 770Z"

def product_svg(pal, motif, style, accent_motif=None, variant=1):
    fabric, print_c, trim, bg, arch = pal
    kp = kurta_path(style)
    with_pant = style in ("set", "straight-set")
    base_style = "straight" if with_pant else style
    kp = kurta_path(base_style)
    sw = 40 if variant == 1 else 62
    defs = (pattern("fab", motif, print_c, fabric, sw) +
            pattern("bgp", "jaali", trim, bg, 52, 0.28) +
            f'<clipPath id="k"><path d="{kp}"/></clipPath>')
    pant = f'<path d="{pant_path()}" fill="{fabric}" opacity="0.92"/><path d="{pant_path()}" fill="url(#fab)" opacity="0.5"/>' if with_pant else ""
    yoke = f'<path d="M240 150 Q300 188 360 150 L372 215 Q300 250 228 215Z" fill="{trim}" opacity="0.9"/>'
    hem_y = {"anarkali": 690, "plus": 632}.get(base_style, 632)
    hem = f'<rect x="60" y="{hem_y}" width="480" height="16" fill="{trim}" clip-path="url(#k)"/>'
    placket = f'<path d="M300 188 V560" stroke="{trim}" stroke-width="3" opacity="0.8" clip-path="url(#k)"/>'
    dots = "".join(f'<circle cx="300" cy="{y}" r="4" fill="{trim}"/>' for y in range(236, 330, 26))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" role="img">
<defs>{defs}</defs>
<rect width="600" height="800" fill="url(#bgp)"/>
<path d="{arch_path(70, 40, 460, 740)}" fill="{arch}" opacity="0.22"/>
<path d="{arch_path(95, 70, 410, 710)}" fill="none" stroke="{trim}" stroke-width="2" opacity="0.7"/>
<ellipse cx="300" cy="772" rx="170" ry="14" fill="#000" opacity="0.12"/>
{pant}
<path d="{kp}" fill="url(#fab)"/>
<g clip-path="url(#k)">{yoke}{hem}{placket}</g>
{dots}
<path d="{kp}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>
</svg>'''

def swatch_svg(pal, motif, big=True):
    fabric, print_c, trim, bg, arch = pal
    defs = (pattern("fab", motif, print_c, fabric, 96 if big else 60) +
            pattern("bgp", "jaali", trim, bg, 52, 0.28))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" role="img">
<defs>{defs}</defs>
<rect width="600" height="800" fill="url(#bgp)"/>
<path d="{arch_path(60, 50, 480, 700)}" fill="url(#fab)"/>
<path d="{arch_path(78, 68, 444, 682)}" fill="none" stroke="{trim}" stroke-width="3"/>
<path d="{arch_path(96, 86, 408, 664)}" fill="none" stroke="{trim}" stroke-width="1" stroke-dasharray="3 7"/>
<rect x="60" y="720" width="480" height="30" fill="{trim}"/>
</svg>'''

# ---------- palettes: fabric, print, trim(gold), page bg, arch ----------
G = "#C69C49"
PAL = {
 "maroon":  ("#5C1624", "#F4E3E1", G, "#F4E3E1", "#7D2234"),
 "indigo":  ("#1B2A4A", "#E8E0CF", G, "#F1EBE1", "#1B2A4A"),
 "rani":    ("#B5295B", "#F2C96B", "#E3C37B", "#F7E7D0", "#B5295B"),
 "sage":    ("#F3EBDD", "#C85A32", G, "#DDE5D2", "#6D8A5E"),
 "wine":    ("#4A1522", "#C69C49", "#E3C37B", "#F1EBE1", "#4A1522"),
 "teal":    ("#1F5A5C", "#E3C37B", G, "#E4ECE8", "#1F5A5C"),
 "crimson": ("#A3162D", "#1B2A4A", G, "#F4E3E1", "#A3162D"),
 "ivory":   ("#F6EEDC", "#C69C49", "#9E782F", "#F4E3E1", "#C69C49"),
 "kashish": ("#5B3A29", "#E8D5B5", G, "#EFE6D6", "#5B3A29"),
 "mustard": ("#C9942A", "#5C1624", "#5C1624", "#F6ECD2", "#C9942A"),
 "terra":   ("#C85A32", "#FAF7F2", G, "#F4E3E1", "#C85A32"),
 "blush":   ("#F2CFCB", "#8B2A3A", G, "#FAF0EC", "#C97B82"),
}

PRODUCTS = {
 "AANN-101": ("maroon", "buti", "anarkali", "blush"),
 "AANN-104": ("indigo", "dots", "straight-set", "terra"),
 "AANN-108": ("rani", "lotus", "anarkali", "mustard"),
 "AANN-112": ("sage", "buti", "set", "indigo"),
 "AANN-115": ("wine", "stripe", "straight", "teal"),
 "AANN-119": ("teal", "jaali", "straight", "wine"),
 "AANN-124": ("crimson", "buti", "plus", "indigo"),
 "AANN-129": ("ivory", "paisley", "anarkali", "blush"),
 "AANN-133": ("kashish", "dots", "set", "indigo"),
 "AANN-138": ("mustard", "paisley", "plus", "wine"),
}
for code, (p, m, s, p2) in PRODUCTS.items():
    write(f"{code.lower()}-a.svg", product_svg(PAL[p], m, s))
    write(f"{code.lower()}-b.svg", swatch_svg(PAL[p2] if p2 in PAL else PAL[p], m))

# ---------- categories: arch with motif ----------
CATS = {
 "cotton-kurtis": ("ivory", "buti"), "rayon-kurtis": ("wine", "stripe"),
 "anarkali": ("rani", "lotus"), "straight-cut": ("teal", "jaali"),
 "kurti-with-pant-sets": ("indigo", "dots"), "co-ord-sets": ("sage", "buti"),
 "block-print": ("maroon", "paisley"), "embroidered": ("kashish", "jaali"),
 "party-wear": ("crimson", "lotus"), "plus-size": ("mustard", "paisley"),
}
for slug, (p, m) in CATS.items():
    write(f"cat-{slug}.svg", swatch_svg(PAL[p], m, big=False))

# ---------- hero slides (wide, jharokha arches) ----------
def hero_svg(base, accent, motif, n):
    fabric, print_c, trim, bg, arch = PAL[base]
    defs = pattern("hp", motif, accent, fabric, 70, 0.55) + pattern("hj", "jaali", trim, fabric, 60, 0.25)
    arches = ""
    for (x, w, h) in [(60, 230, 560), (610, 230, 560), (260, 380, 860)]:
        y = 1040 - h
        arches += (f'<path d="{arch_path(x, y, w, h)}" fill="url(#hp)" stroke="{trim}" stroke-width="3"/>'
                   f'<path d="{arch_path(x+14, y+14, w-28, h-14)}" fill="none" stroke="{trim}" stroke-width="1.5" stroke-dasharray="2 8"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1100" preserveAspectRatio="xMidYMid slice" role="img">
<defs>{defs}</defs>
<rect width="900" height="1100" fill="{fabric}"/><rect width="900" height="1100" fill="url(#hj)"/>
{arches}
<rect y="1040" width="900" height="60" fill="{trim}" opacity="0.85"/>
</svg>'''
write("hero-1.svg", hero_svg("wine", "#C69C49", "buti", 1))
write("hero-2.svg", hero_svg("indigo", "#E8E0CF", "dots", 2))
write("hero-3.svg", hero_svg("maroon", "#E3C37B", "paisley", 3))

# ---------- about + gallery tiles ----------
write("about.svg", swatch_svg(PAL["maroon"], "paisley"))
for i, (p, m) in enumerate([("blush", "buti"), ("indigo", "jaali"), ("terra", "lotus"),
                            ("sage", "dots"), ("rani", "paisley"), ("kashish", "stripe")], 1):
    write(f"gallery-{i}.svg", swatch_svg(PAL[p], m, big=False))

# og image
write("og.svg", hero_svg("maroon", "#E3C37B", "lotus", 4))
print("seed art written to", os.path.abspath(OUT), len(os.listdir(OUT)), "files")
