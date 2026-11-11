from __future__ import annotations

import shutil
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

import checks
import config
from io_utils import (PipelineError, canonical_ro, clean_text, days_between, encode_table, find_source_file,
                      name_key, read_source, require, to_date, to_days, to_month, to_num, write_json)
import sla_sample

LOG: list[str] = []
REFS: dict = {"ro": [], "kanca": [], "real_pairs": [], "last_date": None}

def add_refs(ros, pairs) -> None:
    ok_text = lambda v: isinstance(v, str) and v != ""
    REFS["ro"].extend(r for r in ros if ok_text(r) and r != "Nasional")
    REFS["kanca"].extend((k, r) for k, r in pairs if ok_text(k) and ok_text(r))

def log(msg: str = "") -> None:
    print(msg)
    LOG.append(msg)

def text_cols(df: pd.DataFrame, cols: list[str]) -> None:
    for c in cols:
        if c in df.columns:
            df[c] = df[c].map(clean_text)

def drop_invalid(df: pd.DataFrame, cols: list[str], name: str) -> pd.DataFrame:
    mask = df[cols].notna().all(axis=1)
    bad = int((~mask).sum())
    if bad:
        log(f"  ! {name}: {bad} baris dibuang karena {', '.join(cols)} kosong/tidak terbaca")
    return df[mask].copy()

def build_performance(out: Path, meta: dict) -> None:
    df, info = read_source("performance", config.PERFORMANCE_COLUMNS, config.PERFORMANCE_REQUIRED)
    note = info.pop("note", "")
    if note:
        log(f"  ! {note}")
    require(df, config.PERFORMANCE_REQUIRED, "performance", config.PERFORMANCE_COLUMNS)
    df["tanggal"] = to_date(df["tanggal"])
    df["ro"] = df["ro"].map(canonical_ro)
    df = drop_invalid(df, ["tanggal", "ro"], "performance")
    num_cols = [c for c in df.columns if c not in ("tanggal", "ro")]
    for c in num_cols:
        df[c] = to_num(df[c])

    day = pd.to_numeric(df["tanggal"].str[8:10], errors="coerce")
    no_os = df["os"].isna() if "os" in df.columns else pd.Series(False, index=df.index)
    off_day = (df["hari"].notna() & (df["hari"] != day)) if "hari" in df.columns else pd.Series(False, index=df.index)
    df = df.assign(_no_os=no_os.astype(int), _off_day=off_day.astype(int), _pos=range(len(df)))
    df = df.sort_values(["tanggal", "ro", "_no_os", "_off_day", "_pos"], kind="stable")
    dup = df.duplicated(["tanggal", "ro"], keep="first")
    if dup.any():
        log(f"  ! performance: {int(dup.sum())} baris tambahan dengan tanggal + RO sama diabaikan "
            f"(dipakai baris yang berisi OS, mis. baris bantu tanggal 31)")
        df = df[~dup]
    df = df.drop(columns=["_no_os", "_off_day", "_pos"]).reset_index(drop=True)

    size = write_json(out / "perf_daily.json", encode_table(df, ["tanggal", "ro"], digits=6))
    ros = sorted(df["ro"].unique().tolist())
    meta["datasets"]["performance"] = {
        **info, "rows_out": int(len(df)), "bytes": size,
        "min_date": df["tanggal"].min(), "max_date": df["tanggal"].max(),
        "has_nasional": "Nasional" in ros,
    }
    meta["ro"]["performance"] = ros
    add_refs(ros, [])
    log(f"  performance : {info['rows_in']:>7} baris -> {len(df):>6} baris  "
        f"({df['tanggal'].min()} s.d. {df['tanggal'].max()}, {len(ros)} RO)")

def build_kuadran(out: Path, meta: dict) -> None:
    df, info = read_source("kuadran", config.KUADRAN_COLUMNS, config.KUADRAN_REQUIRED)
    note = info.pop("note", "")
    if note:
        log(f"  ! {note}")
    require(df, config.KUADRAN_REQUIRED, "kuadran", config.KUADRAN_COLUMNS)
    df["tanggal"] = to_date(df["tanggal"])
    df["ro"] = df["ro"].map(canonical_ro)
    text_cols(df, ["kuadran"])
    df = drop_invalid(df, ["tanggal", "ro", "kuadran"], "kuadran")
    for c in ("jumlah_rm", "jumlah_rm_lalu"):
        if c in df.columns:
            df[c] = to_num(df[c])
    agg = df.groupby(["tanggal", "ro", "kuadran"], as_index=False).sum(numeric_only=True)
    size = write_json(out / "perf_kuadran.json", encode_table(agg, ["tanggal", "ro", "kuadran"]))
    meta["datasets"]["kuadran"] = {
        **info, "rows_out": int(len(agg)), "bytes": size,
        "min_date": agg["tanggal"].min(), "max_date": agg["tanggal"].max(),
        "kuadran": sorted(agg["kuadran"].unique().tolist()),
    }
    log(f"  kuadran RM  : {info['rows_in']:>7} baris -> {len(agg):>6} baris")

def build_portfolio(out: Path, meta: dict, totals: dict) -> None:
    df, info = read_source("portfolio", config.PORTFOLIO_COLUMNS, config.PORTFOLIO_REQUIRED)
    note = info.pop("note", "")
    if note:
        log(f"  ! {note}")
    require(df, config.PORTFOLIO_REQUIRED, "portfolio", config.PORTFOLIO_COLUMNS)
    df["bulan"] = to_month(df["bulan"])
    df["ro"] = df["ro"].map(canonical_ro)
    text_cols(df, ["kanca", "kanca_fix", "kode_kc", "produk", "tujuan", "tier",
                   "jenis_pendapatan", "kolek", "kategori_os", "kategori_deb"])
    if "kanca_fix" in df.columns:
        base = df["kanca"] if "kanca" in df.columns else None
        df["kanca"] = df["kanca_fix"].where(df["kanca_fix"].notna(), base)
    for c in ("os_rp", "debitur", "no"):
        if c in df.columns:
            df[c] = to_num(df[c])
    df = drop_invalid(df, ["bulan", "ro"], "portfolio")
    grain = [c for c in config.PORTFOLIO_GRAIN if c in df.columns]
    for c in grain:
        df[c] = df[c].fillna("")

    parts, kategori = [], {}
    measures = [("os", "kategori_os", "os_rp"), ("deb", "kategori_deb", "debitur")]
    for code, kat_col, val_col in measures:
        if kat_col not in df.columns or val_col not in df.columns:
            continue
        sub = df[df[kat_col].notna() & df[val_col].notna()].copy()
        if sub.empty:
            continue
        order = (sub.groupby(kat_col)["no"].min() if "no" in sub.columns
                 else pd.Series(range(sub[kat_col].nunique()), index=sorted(sub[kat_col].unique())))
        order = order.fillna(999).sort_values(kind="stable")
        kategori[code] = [[k, None if pd.isna(n) else float(n)] for k, n in order.items()]
        g = sub.groupby(grain + [kat_col], as_index=False)[val_col].sum()
        g = g.rename(columns={kat_col: "kat", val_col: "v"})
        g["m"] = code
        parts.append(g)
        totals.setdefault(f"portfolio {code}", {})
        for month, before in sub.groupby("bulan")[val_col].sum().items():
            after = g.loc[g["bulan"] == month, "v"].sum()
            totals[f"portfolio {code}"][month] = (float(before), float(after))
    if not parts:
        raise PipelineError("Portofolio: tidak ada baris dengan Kategori OS dan nilai Rp.")

    agg = pd.concat(parts, ignore_index=True)
    months = sorted(agg["bulan"].unique().tolist())
    total_bytes = 0
    (out / "portfolio").mkdir(parents=True, exist_ok=True)
    for month in months:
        part = agg[agg["bulan"] == month].drop(columns=["bulan"])
        cats = [c for c in part.columns if c not in ("v",)]
        total_bytes += write_json(out / "portfolio" / f"{month}.json", encode_table(part, cats))

    index = {"months": months, "kategori": kategori, "grain": grain}
    write_json(out / "portfolio_index.json", index)

    trend_grain = [c for c in grain if c != "kanca"] + ["kat", "m"]
    trend = agg.groupby(trend_grain, as_index=False)["v"].sum()
    write_json(out / "portfolio_trend.json", encode_table(trend, [c for c in trend_grain]))

    dim_cols = [c for c in ("kode_kc", "kanca", "ro") if c in df.columns]
    if "kanca" in df.columns:
        dim = df[dim_cols].dropna(subset=["kanca"]).drop_duplicates().sort_values(dim_cols)
    else:
        dim = df[dim_cols].iloc[0:0]
    write_json(out / "dim_kanca.json", encode_table(dim, dim_cols))

    ros = sorted(r for r in agg["ro"].unique().tolist() if r)
    meta["datasets"]["portfolio"] = {
        **info, "rows_out": int(len(agg)), "bytes": total_bytes,
        "min_month": months[0], "max_month": months[-1], "months": len(months),
    }
    meta["ro"]["portfolio"] = ros
    if "kanca" in dim.columns and "ro" in dim.columns:
        add_refs(ros, list(zip(dim["kanca"].tolist(), dim["ro"].tolist())))
    log(f"  portofolio  : {info['rows_in']:>7} baris -> {len(agg):>6} baris  "
        f"({months[0]} s.d. {months[-1]}, {len(months)} file bulanan)")

def build_realisasi(out: Path, meta: dict, totals: dict) -> None:
    df, info = read_source("realisasi", config.REALISASI_COLUMNS, config.REALISASI_REQUIRED)
    note = info.pop("note", "")
    if note:
        log(f"  ! {note}")
    require(df, config.REALISASI_REQUIRED, "realisasi", config.REALISASI_COLUMNS)
    df["tanggal"] = to_date(df["tanggal"])
    df["ro"] = df["ro"].map(canonical_ro)
    text_cols(df, ["kanca", "rm", "tipe", "sumber5", "sumber6", "tujuan", "dev_local_champion"])
    df["plafond"] = to_num(df["plafond"])
    if "debitur" in df.columns:
        df["debitur"] = to_num(df["debitur"])
        blank = int(df["debitur"].isna().sum())
        if blank:
            log(f"  ! realisasi: {blank} baris tanpa Debitur Count, dihitung 1 debitur per baris")
        df["debitur"] = df["debitur"].fillna(1)
    else:
        df["debitur"] = 1.0
    df = drop_invalid(df, ["tanggal", "ro", "tipe"], "realisasi")
    df["plafond"] = df["plafond"].fillna(0)
    grain = [c for c in config.REALISASI_GRAIN if c in df.columns]
    for c in grain:
        df[c] = df[c].fillna("")

    agg = df.groupby(grain, as_index=False)[["plafond", "debitur"]].sum()
    agg = agg.sort_values(grain).reset_index(drop=True)
    totals["realisasi plafond"] = {}
    df["_m"] = df["tanggal"].str[:7]
    agg["_m"] = agg["tanggal"].str[:7]
    for month, before in df.groupby("_m")["plafond"].sum().items():
        totals["realisasi plafond"][month] = (float(before), float(agg.loc[agg["_m"] == month, "plafond"].sum()))
    agg = agg.drop(columns=["_m"])

    size = write_json(out / "realisasi_daily.json", encode_table(agg, grain, digits=2))
    ros = sorted(r for r in agg["ro"].unique().tolist() if r)
    meta["datasets"]["realisasi"] = {
        **info, "rows_out": int(len(agg)), "bytes": size,
        "min_date": agg["tanggal"].min(), "max_date": agg["tanggal"].max(),
        "tipe": sorted(agg["tipe"].unique().tolist()),
    }
    meta["ro"]["realisasi"] = ros
    REFS["last_date"] = agg["tanggal"].max()
    pairs = agg[["kanca", "ro"]].drop_duplicates() if "kanca" in agg.columns else agg[["ro"]].assign(kanca="")
    REFS["real_pairs"] = [(k, r) for k, r in zip(pairs["kanca"].tolist(), pairs["ro"].tolist())
                          if isinstance(k, str) and k and isinstance(r, str) and r]
    REFS["kanca"][:0] = REFS["real_pairs"]
    REFS["ro"][:0] = ros
    log(f"  realisasi   : {info['rows_in']:>7} baris -> {len(agg):>6} baris  "
        f"({agg['tanggal'].min()} s.d. {agg['tanggal'].max()})")

def stage_age(row) -> float:
    spec = config.SLA_STAGE_AGE.get((row.get("proses") or "").lower())
    if not spec:
        return -1.0
    delta = row.get(spec[0])
    if delta is not None and not pd.isna(delta):
        return float(delta)
    span = days_between(row.get(spec[1]), row.get("today"))
    return -1.0 if pd.isna(span) else span

def done_days(row) -> float:
    end = config.SLA_DONE_END.get((row.get("proses") or "").lower())
    return days_between(row.get("tgl_prakarsa"), row.get(end)) if end else float("nan")

def sample_sla() -> tuple[pd.DataFrame, dict] | tuple[None, None]:
    pairs = sorted({(r, k) for k, r in (REFS["real_pairs"] or REFS["kanca"])})
    if not pairs:
        pairs = sorted({(r, f"Kanca {r}") for r in REFS["ro"]})
    if not pairs:
        return None, None
    last = REFS["last_date"]
    today = datetime.strptime(last, "%Y-%m-%d").date() if last else datetime.now().date()
    rows = sla_sample.simulate(pairs, today)
    cols = list(config.SLA_COLUMNS.values())
    df = pd.DataFrame([{c: r.get(c) for c in cols} for r in rows])
    for c in ("tgl_prakarsa", "tgl_clf_awal", "tgl_putusan", "tgl_cair", "today"):
        df[c] = df[c].map(lambda d: d.isoformat() if d else None)
    info = {"file": "data contoh (sla.xlsx belum ada)", "sheet": "-", "header_row": 0, "rows_in": int(len(df)),
            "columns_kept": cols, "columns_dropped": [], "sample": True}
    return df, info

def align_names(df: pd.DataFrame) -> tuple[int, int, int, int]:
    ro_map: dict[str, str] = {}
    for r in REFS["ro"]:
        if name_key(r):
            ro_map.setdefault(name_key(r), r)
    kanca_map: dict[str, tuple[str, str]] = {}
    for k, r in REFS["kanca"]:
        if name_key(k):
            kanca_map.setdefault(name_key(k), (k, r))
    ro_hit = kanca_hit = 0
    ro_total = int(df["ro"].nunique())
    kanca_total = int(df["kanca"].nunique()) if "kanca" in df.columns else 0
    ro_new = {}
    for v in df["ro"].dropna().unique().tolist():
        hit = ro_map.get(name_key(v))
        ro_new[v] = hit or v
        ro_hit += bool(hit)
    df["ro"] = df["ro"].map(lambda v: ro_new.get(v, v))
    if "kanca" in df.columns:
        kanca_new = {}
        for v in df["kanca"].dropna().unique().tolist():
            hit = kanca_map.get(name_key(v))
            kanca_new[v] = hit
            kanca_hit += bool(hit)
        matched = df["kanca"].map(lambda v: kanca_new.get(v))
        df["ro"] = [m[1] if m else r for m, r in zip(matched, df["ro"])]
        df["kanca"] = [m[0] if m else k for m, k in zip(matched, df["kanca"])]
    return ro_hit, ro_total, kanca_hit, kanca_total

def sla_daily(df: pd.DataFrame) -> pd.DataFrame:
    grain = [c for c in config.SLA_DAILY_GRAIN if c in df.columns or c in ("tanggal", "tahap")]
    keep = df[~df["proses"].str.lower().isin(config.SLA_DAILY_SKIP)]
    parts = []
    for tahap, (date_col, nominal_col) in config.SLA_DAILY_EVENTS.items():
        if date_col not in keep.columns:
            continue
        part = keep[keep[date_col].notna() & (keep[date_col] != "")]
        frame = part[[c for c in grain if c not in ("tanggal", "tahap")]].copy()
        frame["tanggal"] = part[date_col]
        frame["tahap"] = tahap
        frame["berkas"] = 1.0
        frame["nominal"] = part[nominal_col] if nominal_col in part.columns else 0.0
        parts.append(frame)
    if not parts:
        return pd.DataFrame(columns=grain + ["berkas", "nominal"])
    events = pd.concat(parts, ignore_index=True)
    return events.groupby(grain, as_index=False)[["berkas", "nominal"]].sum().sort_values(grain).reset_index(drop=True)

def build_sla(out: Path, meta: dict, totals: dict) -> None:
    try:
        find_source_file("sla")
        has_file = True
    except PipelineError:
        has_file = False
    if has_file:
        df, info = read_source("sla", config.SLA_COLUMNS, config.SLA_REQUIRED)
        note = info.pop("note", "")
        if note:
            log(f"  ! {note}")
        require(df, config.SLA_REQUIRED, "sla", config.SLA_COLUMNS)
    else:
        df, info = sample_sla()
        if df is None:
            log("  sla         : sla.xlsx belum ada dan tidak ada RO/kanca untuk data contoh, halaman SLA dilewati")
            return
        log("  sla         : sla.xlsx belum ada, dipakai DATA CONTOH dengan RO dan kanca dari dashboard lain")
    df["ro"] = df["ro"].map(canonical_ro)
    if "kanca" in df.columns:
        df["kanca"] = df["kanca"].map(clean_text)
    if has_file:
        ro_hit, ro_total, kanca_hit, kanca_total = align_names(df)
        log(f"  sla         : nama disamakan dengan dashboard lain: {ro_hit} dari {ro_total} RO, {kanca_hit} dari {kanca_total} kanca")
    text_cols(df, ["kanca", "proses", "pendapatan", "putusan", "jenis_kpr", "crs", "pekerjaan", "type"])
    for c in ("tgl_prakarsa", "tgl_clf_awal", "tgl_putusan", "tgl_cair", "today"):
        if c in df.columns:
            df[c] = to_date(df[c])
    for c in ("delta_prakarsa", "delta_analisa", "delta_putusan"):
        if c in df.columns:
            df[c] = to_days(df[c])
    for c in ("nominal_pengajuan", "nominal_cair"):
        df[c] = to_num(df[c]).fillna(0) if c in df.columns else 0.0
    df = drop_invalid(df, ["ro", "proses"], "sla")
    records = df.to_dict("records")
    df["umur"] = [stage_age(r) for r in records]
    lama = [done_days(r) for r in records]
    df["lama_sum"] = [0.0 if pd.isna(v) else v for v in lama]
    df["lama_n"] = [0.0 if pd.isna(v) else 1.0 for v in lama]
    df["lama_val"] = [float("nan") if pd.isna(v) else float(v) for v in lama]
    df["bulan"] = df["tgl_prakarsa"].str[:7] if "tgl_prakarsa" in df.columns else None
    df["berkas"] = 1.0
    grain = [c for c in config.SLA_GRAIN if c in df.columns]
    for c in grain:
        if c != "umur":
            df[c] = df[c].fillna("")
    values = ["berkas", "nominal_pengajuan", "nominal_cair", "lama_sum", "lama_n"]
    grouped = df.groupby(grain, as_index=False)
    agg = grouped[values].sum()
    extent = grouped["lama_val"].agg(lama_min="min", lama_max="max")
    agg = agg.merge(extent, on=grain, how="left").sort_values(grain).reset_index(drop=True)
    totals["sla nominal pengajuan"] = {}
    for proses, before in df.groupby("proses")["nominal_pengajuan"].sum().items():
        totals["sla nominal pengajuan"][proses or "-"] = (float(before), float(agg.loc[agg["proses"] == proses, "nominal_pengajuan"].sum()))
    dates = [d for c in ("today", "tgl_cair", "tgl_putusan", "tgl_prakarsa") if c in df.columns for d in df[c].dropna().tolist()]
    snapshot = max(df["today"].dropna().tolist()) if "today" in df.columns and df["today"].notna().any() else (max(dates) if dates else None)
    size = write_json(out / "sla.json", encode_table(agg, [c for c in grain if c != "umur"], digits=2))
    daily = sla_daily(df)
    daily_size = write_json(out / "sla_daily.json", encode_table(daily, [c for c in config.SLA_DAILY_GRAIN if c in daily.columns], digits=2))
    months = sorted(m for m in agg["bulan"].unique().tolist() if m) if "bulan" in agg.columns else []
    meta["datasets"]["sla"] = {
        **info, "sample": bool(info.get("sample")), "rows_out": int(len(agg)), "bytes": size, "snapshot": snapshot,
        "min_month": months[0] if months else None, "max_month": months[-1] if months else None,
        "proses": sorted(agg["proses"].unique().tolist()),
        "daily_rows": int(len(daily)), "daily_bytes": daily_size,
        "daily_min": daily["tanggal"].min() if len(daily) else None, "daily_max": daily["tanggal"].max() if len(daily) else None,
    }
    log(f"  sla         : {info['rows_in']:>7} baris -> {len(agg):>6} baris  (posisi {snapshot or '-'})")

def ro_report(meta: dict) -> None:
    perf = set(meta["ro"].get("performance", [])) - {"Nasional"}
    for name in ("portfolio", "realisasi"):
        other = set(meta["ro"].get(name, []))
        if not other or not perf:
            continue
        only_other = sorted(other - perf)
        only_perf = sorted(perf - other)
        meta["ro_mismatch"][name] = {"tidak_ada_di_performance": only_other, "tidak_ada_di_" + name: only_perf}
        if only_other:
            log(f"  ! nama RO di {name} yang tidak ada di performance: {only_other}")

def main() -> int:
    started = time.time()
    REFS.update({"ro": [], "kanca": [], "real_pairs": [], "last_date": None})
    log("Membangun data dashboard KPR")
    log(f"  sumber : {config.RAW_DIR}")
    meta = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "is_dummy": (config.RAW_DIR / ".dummy").exists(),
        "datasets": {}, "ro": {}, "ro_mismatch": {},
    }
    totals: dict = {}

    with tempfile.TemporaryDirectory(prefix="kpr_build_") as tmp:
        out = Path(tmp)
        try:
            build_performance(out, meta)
            build_kuadran(out, meta)
            build_portfolio(out, meta, totals)
            build_realisasi(out, meta, totals)
            build_sla(out, meta, totals)
        except PipelineError as exc:
            log(f"\nGAGAL: {exc}")
            log("site/data/ tidak diubah.")
            return 1
        ro_report(meta)
        write_json(out / "meta.json", meta)

        log("\nMenjalankan pemeriksaan keamanan & total...")
        errors, notes = checks.run_all(out, totals)
        for n in notes:
            log(f"  info : {n}")
        if errors:
            log("GAGAL - output tidak dipakai karena:")
            for e in errors:
                log(f"  x {e}")
            log("site/data/ tidak diubah.")
            return 1
        log("  lulus: tidak ada data nasabah / field terlarang, total sebelum = sesudah agregasi")

        config.OUT_DIR.mkdir(parents=True, exist_ok=True)
        for item in config.OUT_DIR.iterdir():
            if item.name == ".gitkeep":
                continue
            shutil.rmtree(item) if item.is_dir() else item.unlink()
        for item in out.iterdir():
            shutil.move(str(item), config.OUT_DIR / item.name)

    if meta["is_dummy"]:
        log("\nCATATAN: data_raw/ berisi DATA DUMMY (file .dummy ada). Hapus file .dummy & ganti dengan export asli.")
    log(f"\nSelesai dalam {time.time() - started:.1f} detik. Data ada di site/data/.")
    log("Buka dashboard: klik 'Go Live' di status bar VS Code (atau refresh browser).")
    return 0

if __name__ == "__main__":
    sys.exit(main())
