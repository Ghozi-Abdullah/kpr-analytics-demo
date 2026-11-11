from __future__ import annotations

import sys

import pandas as pd

import config
from io_utils import PipelineError, _detect_header_row, dedupe_headers, find_source_file, norm_header, resolve_sheet

CHECKS = [
    ("performance", config.PERFORMANCE_COLUMNS, config.PERFORMANCE_REQUIRED),
    ("kuadran", config.KUADRAN_COLUMNS, config.KUADRAN_REQUIRED),
    ("portfolio", config.PORTFOLIO_COLUMNS, config.PORTFOLIO_REQUIRED),
    ("realisasi", config.REALISASI_COLUMNS, config.REALISASI_REQUIRED),
    ("sla", config.SLA_COLUMNS, config.SLA_REQUIRED),
]


def label(header: str) -> str:
    return "Rp (kolom Rp yang kedua)" if header.lower() == "rp.1" else header


def read_head(path, allowlist, required, wanted):
    if path.suffix.lower() == ".csv":
        frame = pd.read_csv(path, header=None, dtype=object, nrows=15, keep_default_na=False)
        return frame, None, ""
    sheet, note = resolve_sheet(path, wanted, allowlist, required)
    frame = pd.ExcelFile(path, engine="openpyxl").parse(sheet, header=None, dtype=object, nrows=15)
    return frame, sheet, note


def check(name: str, allowlist: dict[str, str], required: list[str]) -> bool:
    try:
        path = find_source_file(name)
    except PipelineError as exc:
        if config.SOURCES[name].get("optional"):
            print(f"\n{config.SOURCES[name]['file']}.xlsx")
            print("  INFO    belum ada (opsional). Halaman SLA memakai data contoh sampai file ini ditaruh di data_raw.")
            return True
        print(f"\n{config.SOURCES[name]['file']}.xlsx  (sheet \"{config.SOURCES[name]['sheet']}\")")
        print(f"  KURANG  {exc}")
        return False
    wanted = config.SOURCES[name]["sheet"]
    try:
        frame, sheet, note = read_head(path, allowlist, required, wanted)
    except PipelineError as exc:
        print(f"\n{path.name}" + (f"  (sheet \"{wanted}\")" if wanted else ""))
        print(f"  KURANG  {exc}")
        return False
    except Exception as exc:
        print(f"\n{path.name}")
        print(f"  KURANG  file tidak bisa dibaca: {exc}")
        return False
    known = {k.lower() for k in allowlist} | {k.split(".")[0].lower() for k in allowlist}
    row = _detect_header_row(frame, known)
    headers = dedupe_headers([norm_header(v) for v in frame.iloc[row].tolist()]) if len(frame) else []
    lookup = {k.lower(): (k, v) for k, v in allowlist.items()}
    found: dict[str, str] = {}
    ignored: list[str] = []
    for header in headers:
        hit = lookup.get(header.lower())
        if hit and hit[1] not in found:
            found[hit[1]] = hit[0]
        elif header:
            ignored.append(header)
    missing = [label(k) for k, v in allowlist.items() if v in required and v not in found]
    extra_found = [v for v in found if v not in required]
    extra_missing = [label(k) for k, v in allowlist.items() if v not in required and v not in found]
    sensitive = [h for h in ignored if h.lower() in {c.lower() for c in config.SENSITIVE_SOURCE_COLUMNS.get(name, [])}]

    where = f'sheet "{sheet}", ' if sheet else ""
    print(f"\n{path.name}  ({where}judul kolom di baris {row + 1})")
    if note:
        print(f"  INFO    {note}")
    if row > 0:
        print(f"  INFO    {row} baris di atas judul kolom dilewati")
    required_total = len(required)
    if missing:
        print(f"  KURANG  kolom wajib tidak ditemukan: {', '.join(missing)}")
    print(f"  {'OK    ' if not missing else 'CEK   '}  {required_total - len(missing)} dari {required_total} kolom wajib ada")
    print(f"  OK      {len(extra_found)} kolom tambahan dikenali")
    if extra_missing:
        print(f"  INFO    kolom tambahan yang tidak ada (boleh, panel terkait bisa kosong): {', '.join(extra_missing)}")
    if sensitive:
        print(f"  INFO    kolom data nasabah ({', '.join(sensitive)}) ada di file, tetapi tidak dibaca dan tidak masuk dashboard")
    rest = [h for h in ignored if h not in sensitive]
    if rest:
        print(f"  INFO    tidak dipakai (dibuang otomatis): {', '.join('Rp (kolom Rp yang pertama)' if h.lower() == 'rp' else h for h in rest)}")
    return not missing


def main() -> int:
    print(f"Cek judul kolom di {config.RAW_DIR}")
    print("Hanya membaca baris judul. Tidak ada data yang diproses atau disimpan.")
    results = [check(name, allowlist, required) for name, allowlist, required in CHECKS]
    print()
    if all(results):
        print("Hasil: semua file sesuai. Lanjut jalankan Refresh data dashboard (Ctrl+Shift+B).")
        return 0
    print("Hasil: ada yang perlu dibetulkan. Lihat baris KURANG di atas.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
