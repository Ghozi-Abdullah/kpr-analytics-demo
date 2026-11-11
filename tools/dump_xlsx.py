import json
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import config
from io_utils import resolve_sheet

def cell(v):
    if v is None:
        return ""
    if isinstance(v, datetime):
        return {"$d": v.isoformat()}
    if isinstance(v, date):
        return {"$d": datetime(v.year, v.month, v.day).isoformat()}
    return v

def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    allow = {"performance": config.PERFORMANCE_COLUMNS, "kuadran": config.KUADRAN_COLUMNS,
             "portfolio": config.PORTFOLIO_COLUMNS, "realisasi": config.REALISASI_COLUMNS, "sla": config.SLA_COLUMNS}
    for name, spec in config.SOURCES.items():
        path = config.RAW_DIR / f"{spec['file']}.xlsx"
        stale = out / f"{name}.json"
        if not path.exists() and spec.get("optional"):
            if stale.exists():
                stale.unlink()
            continue
        sheet, _ = resolve_sheet(path, spec["sheet"], allow[name])
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb[sheet]
        values = [[cell(v) for v in row] for row in ws.iter_rows(values_only=True)]
        (out / f"{name}.json").write_text(json.dumps({"file": path.name, "sheet": sheet, "values": values}), encoding="utf-8")
        print(f"{name}: {len(values)} baris")

if __name__ == "__main__":
    main()
