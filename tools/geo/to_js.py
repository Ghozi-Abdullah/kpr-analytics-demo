import json, sys, math
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
LON0, LAT0, K = 94.8, 6.3, 21.0
def P(lon, lat):
    return (round((lon - LON0) * K, 1), round((LAT0 - lat) * K, 1))
SHORT = {'Jakarta Raya': 'DKI Jakarta', 'Yogyakarta': 'DI Yogyakarta', 'Bangka-Belitung': 'Kep. Bangka Belitung'}
feats = []
maxx = maxy = 0
for f in d['features']:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    parts = []
    best = (0, 0, 0)
    area = 0.0
    for poly in polys:
        for ri, ring in enumerate(poly):
            pts = [P(*c[:2]) for c in ring]
            dd = []
            prev = None
            for x, y in pts:
                if (x, y) == prev:
                    continue
                dd.append(f"{x:g},{y:g}")
                prev = (x, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
            if len(dd) < 3:
                continue
            parts.append('M' + 'L'.join(dd) + 'Z')
            if ri == 0:
                a = cx = cy = 0
                for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                    cr = x1 * y2 - x2 * y1
                    a += cr; cx += (x1 + x2) * cr; cy += (y1 + y2) * cr
                area += abs(a) / 2
                if abs(a) > abs(best[0]) and a != 0:
                    best = (a, cx / (3 * a), cy / (3 * a))
    name = f['properties']['name']
    feats.append({'id': f['properties']['iso'], 'name': SHORT.get(name, name), 'd': ''.join(parts),
                  'cx': round(best[1], 1), 'cy': round(best[2], 1), 'a': round(area)})
feats.sort(key=lambda x: x['id'])
w, h = math.ceil(maxx + 4), math.ceil(maxy + 4)
js = ("// Peta provinsi Indonesia (33 provinsi, sumber: Natural Earth admin-1 10m, domain publik),\n"
      "// disederhanakan dengan mapshaper dan diproyeksikan ekuirektangular. Dibuat oleh tools/geo (tidak diedit manual).\n"
      f"export const ID_VIEWBOX = [0, 0, {w}, {h}];\n"
      "export const ID_PROVINCES = " + json.dumps(feats, ensure_ascii=False, separators=(',', ':')) + ";\n")
open(out, 'w').write(js)
print(len(feats), 'provinsi', w, 'x', h, len(js), 'bytes')
