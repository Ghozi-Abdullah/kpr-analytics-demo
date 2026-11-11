from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import config
from io_utils import read_raw_column

FORBIDDEN_FIELD_RE = [re.compile(p, re.IGNORECASE) for p in config.FORBIDDEN_FIELD_PATTERNS]
CATEGORY_FIELDS = set(config.CATEGORY_FIELDS)
LONG_DIGIT_RE = re.compile(config.LONG_DIGIT_PATTERN)
EXTERNAL_REF_RE = re.compile(
    r"""src\s*=\s*["']\s*(?:https?:)?//|href\s*=\s*["']\s*(?!https://www\.flaticon\.com/uicons["'])(?:https?:)?//|"""
    r"""url\(\s*["']?\s*(?:https?:)?//|"""
    r"""(?:fetch|import)\s*\(\s*["'`]\s*(?:https?:)?//|@import\s+["']?\s*(?:https?:)?//""",
    re.IGNORECASE,
)

def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().upper()

def _walk(node, on_key, on_str, path="$"):
    if isinstance(node, dict):
        for k, v in node.items():
            on_key(str(k), path)
            _walk(v, on_key, on_str, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _walk(v, on_key, on_str, f"{path}[{i}]")
    elif isinstance(node, str):
        on_str(node, path)

def check_output_files(out_dir: Path, sensitive: set[str], allowed_overlap: set[str]) -> tuple[list[str], list[str]]:
    errors, notes = [], []
    files = sorted(out_dir.rglob("*.json"))
    if not files:
        errors.append(f"Tidak ada file JSON di {out_dir}.")
        return errors, notes

    for file in files:
        rel = file.relative_to(out_dir)
        data = json.loads(file.read_text(encoding="utf-8"))
        field_names: list[str] = []

        def on_key(key, _path):
            field_names.append(key)

        hits_sensitive: dict[str, set[str]] = {}
        hits_category: dict[str, set[str]] = {}
        hits_overlap: set[str] = set()
        hits_digits: set[str] = set()

        def on_str(text, path):
            if re.search(r"\.fields\[\d+\]$", path):
                field_names.append(text)
            if path.endswith(".generated_at"):
                return
            key = _norm(text)
            if key in sensitive:
                found = re.search(r"\.dicts\.([A-Za-z0-9_]+)\[\d+\]$", path)
                field = found.group(1) if found else path
                if key in allowed_overlap:
                    hits_overlap.add(text)
                elif field in CATEGORY_FIELDS:
                    hits_category.setdefault(field, set()).add(text)
                else:
                    hits_sensitive.setdefault(field, set()).add(text)
            if LONG_DIGIT_RE.search(text.replace("-", "").replace(".", "")) and not re.fullmatch(r"\d{4}-\d{2}(-\d{2})?", text):
                hits_digits.add(text)

        _walk(data, on_key, on_str)

        for name in set(field_names):
            for rx in FORBIDDEN_FIELD_RE:
                if rx.search(name):
                    errors.append(f"{rel}: nama field terlarang '{name}' (pola {rx.pattern}).")
        if hits_sensitive:
            count = sum(len(v) for v in hits_sensitive.values())
            errors.append(f"{rel}: {count} nilai dari kolom data nasabah ikut terbawa ke output "
                          f"(di kolom {', '.join(sorted(hits_sensitive))}).")
        if hits_category:
            count = sum(len(v) for v in hits_category.values())
            notes.append(f"{rel}: {count} isi kategori di kolom {', '.join(sorted(hits_category))} kebetulan sama dengan "
                         f"isi kolom Nama Debitur (dibiarkan, karena itu nama kategori, bukan nama orang).")
        if hits_overlap:
            notes.append(f"{rel}: {len(hits_overlap)} nama RM kebetulan sama dengan nama debitur (dibiarkan, karena memang nama RM).")
        if hits_digits:
            errors.append(f"{rel}: {len(hits_digits)} teks berisi angka panjang (>=10 digit), mirip nomor rekening/NIK.")
    return errors, notes

def check_site_has_no_external_refs() -> list[str]:
    errors = []
    for file in config.SITE_DIR.rglob("*"):
        if file.suffix.lower() not in {".html", ".js", ".css"}:
            continue
        if "lib" in file.relative_to(config.SITE_DIR).parts or "data" in file.relative_to(config.SITE_DIR).parts:
            continue
        text = file.read_text(encoding="utf-8", errors="ignore")
        for m in EXTERNAL_REF_RE.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            errors.append(f"{file.relative_to(config.ROOT)}:{line} memuat resource dari luar ({m.group(0)!r}).")
    return errors

def check_layout() -> list[str]:
    errors = []
    raw = config.RAW_DIR.resolve()
    site = config.SITE_DIR.resolve()
    if site in raw.parents or raw == site:
        errors.append("Folder data_raw berada di dalam folder site/ sehingga bisa dibuka lewat browser.")
    return errors

def check_totals(totals: dict) -> list[str]:
    errors = []
    for dataset, periods in totals.items():
        for period, (before, after) in periods.items():
            tolerance = max(1e-6, abs(before) * 1e-9)
            if abs(before - after) > tolerance:
                errors.append(f"{dataset} {period}: total berubah setelah agregasi ({before} -> {after}).")
    return errors

def load_sensitive_values() -> tuple[set[str], set[str]]:
    sensitive: set[str] = set()
    for source, columns in config.SENSITIVE_SOURCE_COLUMNS.items():
        for column in columns:
            sensitive |= {_norm(v) for v in read_raw_column(source, column)}
    overlap = {_norm(v) for v in read_raw_column("realisasi", "Nama RM")}
    return sensitive, overlap & sensitive

def run_all(out_dir: Path, totals: dict | None = None, sensitive=None, overlap=None) -> tuple[list[str], list[str]]:
    if sensitive is None or overlap is None:
        sensitive, overlap = load_sensitive_values()
    errors, notes = check_output_files(out_dir, sensitive, overlap)
    errors += check_site_has_no_external_refs()
    errors += check_layout()
    if totals:
        errors += check_totals(totals)
    return errors, notes

def main() -> int:
    errors, notes = run_all(config.OUT_DIR)
    for n in notes:
        print(f"  info : {n}")
    if errors:
        print("GAGAL - ditemukan masalah:")
        for e in errors:
            print(f"  x {e}")
        return 1
    print("LULUS - tidak ada data nasabah, field terlarang, atau resource dari luar.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
