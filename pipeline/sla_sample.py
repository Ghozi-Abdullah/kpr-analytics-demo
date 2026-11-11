from __future__ import annotations

import calendar
import math
import random
from datetime import date, timedelta

JENIS_KPR = [("Pembelian Rumah Baru", 45), ("Pembelian Rumah Second", 18), ("Take Over Murni", 8),
             ("Take Over Top Up", 5), ("Top Up", 6), ("Refinancing Rumah", 5), ("Pembangunan", 4),
             ("Refinancing Rumah Toko", 2), ("Pembelian Rumah Kantor Baru", 2), ("Pembelian Rumah Toko Baru", 3),
             ("Pembelian Rumah Toko Second", 2)]
CRS = [("Risiko sangat rendah", 12, 0.04), ("Risiko rendah", 22, 0.06), ("Risiko cukup rendah", 22, 0.09),
       ("Risiko sedang", 18, 0.13), ("Risiko perlu mendapat perhatian", 12, 0.2), ("Risiko cukup tinggi", 9, 0.28),
       ("Risiko tinggi", 5, 0.38)]
JOBS = {"Fix Income": [("KPR Perorangan PNS / BUMN", 35, "payroll"), ("KPR Perorangan Karyawan Swasta", 50, "nonpayroll"),
                       ("KPR Perorangan Pegawai BRI", 15, "karyawan")],
        "Non Fix Income": [("KPR Perorangan Profesional", 35, "nonpayroll"), ("KPR Perorangan Wiraswasta", 65, "sme")]}
SEED = 20261110
WINDOW_DAYS = 125
WEEKEND_KEEP = 0.55
CAIR_FLOOR = 0.08
CAIR_CURVE = 1.3
CAIR_PUSH_SHARE = 0.55

def _pick(r: random.Random, items):
    return r.choices(items, weights=[it[1] for it in items])[0]

def _month_progress(d: date) -> float:
    days = calendar.monthrange(d.year, d.month)[1]
    return (d.day - 1) / max(1, days - 1)

def _work_day(r: random.Random, start0: date) -> date:
    while True:
        d = start0 + timedelta(days=int((WINDOW_DAYS + 1) * (r.random() ** 0.7)))
        if d.weekday() < 5 or r.random() < WEEKEND_KEEP:
            return d

def _cair_day(r: random.Random, ready: date) -> date:
    if r.random() > CAIR_PUSH_SHARE:
        return ready
    last = calendar.monthrange(ready.year, ready.month)[1]
    days = [ready + timedelta(days=k) for k in range(last - ready.day + 1)]
    weights = [CAIR_FLOOR + _month_progress(d) ** CAIR_CURVE for d in days]
    return r.choices(days, weights=weights)[0]

def _rising_cair(rows: list[dict], today: date) -> None:
    by_month: dict[tuple[int, int], list[dict]] = {}
    for row in rows:
        if row["tgl_cair"]:
            by_month.setdefault((row["tgl_cair"].year, row["tgl_cair"].month), []).append(row)
    for (year, month), group in by_month.items():
        last = min(calendar.monthrange(year, month)[1], today.day if (year, month) == (today.year, today.month) else 31)
        days = [date(year, month, d) for d in range(1, last + 1)]
        counts = {d: 0 for d in days}
        for row in group:
            counts[row["tgl_cair"]] += 1
        slots = [d for d, n in zip(days, sorted(counts.values())) for _ in range(n)]
        group.sort(key=lambda row: (row["tgl_cair"], row["no"]))
        for row, day in zip(group, slots):
            row["tgl_cair"] = day

def simulate(pairs: list[tuple[str, str]], today: date, count: int = 5200, seed: int = SEED, hours: bool = True) -> list[dict]:
    r = random.Random(seed)
    start0 = today - timedelta(days=WINDOW_DAYS)
    rows = []
    for n in range(1, count + 1):
        ro, kanca = r.choice(pairs)
        jenis = _pick(r, JENIS_KPR)[0]
        crs, _, reject = _pick(r, CRS)
        income = "Fix Income" if r.random() < 0.6 else "Non Fix Income"
        job, _, typ = _pick(r, JOBS[income])
        if jenis in ("Take Over Top Up", "Top Up") and r.random() < 0.5:
            typ = "lnp"
        nominal = round(max(80.0, r.lognormvariate(math.log(520), 0.55)), 1) * 1_000_000
        clf = nominal > 900_000_000 or r.random() < 0.15
        start = _work_day(r, start0)
        slow = 1.6 if income == "Non Fix Income" else 1.0
        d1 = max(0, int(r.expovariate(1 / (1.6 * slow))))
        d2 = max(0, int(r.expovariate(1 / ((2.6 if clf else 1.7) * slow))))
        d3 = max(0, int(r.expovariate(1 / 2.2)))
        extra = r.randrange(0, 24) / 24 if hours else 0
        clf_awal = start + timedelta(days=d1)
        putus = clf_awal + timedelta(days=d2)
        cair = _cair_day(r, putus + timedelta(days=d3))
        rejected = r.random() < reject
        row = {
            "no": n, "ro": ro, "kanca": kanca, "jenis_kpr": jenis, "crs": crs, "pendapatan": income, "pekerjaan": job,
            "type": typ, "putusan": "Putusan CLF" if clf else "Putusan Cabang", "nominal_pengajuan": nominal,
            "nominal_cair": None, "tgl_prakarsa": start, "tgl_clf_awal": None, "tgl_putusan": None, "tgl_cair": None,
            "today": today, "delta_prakarsa": None, "delta_analisa": None, "delta_putusan": None,
            "d1": d1, "d2": d2, "d3": d3,
        }
        if clf_awal > today:
            row.update(proses="Proses Prakarsa", delta_prakarsa=(today - start).days + extra)
        elif putus > today:
            row.update(proses="Proses Analisis", tgl_clf_awal=clf_awal, delta_analisa=(today - clf_awal).days + extra)
        elif rejected:
            row.update(proses="Ditolak", tgl_clf_awal=clf_awal, tgl_putusan=putus)
        elif cair > today:
            row.update(proses="Sudah Diputus", tgl_clf_awal=clf_awal, tgl_putusan=putus, delta_putusan=(today - putus).days + extra)
        else:
            row.update(proses="Sudah Cair", tgl_clf_awal=clf_awal, tgl_putusan=putus, tgl_cair=cair,
                       nominal_cair=round(nominal * r.uniform(0.9, 1.0), -5))
        rows.append(row)
    _rising_cair(rows, today)
    return rows
