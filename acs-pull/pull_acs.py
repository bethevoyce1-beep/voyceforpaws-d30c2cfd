#!/usr/bin/env python3
"""
Voyce for Paws - ACS at-risk animal refresh.

Downloads the City of San Antonio ACS "Capacity for Euthanasia" PDF, parses the
at-risk animals, and upserts them into a Supabase table.

Safety design:
- Writes to TARGET_TABLE (default: acs_animals_staging) so the live table is
  never touched until the parse has been verified.
- Always records the raw PDF extraction into acs_pull_debug so the parse can be
  inspected from outside the CI runner.

Env vars:
  SUPABASE_URL                (required)
  SUPABASE_SERVICE_ROLE_KEY   (required)
  PDF_URL                     (default: ACS capacity euthanasia PDF)
  TARGET_TABLE                (default: acs_animals_staging)
  WRITE_DEBUG                 (default: true)
"""
import io
import json
import os
import re
import sys
from datetime import date, datetime, timezone

import requests
import pdfplumber


def _clean_url(raw):
    raw = (raw or "").strip().rstrip("/")
    if raw and not raw.startswith("http"):
        raw = "https://" + raw
    return raw


SUPABASE_URL = _clean_url(os.environ["SUPABASE_URL"])
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()
PDF_URL = os.environ.get(
    "PDF_URL", "https://www.sanantonio.gov/acs/ACS_website_euth_capacity.pdf"
)
TARGET_TABLE = os.environ.get("TARGET_TABLE", "acs_animals_staging")
WRITE_DEBUG = os.environ.get("WRITE_DEBUG", "true").lower() == "true"

REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

ID_RE = re.compile(r"^A\d{6,8}$")

# Map lowercased PDF header labels -> our acs_animals columns.
# Extra synonyms are harmless; unknown headers are ignored.
HEADER_MAP = {
    "animal id": "id", "animal #": "id", "animal": "id", "id": "id",
    "animal number": "id", "a#": "id",
    "name": "name", "pet name": "name",
    "kennel": "kennel", "location": "kennel", "cage": "kennel",
    "days": "days", "days in shelter": "days", "los": "days", "length of stay": "days",
    "breed": "breed", "primary breed": "breed", "type": "breed",
    "color": "color", "colour": "color",
    "sex": "sex", "gender": "sex",
    "age": "age_raw",
    "weight": "weight", "wt": "weight", "weight (lbs)": "weight",
    "due out": "due_out", "dueout": "due_out", "due out date": "due_out",
    "euth": "euth_date", "euth date": "euth_date", "euthanasia date": "euth_date",
    "heartworm": "heartworm", "hw": "heartworm", "hw status": "heartworm",
}


def log(*a):
    print(*a, flush=True)


def norm(s):
    if s is None:
        return None
    s = str(s).replace("\n", " ").strip()
    return s or None


def to_int(s):
    s = norm(s)
    if not s:
        return None
    m = re.search(r"-?\d+", s.replace(",", ""))
    return int(m.group()) if m else None


def parse_date_iso(s):
    """Return YYYY-MM-DD for a date-like string, else None."""
    s = norm(s)
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    m = re.search(r"(\d{1,2}/\d{1,2}/\d{2,4})", s)
    if m:
        return parse_date_iso(m.group(1))
    return None


def short_age(age_raw):
    """'2 Years and 1 Month' -> '2y 1m'; '7 Months' -> '7m'."""
    if not age_raw:
        return None
    yrs = re.search(r"(\d+)\s*year", age_raw, re.I)
    mos = re.search(r"(\d+)\s*month", age_raw, re.I)
    wks = re.search(r"(\d+)\s*week", age_raw, re.I)
    parts = []
    if yrs:
        parts.append(f"{yrs.group(1)}y")
    if mos:
        parts.append(f"{mos.group(1)}m")
    if wks and not parts:
        parts.append(f"{wks.group(1)}w")
    return " ".join(parts) or None


def fetch_pdf(url):
    log(f"Fetching PDF: {url}")
    r = requests.get(url, timeout=60, headers={"User-Agent": "VoyceForPaws-ACS/1.0"})
    r.raise_for_status()
    log(f"  {len(r.content)} bytes, content-type={r.headers.get('content-type')}")
    return r.content


def extract(pdf_bytes):
    """Return (full_text, tables, page_count)."""
    texts = []
    tables = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for pi, page in enumerate(pdf.pages):
            texts.append(page.extract_text() or "")
            for t in (page.extract_tables() or []):
                tables.append({"page": pi, "rows": t})
    return "\n".join(texts), tables, page_count


def build_header(row):
    """Given a table row (list of cells), return {col_index: our_col} if it looks
    like a header, else None."""
    mapping = {}
    for i, cell in enumerate(row):
        key = norm(cell)
        if not key:
            continue
        col = HEADER_MAP.get(key.lower())
        if col:
            mapping[i] = col
    if "id" in mapping.values() and len(mapping) >= 3:
        return mapping
    return None


def parse_rows(tables):
    """Header-driven parse across all tables. Returns list of row dicts."""
    out = {}
    for tbl in tables:
        rows = tbl["rows"]
        header = None
        for row in rows:
            if header is None:
                header = build_header(row)
                continue
            rec = {}
            for i, our_col in header.items():
                if i < len(row):
                    rec[our_col] = norm(row[i])
            aid = rec.get("id")
            if not aid or not ID_RE.match(aid):
                continue
            out[aid] = finalize(rec)
    return list(out.values())


def finalize(rec):
    today = date.today().isoformat()
    age_raw = rec.get("age_raw")
    out = {
        "id": rec["id"],
        "list_date": today,
        "status": "AT RISK",
        "status_key": "atrisk",
        "name": (rec.get("name") or "").upper() or None,
        "breed": (rec.get("breed") or "").upper() or None,
        "color": (rec.get("color") or "").upper() or None,
        "age": short_age(age_raw),
        "age_raw": age_raw,
        "sex": (rec.get("sex") or "").upper()[:1] or None,
        "weight": to_int(rec.get("weight")),
        "kennel": rec.get("kennel"),
        "days": to_int(rec.get("days")),
        "risk_since": today,
        "euth_date": rec.get("euth_date"),
        "due_out": parse_date_iso(rec.get("due_out")),
        "heartworm": rec.get("heartworm"),
        "pet_search_url": f"https://webapp1.sanantonio.gov/PetSearch/Default.aspx?id={rec['id']}",
        "list_url": PDF_URL,
    }
    return out


def supabase_upsert(rows):
    if not rows:
        return 0
    url = f"{REST}/{TARGET_TABLE}?on_conflict=id"
    headers = dict(HEADERS)
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    total = 0
    for i in range(0, len(rows), 200):
        chunk = rows[i : i + 200]
        r = requests.post(url, headers=headers, data=json.dumps(chunk), timeout=60)
        if r.status_code >= 300:
            log(f"UPSERT ERROR {r.status_code}: {r.text[:500]}")
            r.raise_for_status()
        total += len(chunk)
    return total


def write_debug(pdf_url, page_count, parsed_rows, raw_text, tables, notes):
    if not WRITE_DEBUG:
        return
    payload = [{
        "pdf_url": pdf_url,
        "page_count": page_count,
        "parsed_rows": parsed_rows,
        "raw_text": raw_text[:60000],
        "tables_json": tables[:40],
        "notes": notes,
    }]
    try:
        r = requests.post(
            f"{REST}/acs_pull_debug",
            headers={**HEADERS, "Prefer": "return=minimal"},
            data=json.dumps(payload),
            timeout=60,
        )
        if r.status_code >= 300:
            log(f"DEBUG WRITE ERROR {r.status_code}: {r.text[:300]}")
        else:
            log("Debug row written to acs_pull_debug")
    except Exception as e:  # never let debug crash the run
        log(f"DEBUG WRITE EXCEPTION: {e}")


def main():
    started = datetime.now(timezone.utc).isoformat()
    log(f"SUPABASE_URL resolved host present: {bool(SUPABASE_URL)} | target={TARGET_TABLE}")
    pdf_bytes = fetch_pdf(PDF_URL)
    raw_text, tables, page_count = extract(pdf_bytes)
    log(f"Extracted {page_count} pages, {len(tables)} table blocks, "
        f"{len(raw_text)} chars of text")
    rows = parse_rows(tables)
    log(f"Parsed {len(rows)} animal rows")
    if rows[:2]:
        log("Sample:", json.dumps(rows[:2], indent=2))
    notes = f"run={started} target={TARGET_TABLE}"
    write_debug(PDF_URL, page_count, len(rows), raw_text, tables, notes)
    n = supabase_upsert(rows)
    log(f"Upserted {n} rows into {TARGET_TABLE}")
    if not rows:
        log("WARNING: 0 rows parsed. Check acs_pull_debug for raw layout.")
        sys.exit(0)


if __name__ == "__main__":
    main()
