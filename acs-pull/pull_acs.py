#!/usr/bin/env python3
"""
Voyce for Paws - ACS at-risk animal refresh.

Downloads the City of San Antonio ACS "Capacity Euthanasia List" PDF, parses the
at-risk animals, and upserts them into a Supabase table.

The PDF is a per-animal narrative layout (not a grid). Each animal block looks
like:

    A790268 Due to kennel capacity this pet will be
    Animal ID Due Out Date Kennel
    euthanized on 07/09/2026 without confirmed
    A790268 07/02/2026 S4030 placement
    (F) Estimated Age 2 Years and 6 Months, BLACK / WHITE, RETRIEVER / BLEND DOG
    Size Days At Shelter At Risk Since        (or: Weight Days At Shelter ...)
    MED 12 2026-07-07                          (or: 65 52 2026-07-07)
    SHELBY
    Evaluation Notes:
    ...notes...

Safety design:
- Writes to TARGET_TABLE (default: acs_animals_staging) so the live table is
  never touched until the parse has been verified.
- Always records the raw PDF extraction into acs_pull_debug.

Env vars:
  SUPABASE_URL                (optional; host auto-detected/fixed)
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

DEFAULT_SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co"


def _clean_url(raw):
    raw = (raw or "").strip()
    m = re.search(r"([a-z0-9-]+\.supabase\.co)", raw, re.I)
    return f"https://{m.group(1)}" if m else DEFAULT_SUPABASE_URL


SUPABASE_URL = _clean_url(os.environ.get("SUPABASE_URL", ""))
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

SPECIES = {
    "DOG", "CAT", "PUPPY", "KITTEN", "RABBIT", "BIRD", "OTHER", "LIVESTOCK",
    "REPTILE", "FERRET", "HAMSTER", "GUINEA", "PIG", "HORSE", "GOAT",
}

DEMO_RE = re.compile(r"^\(([A-Z])\)\s*Estimated Age\s+(.*)$")
VAL_RE = re.compile(r"^(A\d{6,8})\s+(\d{1,2}/\d{1,2}/\d{4})\s+(\S+)")
ID_RE = re.compile(r"\b(A\d{6,8})\b")
EUTH_RE = re.compile(r"euthanized on\s+(\d{1,2}/\d{1,2}/\d{4})", re.I)
SIZEHDR_RE = re.compile(r"^(Size|Weight)\s+Days At Shelter\s+At Risk Since", re.I)


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
    """'2 Years and 6 Months' -> '2y 6m'; '7 Months' -> '7m'."""
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


def split_demo(rest):
    """'2 Years and 6 Months, BLACK / WHITE, RETRIEVER / BLEND DOG'
    -> (age_raw, color, breed)."""
    segs = [s.strip() for s in rest.split(",") if s.strip()]
    if not segs:
        return None, None, None
    age_raw = segs[0]
    color = segs[1] if len(segs) > 1 else None
    breed_seg = segs[-1] if len(segs) > 2 else (segs[1] if len(segs) > 1 else None)
    if len(segs) > 3:
        color = ", ".join(segs[1:-1])
    # Strip a leading single-letter flag from color (e.g. 'Y BRINDLE').
    if color:
        cm = re.match(r"^([A-Z])\s+(.+)$", color)
        if cm:
            color = cm.group(2)
    breed = breed_seg
    if breed_seg:
        parts = breed_seg.split()
        if parts and parts[-1].upper() in SPECIES:
            breed = " ".join(parts[:-1]) or None
    return age_raw, color, breed


def fetch_pdf(url):
    log(f"Fetching PDF: {url}")
    r = requests.get(url, timeout=60, headers={"User-Agent": "VoyceForPaws-ACS/1.0"})
    r.raise_for_status()
    log(f"  {len(r.content)} bytes, content-type={r.headers.get('content-type')}")
    return r.content


def extract(pdf_bytes):
    """Return (full_text, page_count)."""
    texts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            texts.append(page.extract_text() or "")
    return "\n".join(texts), page_count


def parse_rows(raw_text):
    lines = raw_text.split("\n")
    n = len(lines)
    out = {}
    for i, line in enumerate(lines):
        m = DEMO_RE.match(line.strip())
        if not m:
            continue
        sex = m.group(1)
        age_raw, color, breed = split_demo(m.group(2))

        # id / due_out / kennel / euth: search a small window upward.
        aid = due_out = kennel = euth = None
        for j in range(i - 1, max(-1, i - 7), -1):
            lj = lines[j].strip()
            vm = VAL_RE.match(lj)
            if vm and aid is None:
                aid = vm.group(1)
                due_out = parse_date_iso(vm.group(2))
                kennel = vm.group(3)
            em = EUTH_RE.search(lines[j])
            if em and euth is None:
                euth = em.group(1)
            if aid is None:
                idm = ID_RE.search(lj)
                if idm:
                    aid = idm.group(1)
        if not aid:
            continue

        # Size/Weight + Days + At Risk Since (header then values), forward window.
        weight = days = risk = None
        for j in range(i + 1, min(n, i + 8)):
            hm = SIZEHDR_RE.match(lines[j].strip())
            if hm:
                vals = lines[j + 1].split() if j + 1 < n else []
                if hm.group(1).lower() == "weight" and vals:
                    weight = to_int(vals[0])
                if len(vals) >= 2:
                    days = to_int(vals[1])
                if len(vals) >= 3:
                    risk = parse_date_iso(vals[2])
                break

        # Name = line just before 'Evaluation Notes:'; story = notes after it.
        name = None
        story = None
        for k in range(i + 1, min(n, i + 14)):
            if lines[k].strip().lower().startswith("evaluation notes"):
                cand = lines[k - 1].strip()
                if cand and not ID_RE.search(cand) and not cand[0].isdigit():
                    name = cand
                story = collect_story(lines, k + 1, n)
                break

        out[aid] = {
            "id": aid,
            "list_date": date.today().isoformat(),
            "status": "AT RISK",
            "status_key": "atrisk",
            "name": name.upper() if name else None,
            "breed": breed.upper() if breed else None,
            "color": color.upper() if color else None,
            "age": short_age(age_raw),
            "age_raw": age_raw,
            "sex": sex,
            "weight": weight,
            "kennel": kennel,
            "days": days,
            "risk_since": risk,
            "euth_date": euth,
            "due_out": due_out,
            "heartworm": None,
            "story": story,
            "pet_search_url": f"https://webapp1.sanantonio.gov/PetSearch/Default.aspx?id={aid}",
            "list_url": PDF_URL,
        }
    return list(out.values())


def collect_story(lines, start, n):
    buf = []
    for k in range(start, min(n, start + 120)):
        s = lines[k].strip()
        if VAL_RE.match(s) or DEMO_RE.match(s) or s.endswith("pet will be"):
            break
        if s:
            buf.append(s)
    text = " ".join(buf).strip()
    return text[:4000] or None


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


def write_debug(pdf_url, page_count, parsed_rows, raw_text, notes):
    if not WRITE_DEBUG:
        return
    payload = [{
        "pdf_url": pdf_url,
        "page_count": page_count,
        "parsed_rows": parsed_rows,
        "raw_text": raw_text[:60000],
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
    except Exception as e:
        log(f"DEBUG WRITE EXCEPTION: {e}")


def main():
    started = datetime.now(timezone.utc).isoformat()
    log(f"Supabase target: {SUPABASE_URL} | table={TARGET_TABLE}")
    pdf_bytes = fetch_pdf(PDF_URL)
    raw_text, page_count = extract(pdf_bytes)
    log(f"Extracted {page_count} pages, {len(raw_text)} chars of text")
    rows = parse_rows(raw_text)
    log(f"Parsed {len(rows)} animal rows")
    if rows[:2]:
        log("Sample:", json.dumps(rows[:2], indent=2)[:1500])
    write_debug(PDF_URL, page_count, len(rows), raw_text, f"run={started} target={TARGET_TABLE}")
    n = supabase_upsert(rows)
    log(f"Upserted {n} rows into {TARGET_TABLE}")
    if not rows:
        log("WARNING: 0 rows parsed. Check acs_pull_debug for raw layout.")
        sys.exit(0)


if __name__ == "__main__":
    main()
