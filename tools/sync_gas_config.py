import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))
import config as c

KEYS = ["PERFORMANCE_COLUMNS", "PERFORMANCE_REQUIRED", "KUADRAN_COLUMNS", "KUADRAN_REQUIRED",
        "PORTFOLIO_COLUMNS", "PORTFOLIO_REQUIRED", "PORTFOLIO_GRAIN", "REALISASI_COLUMNS",
        "REALISASI_REQUIRED", "REALISASI_GRAIN", "SLA_COLUMNS", "SLA_REQUIRED", "SLA_GRAIN", "SLA_STAGE_AGE",
        "SLA_DONE_END", "SLA_DAILY_EVENTS", "SLA_DAILY_GRAIN", "SLA_DAILY_SKIP", "SENSITIVE_SOURCE_COLUMNS", "CATEGORY_FIELDS", "FORBIDDEN_FIELD_PATTERNS",
        "LONG_DIGIT_PATTERN"]
target = ROOT / "gas" / "pipeline" / "Config.js"
text = target.read_text(encoding="utf-8")
head = text[: text.index("var KPR_CONFIG = ")]
body = json.dumps({k: getattr(c, k) for k in KEYS}, indent=2, ensure_ascii=False)
target.write_text(head + "var KPR_CONFIG = " + body + ";\n", encoding="utf-8")
print(f"Ditulis: {target.relative_to(ROOT)}")
