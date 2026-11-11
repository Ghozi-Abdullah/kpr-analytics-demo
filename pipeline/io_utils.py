from __future__ import annotations

import json
import math
import re
from datetime import date, datetime, timedelta
from datetime import time as dtime
from pathlib import Path

import pandas as pd

import config

MONTHS_ID = {
    "jan": 1, "januari": 1, "january": 1,
    "feb": 2, "februari": 2, "february": 2, "pebruari": 2,
    "mar": 3, "maret": 3, "march": 3,
    "apr": 4, "april": 4,
    "mei": 5, "may": 5,
    "jun": 6, "juni": 6, "june": 6,
    "jul": 7, "juli": 7, "july": 7,
    "agu": 8, "ags": 8, "agt": 8, "agustus": 8, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "okt": 10, "oct": 10, "oktober": 10, "october": 10,
    "nov": 11, "nop": 11, "november": 11, "nopember": 11,
    "des": 12, "dec": 12, "desember": 12, "december": 12,
}

class PipelineError(Exception):
    pass

def norm_header(value) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()

def dedupe_headers(headers: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for h in headers:
        key = h.lower()
        if key in seen:
            seen[key] += 1
            out.append(f"{h}.{seen[key]}")
        else:
            seen[key] = 0
            out.append(h)
    return out

def find_source_file(name: str) -> Path:
    spec = config.SOURCES[name]
    raw = config.RAW_DIR / spec["file"]
    candidates = [raw] if raw.suffix else [raw.with_suffix(".xlsx"), raw.with_suffix(".csv")]
    for path in candidates + [p.with_name(p.name + p.suffix) for p in candidates]:
        if path.exists():
            return path
    names = ", ".join(p.name for p in candidates)
    raise PipelineError(f"File sumber '{name}' tidak ditemukan di data_raw/ (dicari: {names}). "
                        f"Bila Windows menyembunyikan ekstensi, cukup ketik nama tanpa .xlsx saat mengganti nama.")

def _detect_header_row(frame: pd.DataFrame, known: set[str]) -> int:
    best_row, best_hits = 0, -1
    for i in range(min(15, len(frame))):
        cells = {norm_header(v).lower() for v in frame.iloc[i].tolist()}
        hits = len(cells & known)
        if hits > best_hits:
            best_row, best_hits = i, hits
    return best_row

def _sheet_key(name) -> str:
    return re.sub(r"\s+", " ", str(name)).strip().lower()

def _known_headers(allowlist: dict[str, str]) -> set[str]:
    return {k.lower() for k in allowlist} | {k.split(".")[0].lower() for k in allowlist}

def resolve_sheet(path: Path, wanted, allowlist: dict[str, str], required=()) -> tuple[str | None, str]:
    if path.suffix.lower() == ".csv":
        return None, ""
    book = pd.ExcelFile(path, engine="openpyxl")
    names = book.sheet_names
    if wanted is None:
        return names[0], ""
    for name in names:
        if wanted and _sheet_key(name) == _sheet_key(wanted):
            return name, ""
    known = _known_headers(allowlist)
    lookup = {k.lower(): v for k, v in allowlist.items()}
    best, best_hits = None, 0
    for name in names:
        head = book.parse(name, header=None, dtype=object, nrows=15)
        if head.empty:
            continue
        row = _detect_header_row(head, known)
        headers = dedupe_headers([norm_header(v) for v in head.iloc[row].tolist()])
        fields = {lookup[h.lower()] for h in headers if h.lower() in lookup}
        if all(r in fields for r in required) and len(fields) > best_hits:
            best, best_hits = name, len(fields)
    if best:
        return best, (f"sheet '{wanted}' tidak ada di {path.name}, dipakai sheet '{best}' yang kolomnya cocok" if wanted else "")
    if not wanted:
        raise PipelineError(f"Tidak ada sheet di {path.name} yang judul kolomnya cocok. Sheet yang ada: {', '.join(names)}.")
    raise PipelineError(f"Sheet '{wanted}' tidak ada di {path.name}. Sheet yang ada: {', '.join(names)}.")

_RAW_CACHE: dict[tuple, pd.DataFrame] = {}

def _load_raw(path: Path, sheet) -> pd.DataFrame:
    key = (str(path), sheet, path.stat().st_mtime)
    if key in _RAW_CACHE:
        return _RAW_CACHE[key]
    if path.suffix.lower() == ".csv":
        raw = pd.read_csv(path, header=None, dtype=object, keep_default_na=False,
                          na_values=["", "#N/A", "#DIV/0!", "#VALUE!", "#REF!", "-"])
    else:
        try:
            raw = pd.read_excel(path, sheet_name=sheet if sheet is not None else 0,
                                header=None, dtype=object, engine="openpyxl")
        except ValueError as exc:
            raise PipelineError(f"Sheet '{sheet}' tidak ada di {path.name}: {exc}") from exc
    _RAW_CACHE[key] = raw
    return raw

def read_source(name: str, allowlist: dict[str, str], required=()) -> tuple[pd.DataFrame, dict]:
    path = find_source_file(name)
    sheet, note = resolve_sheet(path, config.SOURCES[name]["sheet"], allowlist, required)
    raw = _load_raw(path, sheet)

    known = _known_headers(allowlist)
    header_row = _detect_header_row(raw, known)
    headers = dedupe_headers([norm_header(v) for v in raw.iloc[header_row].tolist()])
    body = raw.iloc[header_row + 1:].reset_index(drop=True)
    body.columns = headers

    lookup = {k.lower(): v for k, v in allowlist.items()}
    keep, dropped = {}, []
    for col in headers:
        std = lookup.get(col.lower())
        if std and std not in keep.values():
            keep[col] = std
        elif col:
            dropped.append(col)

    df = body[list(keep)].rename(columns=keep)
    blank = df.isna() | df.apply(lambda s: s.astype(str).str.strip().eq(""))
    df = df[~blank.all(axis=1)]
    info = {
        "file": path.name,
        "sheet": sheet or "(csv)",
        "note": note,
        "header_row": header_row + 1,
        "rows_in": int(len(df)),
        "columns_kept": list(keep.values()),
        "columns_dropped": dropped,
    }
    return df.reset_index(drop=True), info

def source_label(allowlist: dict[str, str], std: str) -> str:
    for header, field in allowlist.items():
        if field == std:
            return "Rp (kolom Rp yang kedua)" if header.lower() == "rp.1" else header
    return std

def require(df: pd.DataFrame, required: list[str], name: str, allowlist: dict[str, str]) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        labels = ", ".join(source_label(allowlist, c) for c in missing)
        raise PipelineError(
            f"Kolom wajib untuk '{name}' tidak ditemukan: {labels}. "
            f"Samakan judul kolom di file (huruf besar/kecil dan spasi tidak masalah) atau perbarui allowlist "
            f"di pipeline/config.py. Cek cepat tanpa memproses data: python pipeline/check_columns.py"
        )

def read_raw_column(name: str, column: str) -> list[str]:
    try:
        df, _ = read_source(name, {column: "__sensitive__"})
    except PipelineError:
        return []
    if "__sensitive__" not in df.columns:
        return []
    return [clean_text(v) for v in df["__sensitive__"].tolist() if clean_text(v)]

def clean_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None

_NAME_NOISE = re.compile(r"\b(kanwil|kantor wilayah|regional office|regional|region|ro|kcp|kc|kanca|kantor cabang|cabang|bri)\b")

def name_key(value) -> str:
    text = clean_text(value)
    if not text:
        return ""
    t = text.lower()
    t = re.sub(r"^\s*(region|regional|ro)\s*\d+\s*/\s*", "", t)
    t = re.sub(r"\(konsolidasi[^)]*\)", " ", t)
    t = re.sub(r"^\s*\d+\s*-+\s*", "", t)
    t = _NAME_NOISE.sub(" ", t)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()

def canonical_ro(value) -> str | None:
    text = clean_text(value)
    if text is None:
        return None
    if text.upper() == "NASIONAL":
        return "Nasional"
    return text

def _parse_number(value):
    if value is None:
        return math.nan
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if text == "" or text in {"-", "#N/A", "#DIV/0!", "#VALUE!", "#REF!", "null", "None"}:
        return math.nan
    pct = text.endswith("%")
    text = re.sub(r"(?i)rp|%|\s", "", text)
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()")
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".") if text.count(",") == 1 else text.replace(",", "")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+", text):
        text = text.replace(".", "")
    try:
        number = float(text)
    except ValueError:
        return math.nan
    if negative:
        number = -number
    return number / 100 if pct else number

def to_num(series: pd.Series) -> pd.Series:
    return series.map(_parse_number).astype(float)

def _parse_date(value):
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        if 20000 < value < 80000:
            return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
        return None
    text = str(value).strip()
    if not text:
        return None
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?", text)
    if m:
        return date(int(m[1]), int(m[2]), int(m[3]))
    m = re.fullmatch(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})", text)
    if m:
        year = int(m[3]) + (2000 if len(m[3]) == 2 else 0)
        return date(year, int(m[2]), int(m[1]))
    m = re.fullmatch(r"(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})", text)
    if m and m[2].lower() in MONTHS_ID:
        return date(int(m[3]), MONTHS_ID[m[2].lower()], int(m[1]))
    return None

def _parse_days(value):
    if value is None or isinstance(value, (bool, datetime, date, dtime, timedelta, pd.Timestamp)):
        return math.nan
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"-?\d+(?:[.,]\d+)?", str(value))
    return float(match.group(0).replace(",", ".")) if match else math.nan

def to_days(series: pd.Series) -> pd.Series:
    return series.map(_parse_days).astype(float)

def days_between(start, end):
    if not isinstance(start, str) or not isinstance(end, str) or not start or not end:
        return math.nan
    return float((date.fromisoformat(end) - date.fromisoformat(start)).days)

def to_date(series: pd.Series) -> pd.Series:
    return series.map(lambda v: (d.isoformat() if (d := _parse_date(v)) else None))

def _parse_month(value):
    d = _parse_date(value)
    if d:
        return f"{d.year:04d}-{d.month:02d}"
    text = clean_text(value)
    if not text:
        return None
    m = re.fullmatch(r"(\d{4})[-/](\d{1,2})", text)
    if m:
        return f"{int(m[1]):04d}-{int(m[2]):02d}"
    m = re.fullmatch(r"([A-Za-z]+)[\s\-']+(\d{2,4})", text)
    if m and m[1].lower() in MONTHS_ID:
        year = int(m[2]) + (2000 if len(m[2]) == 2 else 0)
        return f"{year:04d}-{MONTHS_ID[m[1].lower()]:02d}"
    return None

def to_month(series: pd.Series) -> pd.Series:
    return series.map(_parse_month)

def _clean_number(value, digits: int):
    if value is None:
        return None
    try:
        if math.isnan(value) or math.isinf(value):
            return None
    except TypeError:
        return value
    rounded = round(float(value), digits)
    return int(rounded) if rounded.is_integer() else rounded

def encode_table(df: pd.DataFrame, cat_cols: list[str], digits: int = 4) -> dict:
    fields = list(df.columns)
    dicts, columns = {}, []
    for col in fields:
        if col in cat_cols:
            values = df[col].fillna("").astype(str)
            uniques = sorted(values.unique().tolist())
            index = {v: i for i, v in enumerate(uniques)}
            dicts[col] = uniques
            columns.append(values.map(index).tolist())
        else:
            columns.append([_clean_number(v, digits) for v in df[col].tolist()])
    rows = [list(r) for r in zip(*columns)] if columns else []
    return {"fields": fields, "dicts": dicts, "rows": rows}

def write_json(path: Path, payload) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))
