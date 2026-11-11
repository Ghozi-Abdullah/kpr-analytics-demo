from __future__ import annotations

import calendar
import json
import math
import random
import re
from pathlib import Path
from datetime import date, datetime, timedelta

from openpyxl import Workbook

import config
import sla_sample

SEED = 20261104
START = date(2026, 1, 1)
END = date(2026, 10, 31)
PORTFOLIO_LAST_MONTH = (2026, 10)

RO_NAMES = ["Region 01 / Medan", "Region 02 / Pekanbaru", "Region 03 / Padang", "Region 04 / Palembang",
            "Region 05 / Bandar Lampung", "Region 06 / Jakarta 1", "Region 07 / Jakarta 2", "Region 08 / Jakarta 3",
            "Region 09 / Bandung", "Region 10 / Semarang", "Region 11 / Yogyakarta", "Region 12 / Surabaya",
            "Region 13 / Malang", "Region 14 / Banjarmasin", "Region 15 / Makassar", "Region 16 / Manado",
            "Region 17 / Denpasar", "Region 18 / Jayapura"]
KANCA_PER_RO = 8

ROOT = Path(__file__).resolve().parent.parent

def _kanca_rules():
    src = (ROOT / "site" / "js" / "map" / "branch-locations.js").read_text(encoding="utf-8")
    table = json.loads(re.search(r"KANCA_CITY = (\[.*?\]);", src, re.S).group(1))
    return [(prov, re.compile(r"(^|[^a-z])" + re.escape(k) + r"([^a-z]|$)")) for prov, keys in table for k in keys]

def kanca_label(raw: str) -> str:
    s = re.sub(r"^\s*\d+\s*--\s*", "", raw)
    s = re.sub(r"\s*\(konsolidasi[^)]*\)\s*$", "", s, flags=re.I)
    return re.sub(r"\s{2,}", " ", s).strip()

def _metro_rules():
    src = (ROOT / "site" / "js" / "map" / "metro-areas.js").read_text(encoding="utf-8")
    rules = []
    for m in re.finditer(r"\{ id: '(\w+)'.*?prov: '([A-Z-]+)'.*?keys: \[(.*?)\] \}", src, re.S):
        for k in re.findall(r"'([^']+)'", m.group(3)):
            rules.append((m.group(2), m.group(1), len(k), re.compile(r"(^|[^a-z])" + re.escape(k) + r"([^a-z]|$)")))
    return sorted(rules, key=lambda r: -r[2])

def load_kanca():
    rules = _kanca_rules()
    metro = _metro_rules()
    seen, items = set(), []
    for line in (ROOT / "pipeline" / "dummy_kanca.txt").read_text(encoding="utf-8").splitlines():
        parts = [x.strip() for x in line.split("\t")]
        if len(parts) != 2 or parts[0] not in RO_NAMES:
            continue
        m = re.match(r"(\d+)\s*--\s*(.+)$", parts[1])
        if not m:
            continue
        label = kanca_label(parts[1])
        low = re.sub(r"\s+", " ", label.lower())
        if low in seen:
            continue
        seen.add(low)
        prov = next((p for p, rx in rules if rx.search(low)), "")
        area = next((a for p, a, _, rx in metro if p == prov and rx.search(low)), "")
        items.append((parts[0], f"{m.group(1)} -- {label}(Konsolidasi-MB)", label, m.group(1), area or prov))
    by_ro = {}
    pick = random.Random(SEED + 7)
    for ro in RO_NAMES:
        pool = [x for x in items if x[0] == ro]
        pick.shuffle(pool)
        first = list({x[4]: x for x in pool}.values())
        rest = [x for x in pool if x not in first]
        by_ro[ro] = [(raw, label, kode) for _, raw, label, kode, _ in (first + rest)[:KANCA_PER_RO]]
    return by_ro

KANCA = load_kanca()

RM_TOTAL = 661
RM_MIN_PER_KANCA = 2
RM_FIRST_MALE = ["Agus", "Andi", "Arif", "Bambang", "Budi", "Dedi", "Dimas", "Eko", "Fajar", "Fikri", "Gilang",
                 "Hadi", "Hendra", "Ilham", "Irfan", "Joko", "Rizky", "Rudi", "Sigit", "Teguh", "Wahyu", "Yogi",
                 "Yusuf", "Adi", "Bayu", "Danu", "Gede", "Putu", "Made", "Komang", "Asep", "Ujang", "Dadang",
                 "Ahmad", "Rahmat", "Taufik", "Ridwan", "Hafiz", "Zainal", "Reza", "Rian", "Galih", "Satria",
                 "Ardi", "Bagus", "Doni", "Feri", "Heru", "Indra", "Lukman", "Robby", "Yudha"]
RM_FIRST_FEMALE = ["Ayu", "Dewi", "Sri", "Siti", "Fitri", "Indah", "Intan", "Maya", "Novi", "Putri", "Rina",
                   "Rini", "Sari", "Tika", "Wulan", "Yuni", "Ratna", "Nadia", "Anisa", "Citra", "Dian", "Eka",
                   "Gita", "Hana", "Kartika", "Laras", "Mega", "Nabila", "Puspa", "Rara", "Salsa", "Tari", "Vina",
                   "Widya", "Yanti", "Zahra", "Aulia", "Dinda", "Melati", "Nurul", "Retno", "Ika"]
RM_LAST_MALE = ["Pratama", "Saputra", "Santoso", "Hidayat", "Nugroho", "Setiawan", "Kurniawan", "Syahputra",
                "Ramadhan", "Firmansyah", "Hakim", "Rahman", "Wibowo", "Susanto", "Hartono", "Purnomo",
                "Prasetyo", "Utomo", "Suryadi", "Wahyudi", "Hermawan", "Permana", "Pangestu", "Mahendra",
                "Adiputra", "Pamungkas", "Mulyadi", "Sutrisno", "Effendi", "Maulana", "Iskandar", "Siswanto"]
RM_LAST_FEMALE = ["Rahayu", "Lestari", "Wulandari", "Anggraini", "Puspitasari", "Safitri", "Handayani",
                  "Damayanti", "Novitasari", "Rachmawati", "Pertiwi", "Fitriani", "Septiani", "Maharani",
                  "Kusumawati", "Permatasari", "Ramadhani", "Oktaviani"]
RM_LAST_ANY = ["Siregar", "Nasution", "Lubis", "Harahap", "Ginting", "Tarigan", "Sembiring", "Purba",
               "Hasibuan", "Batubara", "Manurung", "Pasaribu", "Situmorang", "Pardede", "Tanjung", "Sinaga",
               "Simanjuntak", "Hutapea", "Sitompul", "Daulay", "Panjaitan", "Sihombing", "Wijaya", "Kusuma"]
RM_SKIP = {"Budi Gunawan", "Dewi Lestari"}

def rm_names(count: int, pick: random.Random) -> list[str]:
    male = [f"{a} {b}" for a in RM_FIRST_MALE for b in RM_LAST_MALE + RM_LAST_ANY]
    female = [f"{a} {b}" for a in RM_FIRST_FEMALE for b in RM_LAST_FEMALE + RM_LAST_ANY]
    pool = [n for n in male if n not in RM_SKIP], [n for n in female if n not in RM_SKIP]
    women = round(count * 0.42)
    names = pick.sample(pool[0], count - women) + pick.sample(pool[1], women)
    pick.shuffle(names)
    return names

def rm_roster() -> dict[str, list[str]]:
    pick = random.Random(SEED + 11)
    branches = [label for ro in RO_NAMES for _, label, _ in KANCA[ro]]
    seats = {kc: RM_MIN_PER_KANCA for kc in branches}
    for kc in pick.choices(branches, weights=[pick.uniform(0.6, 1.6) for _ in branches], k=RM_TOTAL - RM_MIN_PER_KANCA * len(branches)):
        seats[kc] += 1
    names = iter(rm_names(RM_TOTAL, pick))
    return {kc: [next(names) for _ in range(seats[kc])] for kc in branches}

RM_ROSTER = rm_roster()
RM_BY_RO = {ro: sum(len(RM_ROSTER[label]) for _, label, _ in KANCA[ro]) for ro in RO_NAMES}
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
         "Agustus", "September", "Oktober", "November", "Desember"]

PERF_HEADERS = ["Tanggal", "Regional Office", " Bulan_lalu", " Hari Kerja", " Hari Kerja Bulan Lalu", " OS",
                "helper_os", "Gr_OS", "Gr_OS_lalu", "Graph_OS_lalu", "Graph_OS", "rka_os_baru", "Debitur",
                "Gr_Deb", "helper_Deb", "RKA_Deb", "DPK", "helper_DPK", "Gr_DPK", "RKA_DPK", "NPL",
                "helper_NPL", "Gr_NPL", "RKA_NPL", "Disburse", "Disburse_lalu", "Graph_Disburse",
                "GR_Disburse", "jum_RM", "Prod_RM_Now", "Prod_RM_Lalu", "Line Chart DPK", "Line Chart NPL",
                "Prognosa_disburse", "Guidance_disb", "Prognosa_disburse_rm", "Guidance_disb_rm",
                "Jumlah RM Lalu", "Bulan Tahun", "Hari", "Nilai Akhir_OS_Lalu", "Graph_OS_Khusus",
                "GR_Disburse_Khusus", "Prod_RM_Khusus"]
KUADRAN_HEADERS = ["Tanggal", "Regional Office", " Kuadran", "Jumlah RM", "Bulan_lalu", "Jumlah RM_Lalu",
                   "Bulan Tahun"]
PORT_HEADERS = ["RO", "KANCA", "Produk", "Tujuan Kredit", "Jenis Pendapatan", "Tier Dev", "Kolek", "Rp",
                "Kategori OS", "Rp", "No", "% OS", "Bulan", "Total OS", "Jumlah Deb", "Kategori Deb",
                "Jum Deb", "Total Deb", "% Deb", "KC Tarikan", "Kode KC", "Fix", "KC FIX"]
REAL_HEADERS = ["no_tanggal", "Tanggal Realisasi", "Bulan", "RO", "Kanca", "Tipe KPR", "Plafond",
                "Nama Debitur", "Nama RM", "Tujuan Kredit", "Dev Local Champion", "Debitur Count",
                "RM Count", "Bulan_Date", "5 Sumber", "6 Sumber"]

rng = random.Random(SEED)

def month_iter(y, m, y2, m2):
    while (y, m) <= (y2, m2):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)

def prev_month(y, m):
    return (y - 1, 12) if m == 1 else (y, m - 1)

def workdays_upto(y, m, d):
    return sum(1 for i in range(1, d + 1) if date(y, m, i).weekday() < 5)

def as_dt(d: date) -> datetime:
    return datetime(d.year, d.month, d.day)

SEASON_DISB = {1: 0.86, 2: 0.95, 3: 0.7, 4: 1.14, 5: 1.0, 6: 1.07, 7: 0.94, 8: 1.05, 9: 1.09, 10: 0.97, 11: 1.12, 12: 1.3}
SEASON_RISK = {1: 1.03, 2: 0.99, 3: 1.02, 4: 1.1, 5: 1.05, 6: 0.97, 7: 1.0, 8: 1.04, 9: 0.98, 10: 1.02, 11: 1.0, 12: 0.93}
HOLIDAYS = {date(2026, 1, 1), date(2026, 3, 18), date(2026, 3, 19), date(2026, 3, 20), date(2026, 3, 23),
            date(2026, 3, 24), date(2026, 5, 1), date(2026, 5, 14), date(2026, 6, 1), date(2026, 8, 17),
            date(2025, 12, 25), date(2025, 12, 26)}

def is_workday(d: date) -> bool:
    return d.weekday() < 5 and d not in HOLIDAYS

def cum_share(weights):
    total = sum(weights) or 1.0
    out, acc = [], 0.0
    for w in weights:
        acc += w
        out.append(acc / total)
    return out

def months_left(y: int, m: int) -> int:
    return (END.year - y) * 12 + END.month - m

def simulate_performance():
    ro_params = {}
    for ro in RO_NAMES:
        os0 = rng.uniform(1800, 6200)
        sml0, npl0 = rng.uniform(0.034, 0.058), rng.uniform(0.026, 0.046)
        ro_params[ro] = {
            "os_end": os0, "deb_end": os0 * rng.uniform(3.0, 4.2), "sml": sml0, "npl": npl0,
            "sml0": sml0, "npl0": npl0, "mom": rng.gauss(0, 0.1), "rm_step": rng.uniform(0.3, 1.4),
            "share": [rng.uniform(0.30, 0.42), rng.uniform(0.02, 0.06), rng.uniform(0.22, 0.32), 0],
        }
        s = ro_params[ro]["share"]
        s[3] = max(0.15, 1 - sum(s[:3]))

    months = {}
    for y, m in month_iter(*prev_month(START.year, START.month), END.year, END.month):
        D = calendar.monthrange(y, m)[1]
        work = [is_workday(date(y, m, d)) for d in range(1, D + 1)]
        common_disb = [rng.lognormvariate(0, 0.5) * (rng.uniform(1.8, 2.6) if rng.random() < 0.1 else 1.0) for _ in range(D)]
        common_run = [rng.lognormvariate(0, 0.35) for _ in range(D)]
        common_sml, common_npl = [], []
        cs, cn = 0.0, 0.0
        for _ in range(D):
            cs += rng.gauss(0, 0.03) + (rng.uniform(0.04, 0.09) if rng.random() < 0.06 else 0.0)
            cn += rng.gauss(0, 0.006) + (rng.uniform(0.012, 0.03) if rng.random() < 0.05 else 0.0) - (rng.uniform(0.01, 0.025) if rng.random() < 0.04 else 0.0)
            common_sml.append(cs)
            common_npl.append(cn)
        for ro in RO_NAMES:
            p = ro_params[ro]
            os_prev, deb_prev = p["os_end"], p["deb_end"]
            p["mom"] = 0.55 * p["mom"] + rng.gauss(0, 0.13)
            disb_m = os_prev * rng.uniform(0.018, 0.028) * SEASON_DISB[m] * math.exp(p["mom"])
            runoff_m = os_prev * rng.uniform(0.0108, 0.0172) * (1.1 if m in (3, 12) else 1.0)
            g_m = disb_m - runoff_m

            w_disb, w_run = [], []
            for d in range(1, D + 1):
                t = d / D
                if work[d - 1]:
                    x = (0.5 + 2.4 * t ** 3.2) * common_disb[d - 1] * rng.lognormvariate(0, 0.4)
                    if rng.random() < 0.06:
                        x *= rng.uniform(2.0, 3.4)
                else:
                    x = rng.uniform(0.0, 0.06)
                w_disb.append(x)
                r = 0.22 + (1.7 if d <= 5 else 0.0) + (1.1 if 24 <= d <= 28 else 0.0)
                r *= common_run[d - 1] * rng.lognormvariate(0, 0.35) * (1.0 if work[d - 1] else 0.35)
                if rng.random() < 0.05:
                    r += rng.uniform(1.4, 3.0)
                w_run.append(r)
            c_disb, c_run = cum_share(w_disb), cum_share(w_run)
            disb = [disb_m * c for c in c_disb]
            gr = [disb[i] - runoff_m * c_run[i] for i in range(D)]

            ticket = rng.uniform(0.32, 0.46)
            new_deb = disb_m / ticket
            closed = new_deb * rng.uniform(0.28, 0.62)
            deb = [deb_prev + new_deb * c_disb[i] - closed * c_run[i] for i in range(D)]
            gd_m = new_deb - closed

            risk = SEASON_RISK[m]
            p["sml"] = min(0.095, max(0.02, p["sml"] * math.exp(rng.gauss(0, 0.075)) * risk ** 0.5 + 0.18 * (p["sml0"] - p["sml"])))
            p["npl"] = min(0.07, max(0.012, p["npl"] * math.exp(rng.gauss(0, 0.05)) * risk ** 0.35 + 0.1 * (p["npl0"] - p["npl"])))
            if rng.random() < 0.08:
                p["npl"] *= rng.uniform(1.08, 1.18)
            sml_b, npl_b = p["sml"], p["npl"]
            dpk, npl = [], []
            walk, jump, level = 0.0, 0.0, 1.0
            for i in range(D):
                d = i + 1
                os_d = os_prev + gr[i]
                walk += rng.gauss(0, 0.022)
                if rng.random() < 0.05:
                    jump += rng.uniform(0.05, 0.13)
                if d <= D - 3:
                    x = 0.62 + 0.85 * (d / D) + walk + jump + common_sml[i]
                else:
                    x = 0.75 * rng.uniform(0.95, 1.05) + 0.3 * (jump + common_sml[i])
                dpk.append(os_d * sml_b * max(0.3, x))
                level += rng.gauss(0, 0.006)
                if rng.random() < 0.035:
                    level += rng.uniform(0.02, 0.05)
                if rng.random() < 0.025:
                    level -= rng.uniform(0.015, 0.04)
                level = min(1.18, max(0.86, level))
                npl.append(os_d * npl_b * (level + common_npl[i]) * (0.97 if d >= D - 1 else 1.0))

            rm = max(RM_MIN_PER_KANCA, RM_BY_RO[ro] - round(months_left(y, m) * p["rm_step"]) + rng.randint(-1, 1) * (months_left(y, m) > 0))
            months[(ro, y, m)] = {
                "D": D, "os_prev": os_prev, "deb_prev": deb_prev, "gr": gr, "deb": deb, "disb": disb,
                "dpk": dpk, "npl": npl, "rm": rm, "g_m": g_m, "gd_m": gd_m, "disb_m": disb_m,
                "rka_os": os_prev + max(g_m, os_prev * 0.004) * rng.uniform(0.85, 1.5),
                "rka_deb": deb_prev + max(gd_m, deb_prev * 0.002) * rng.uniform(0.8, 1.35),
                "rka_dpk": (os_prev * sml_b) * rng.uniform(0.85, 1.12),
                "rka_npl": (os_prev * npl_b) * rng.uniform(0.92, 1.08),
                "guidance": disb_m * rng.uniform(1.05, 1.9),
                "prognosa": disb_m * rng.uniform(0.9, 1.18),
                "share": [x * rng.uniform(0.9, 1.1) for x in p["share"]],
            }
            p["os_end"] = os_prev + gr[-1]
            p["deb_end"] = deb[-1]
    return months

def perf_rows(months):
    rows, kuadran = [], []
    for y, m in month_iter(START.year, START.month, END.year, END.month):
        py, pm = prev_month(y, m)
        D = calendar.monthrange(y, m)[1]
        last_day = D if (y, m) != (END.year, END.month) else END.day
        hk_total_prev = workdays_upto(py, pm, calendar.monthrange(py, pm)[1])
        for d in range(1, last_day + 1):
            hk = max(1, workdays_upto(y, m, d))
            day_rows = []
            for ro in RO_NAMES:
                cur, prv = months[(ro, y, m)], months[(ro, py, pm)]
                i, Dp = d - 1, prv["D"]
                ip = min(i, Dp - 1)
                os_d = cur["os_prev"] + cur["gr"][i]
                dpk_prev_end, npl_prev_end = prv["dpk"][-1], prv["npl"][-1]
                r = {
                    "os": os_d, "helper_os": cur["os_prev"], "gr_os": cur["gr"][i],
                    "gr_os_lalu": prv["gr"][ip] if d <= Dp else None, "graph_os_lalu": prv["gr"][ip],
                    "graph_os": cur["gr"][i], "rka_os": cur["rka_os"],
                    "deb": round(cur["deb"][i]), "gr_deb": round(cur["deb"][i] - cur["deb_prev"]),
                    "helper_deb": round(cur["deb_prev"]), "rka_deb": round(cur["rka_deb"]),
                    "dpk": cur["dpk"][i], "helper_dpk": dpk_prev_end, "gr_dpk": cur["dpk"][i] - dpk_prev_end,
                    "rka_dpk": cur["rka_dpk"], "npl": cur["npl"][i], "helper_npl": npl_prev_end,
                    "gr_npl": cur["npl"][i] - npl_prev_end, "rka_npl": cur["rka_npl"],
                    "disb": cur["disb"][i], "disb_lalu": prv["disb"][ip] if d <= Dp else None,
                    "disb_day": cur["disb"][i] - (cur["disb"][i - 1] if i else 0.0),
                    "disb_day_lalu": (prv["disb"][ip] - (prv["disb"][ip - 1] if ip else 0.0)) if d <= Dp else None,
                    "rm": cur["rm"], "rm_lalu": prv["rm"],
                    "prognosa": cur["prognosa"], "guidance": cur["guidance"],
                    "nilai_akhir_lalu": prv["gr"][-1],
                    "khusus_os": None,
                    "khusus_disb": None,
                }
                day_rows.append((ro, r, cur["share"], prv["share"]))
            nat = {}
            for _, r, _, _ in day_rows:
                for k, v in r.items():
                    if v is None:
                        nat.setdefault(k, None)
                    else:
                        nat[k] = (nat.get(k) or 0) + v
            all_rows = day_rows + [("Nasional", nat, None, None)]
            cur_date = date(y, m, d)
            for ro, r, share, share_prev in all_rows:
                rows.append([
                    as_dt(cur_date), ro, as_dt(date(py, pm, 1)), hk, hk_total_prev, r["os"], r["helper_os"],
                    r["gr_os"], r["gr_os_lalu"], r["graph_os_lalu"], r["graph_os"], r["rka_os"], r["deb"],
                    r["gr_deb"], r["helper_deb"], r["rka_deb"], r["dpk"], r["helper_dpk"], r["gr_dpk"],
                    r["rka_dpk"], r["npl"], r["helper_npl"], r["gr_npl"], r["rka_npl"], r["disb_day"],
                    r["disb_day_lalu"], r["disb"], r["disb"], r["rm"], r["disb"] / r["rm"],
                    (r["disb_lalu"] / r["rm_lalu"]) if r["disb_lalu"] is not None else None,
                    r["dpk"] / r["os"], r["npl"] / r["os"], r["prognosa"], r["guidance"],
                    r["prognosa"] / r["rm"], r["guidance"] / r["rm"], r["rm_lalu"],
                    f"{BULAN[m - 1]} {y}", d, r["nilai_akhir_lalu"], r["khusus_os"], r["khusus_disb"],
                    (r["khusus_disb"] / r["rm_lalu"]) if r["khusus_disb"] is not None else None,
                ])
            if d == D and Dp > D and (y, m) != (END.year, END.month):
                for ro, r, _, _ in all_rows:
                    prv_gr = r["nilai_akhir_lalu"]
                    prv_disb = sum(months[(x, py, pm)]["disb"][-1] for x in RO_NAMES) if ro == "Nasional" else months[(ro, py, pm)]["disb"][-1]
                    helper = [None] * len(PERF_HEADERS)
                    helper[0], helper[1], helper[PERF_HEADERS.index("Hari")] = as_dt(cur_date), ro, 31
                    helper[PERF_HEADERS.index("Graph_OS_Khusus")] = prv_gr
                    helper[PERF_HEADERS.index("GR_Disburse_Khusus")] = prv_disb
                    helper[PERF_HEADERS.index("Prod_RM_Khusus")] = prv_disb / r["rm_lalu"] if r["rm_lalu"] else None
                    rows.append(helper)
            if d != last_day:
                continue
            nat_k = [0, 0, 0, 0]
            nat_kl = [0, 0, 0, 0]
            for ro, r, share, share_prev in day_rows:
                cnt = split_count(r["rm"], share)
                cnt_l = split_count(r["rm_lalu"], share_prev)
                for k in range(4):
                    nat_k[k] += cnt[k]
                    nat_kl[k] += cnt_l[k]
                    kuadran.append([as_dt(cur_date), ro, f"K{k + 1}", cnt[k], as_dt(date(py, pm, 1)), cnt_l[k],
                                    f"{BULAN[m - 1]} {y}"])
            for k in range(4):
                kuadran.append([as_dt(cur_date), "Nasional", f"K{k + 1}", nat_k[k], as_dt(date(py, pm, 1)),
                                nat_kl[k], f"{BULAN[m - 1]} {y}"])
    return rows, kuadran

def split_count(total, share):
    s = sum(share)
    counts = [int(total * x / s) for x in share]
    counts[0] += total - sum(counts)
    return counts

KAT_NO = {"OS": 1, "OS SML": 2, "OS NPL": 3, "OS FI": 4, "OS NFI": 5,
          "OS SML FI": 6, "OS SML NFI": 7, "OS NPL FI": 8, "OS NPL NFI": 9}
SEGMENTS = [
    ("KPR", "Primary", "Dev Tier 1", 0.085),
    ("KPR", "Primary", "Non Dev Tier 1", 0.415),
    ("KPR", "Secondary", "", 0.15),
    ("KPR", "Refinancing", "", 0.065),
    ("KPRS", "Primary", "", 0.285),
]

def portfolio_rows(months):
    rows = []
    kanca_by_ro = {ro: [label for _, label, _ in KANCA[ro]] for ro in RO_NAMES}
    kanca_weights = {ro: [rng.uniform(0.5, 1.5) for _ in kanca_by_ro[ro]] for ro in RO_NAMES}
    kanca_raw = {label: raw for ro in RO_NAMES for raw, label, _ in KANCA[ro]}
    kanca_code = {label: kode for ro in RO_NAMES for _, label, kode in KANCA[ro]}

    for y, m in month_iter(START.year, START.month, *PORTFOLIO_LAST_MONTH):
        D = calendar.monthrange(y, m)[1]
        for ro in RO_NAMES:
            st = months[(ro, y, m)]
            ro_os_rp = (st["os_prev"] + st["gr"][D - 1]) * 1e9 * rng.uniform(0.985, 1.015)
            wsum = sum(kanca_weights[ro])
            for kc, w in zip(kanca_by_ro[ro], kanca_weights[ro]):
                kc_os = ro_os_rp * w / wsum
                for produk, tujuan, tier, porsi in SEGMENTS:
                    seg = kc_os * porsi * rng.uniform(0.85, 1.15)
                    avg_loan = 1.45e8 if produk == "KPRS" else rng.uniform(3.6e8, 6.2e8)
                    for jp, jp_share in (("FI", rng.uniform(0.68, 0.82)), ("NFI", None)):
                        amount_jp = seg * (jp_share if jp_share else 1 - 0.75)
                        sml = rng.uniform(0.012, 0.09) if produk == "KPR" else rng.uniform(0.03, 0.06)
                        npl = rng.uniform(0.006, 0.11) if produk == "KPR" else rng.uniform(0.01, 0.03)
                        for kol, frac in (("L", 1 - sml - npl), ("SML", sml), ("NPL", npl)):
                            amount = amount_jp * frac
                            debs = max(1, round(amount / avg_loan))
                            kats = ["OS", f"OS {jp}"] + ([f"OS {kol}", f"OS {kol} {jp}"] if kol != "L" else [])
                            for kat in kats:
                                kat_deb = kat.replace("OS", "Deb", 1)
                                rows.append([
                                    ro, kanca_raw[kc], produk, tujuan, jp, tier, kol,
                                    round(amount / 1e6, 2),
                                    kat, round(amount, 0), KAT_NO[kat],
                                    None, as_dt(date(y, m, 1)), None,
                                    debs * rng.randint(2, 5),
                                    kat_deb, debs, None, None,
                                    kc.upper(), kanca_code[kc], "Y", kc,
                                ])
    return rows

TIPE = [
    ("Dev Tier 1", 0.22, 620), ("Non Dev Tier 1", 0.20, 480), ("Secondary", 0.09, 560),
    ("FLPP", 0.36, 162), ("LNP", 0.08, 520), ("Top Up", 0.02, 210), ("Karyawan BRI", 0.03, 430),
]
SUMBER5_BY_TIPE = {"LNP": "ETB", "Top Up": "ETB", "Karyawan BRI": "ETB"}
SUMBER6_BY_TIPE = {"LNP": "ETB", "Top Up": "ETB", "Karyawan BRI": "ETB", "FLPP": "Subsidi"}
TUJUAN_BY_TIPE = {"Dev Tier 1": "Primary", "Non Dev Tier 1": "Primary", "Secondary": "Secondary",
                  "FLPP": "Primary", "LNP": "Primary", "Top Up": "Refinancing", "Karyawan BRI": "Primary"}

def realisasi_rows():
    rows = []
    kanca = {ro: [label for _, label, _ in KANCA[ro]] for ro in RO_NAMES}
    rm_names = RM_ROSTER
    deb_no = 0
    weights = [t[1] for t in TIPE]
    d = START
    while d <= END:
        D = calendar.monthrange(d.year, d.month)[1]
        base = (95 if is_workday(d) else 12) * SEASON_DISB[d.month]
        base *= (1 + 1.4 * (d.day / D) ** 6) * rng.lognormvariate(0, 0.3)
        if rng.random() < 0.06:
            base *= rng.uniform(1.8, 2.8)
        count = max(0, int(rng.gauss(base, base * 0.12)))
        for _ in range(count):
            ro = rng.choice(RO_NAMES)
            kc = rng.choice(kanca[ro])
            tipe, _, avg = rng.choices(TIPE, weights=weights)[0]
            deb_no += 1
            rows.append([
                d.day, as_dt(d), BULAN[d.month - 1], ro, kc, tipe,
                round(max(50.0, rng.lognormvariate(math.log(avg), 0.35)), 1),
                f"Debitur Dummy {deb_no:06d}", rng.choice(rm_names[kc]), TUJUAN_BY_TIPE[tipe],
                "Ya" if tipe == "Non Dev Tier 1" and deb_no % 3 == 0 else "Tidak",
                1, 1, as_dt(date(d.year, d.month, 1)),
                SUMBER5_BY_TIPE.get(tipe, tipe),
                SUMBER6_BY_TIPE.get(tipe, tipe),
            ])
        d += timedelta(days=1)
    return rows

SLA_HEADERS = ["No.", "NAMA KANWIL", "NAMA BRANCH", "NO. REFERENSI", "NAMA DEBITUR", "NIK", "NOMOR HANDPHONE",
               " NOMINAL PENGAJUAN ", "JENIS KPR", "JENIS_DEBITUR", "NILAI CRS", "DESKRIPSI CRS",
               "STATUS PRESCREENING", "JENIS PEKERJAAN", "JENIS AGUNAN", "JENIS PENDAPATAN", "NPW TOTAL AGUNAN",
               "JENIS SEKTOR EKONOMI", "LTV", "PN PEMRAKARSA", "NAMA PEMRAKARSA", "PN PEMUTUS TERAKHIR",
               "NAMA PEMUTUS TERAKHIR", "PN PIC", "NAMA PIC", "PN SO", "NAMA SO", "NOMINAL PENCAIRAN",
               "NOMOR REKENING PINJAMAN", "NOMOR REKENING SIMPANAN", "NAMA REKENING SIMPANAN", "JENIS PUTUSAN",
               "NAMA DEVELOPER", "TIER", "BUYBACK", "NAMA GRUP", "PROJECT", "PROGRAM", "SUMBER PENGAJUAN",
               "TANGGAL PRAKARSA", "TANGGAL ENTRY CLF AWAL", "TANGGAL ENTRY CLF AKHIR", "TANGGAL PUTUSAN",
               "TAT PRAKARSA", "TAT CLF Awal", "TAT CLF Akhir", "TAT CLF Awal (hari)", "TAT UKER",
               "TAT PENCAIRAN KREDIT", "TAT TOTAL", "STATUS", "STATUS PENGAJUAN SITARA", "JENIS PEMBIAYAAN SITARA",
               "TIPE PROGRAM SITARA", "ID PENGAJUAN SITARA", "ID RUMAH SITARA", "NOMOR REKENING DEVELOPER UJI SP3K",
               "NAMA REKENING DEVELOPER UJI SP3K", "NOMOR REKENING SIMPANAN DEBITUR UJI SP3K",
               "NAMA REKENING SIMPANAN DEBITUR UJI SP3K", "source_file", "ds", "nik2", "Column1", "bln",
               "No Rekening", "CIF", " Plafond ", "Bunga", "Tanggal Realisasi", "Tanggal Jatuh Tempo", "Program3",
               "tenor", "plafond4", "type", "process_group", "Column15", "today", "delta proses prakarsa",
               "format delta proses prakarsa", "delta proses analisa", "format delta proses analisa",
               "delta proses putusan", "format delta proses putusan", "area"]
def sla_rows():
    r = random.Random(SEED + 7)
    pairs = [(ro, label) for ro in RO_NAMES for _, label, _ in KANCA[ro]]
    upper = lambda t: re.sub(r"\s+", " ", t).upper()
    kanwil = lambda ro: "KANWIL " + upper(re.sub(r"^.*/\s*", "", ro))
    rows = []
    for x in sla_sample.simulate(pairs, END, start=START, seed=SEED + 7, hours=False):
        n = x["no"]
        dt = lambda d: as_dt(d) if d else None
        fmt = {k: (None if x[f"delta_{k}"] is None else ("<3 hari" if x[f"delta_{k}"] <= 3 else ">3 hari"))
               for k in ("prakarsa", "analisa", "putusan")}
        cair = x["tgl_cair"]
        rows.append([
            n, kanwil(x["ro"]), upper(x["kanca"]), f"REF{2600000 + n}", f"Debitur SLA {n:05d}", f"3174{r.randrange(10**11, 10**12)}",
            f"0812{r.randrange(10**7, 10**8)}", x["nominal_pengajuan"], x["jenis_kpr"], "Perorangan", r.randint(300, 900), x["crs"],
            "Lolos", x["pekerjaan"], "Rumah Tinggal", x["pendapatan"], round(x["nominal_pengajuan"] * 1.25, -5), "Rumah Tangga",
            round(r.uniform(0.6, 0.95), 2), f"PN{r.randrange(10**7, 10**8)}", f"Pemrakarsa {r.randint(1, 400):03d}",
            f"PN{r.randrange(10**7, 10**8)}", f"Pemutus {r.randint(1, 120):03d}", f"PN{r.randrange(10**7, 10**8)}",
            f"PIC {r.randint(1, 300):03d}", f"PN{r.randrange(10**7, 10**8)}", f"SO {r.randint(1, 300):03d}", x["nominal_cair"],
            f"{r.randrange(10**14, 10**15)}" if cair else None, f"{r.randrange(10**14, 10**15)}", f"Debitur SLA {n:05d}",
            x["putusan"], f"Developer {r.randint(1, 60):02d}", r.choice(["Tier 1", "Non Tier 1"]), "Tidak", None, None,
            "KPR Reguler", "Cabang", dt(x["tgl_prakarsa"]), dt(x["tgl_clf_awal"]), dt(x["tgl_clf_awal"]), dt(x["tgl_putusan"]),
            x["d1"], x["d2"], 0, x["d2"], x["d1"] + x["d2"], x["d3"] if cair else None,
            (x["d1"] + x["d2"] + x["d3"]) if cair else None, x["proses"], None, None, None, None, None, None, None, None,
            None, "export_sla.xlsx", as_dt(END), None, None, x["tgl_prakarsa"].strftime("%Y-%m"),
            f"{r.randrange(10**14, 10**15)}" if cair else None, f"{r.randrange(10**8, 10**9)}",
            x["nominal_pengajuan"], 7.5, dt(cair), None, None, 180, x["nominal_pengajuan"], x["type"], x["proses"], None,
            as_dt(END), x["delta_prakarsa"], fmt["prakarsa"], x["delta_analisa"], fmt["analisa"], x["delta_putusan"],
            fmt["putusan"], None,
        ])
    return rows

def write_xlsx(path, sheets):
    wb = Workbook(write_only=True)
    for sheet, headers, rows in sheets:
        ws = wb.create_sheet(sheet)
        ws.append(headers)
        for r in rows:
            ws.append(r)
    wb.save(path)

def sheet_of(name):
    return config.SOURCES[name]["sheet"] or "Sheet1"

def main():
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    months = simulate_performance()
    perf, kuadran = perf_rows(months)
    port = portfolio_rows(months)
    real = realisasi_rows()
    for old in ("kuadran_rm.xlsx",):
        (config.RAW_DIR / old).unlink(missing_ok=True)
    write_xlsx(config.RAW_DIR / "performance.xlsx", [(sheet_of("performance"), PERF_HEADERS, perf),
                                                    (sheet_of("kuadran"), KUADRAN_HEADERS, kuadran)])
    write_xlsx(config.RAW_DIR / "portfolio.xlsx", [(sheet_of("portfolio"), PORT_HEADERS, port)])
    write_xlsx(config.RAW_DIR / "realisasi.xlsx", [(sheet_of("realisasi"), REAL_HEADERS, real)])
    sla = sla_rows()
    write_xlsx(config.RAW_DIR / "sla.xlsx", [("Data SLA", SLA_HEADERS, sla)])
    (config.RAW_DIR / ".dummy").write_text("Folder ini berisi data dummy dari make_dummy.py\n", encoding="utf-8")
    print(f"Data dummy dibuat di {config.RAW_DIR}")
    print(f"  performance.xlsx : {len(perf):>6} baris (sheet {sheet_of('performance')}), {len(kuadran)} baris (sheet {sheet_of('kuadran')})")
    print(f"  portfolio.xlsx   : {len(port):>6} baris")
    print(f"  realisasi.xlsx   : {len(real):>6} baris")
    print(f"  sla.xlsx         : {len(sla):>6} baris")
    print("Lanjut: python pipeline/build_data.py")

if __name__ == "__main__":
    main()
