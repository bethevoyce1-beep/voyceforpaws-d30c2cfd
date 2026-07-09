#!/usr/bin/env python3
"""
Voyce for Paws - ACS at-risk animal refresh.

Downloads the City of San Antonio ACS "Capacity Euthanasia List" PDF, parses the
per-animal narrative blocks, classifies each animal's status the way the Voyce
prototype does, and reconciles them into the live acs_animals table via the
acs_apply_pull() function (upsert current animals + mark drop-offs as 'left',
preserving history).

Status model (matches voyce-acs-cards-merged.html):
  euthanasia  - kennel == 'EUTHANASIA'
  b6spt       - kennel starts 'B6' or contains 'SPT'
  adoption    - block text has 'ADOPTION HOLD' / 'ADOPTION IN PROGRESS'
  foster      - block text has 'FOSTER HOLD'
  immediate   - has 'euthanized on <date>' notice (scheduled for capacity day)
  atrisk      - on the list, no imminent euth notice

Env vars:
  SUPABASE_URL                (optional; host auto-detected/fixed)
  SUPABASE_SERVICE_ROLE_KEY   (required)
  PDF_URL                     (default: ACS capacity euthanasia PDF)
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
    segs = [s.strip() for s in rest.split(",") if s.strip()]
    if not segs:
        return None, None, None
    age_raw = segs[0]
    color = segs[1] if len(segs) > 1 else None
    breed_seg = segs[-1] if len(segs) > 2 else (segs[1] if len(segs) > 1 else None)
    if len(segs) > 3:
        color = ", ".join(segs[1:-1])
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


def classify(kennel, euth, block_text):
    """Return (status_key, status) matching the Voyce prototype categories."""
    k = (kennel or "").upper()
    bt = (block_text or "").upper()
    if k == "EUTHANASIA":
        return "euthanasia", "EUTHANASIA"
    if k.startswith("B6") or "SPT" in k:
        return "b6spt", "B6-SPT"
    if "ADOPTION HOLD" in bt or "ADOPTION IN PROGRESS" in bt:
        return "adoption", "ADOPTION IN PROGRESS"
    if "FOSTER HOLD" in bt:
        return "foster", "FOSTER HOLD"
    if euth:
        return "immediate", "IMMEDIATE RISK"
    return "atrisk", "AT RISK"


def fetch_pdf(url):
    log(f"Fetching PDF: {url}")
    r = requests.get(url, timeout=60, headers={"User-Agent": "VoyceForPaws-ACS/1.0"})
    r.raise_for_status()
    log(f"  {len(r.content)} bytes, content-type={r.headers.get('content-type')}")
    return r.content


def extract(pdf_bytes):
    texts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            texts.append(page.extract_text() or "")
    return "\n".join(texts), page_count


def parse_rows(raw_text):
    lines = raw_text.split("\n")
    n = len(lines)
    demo_idx = [i for i, l in enumerate(lines) if DEMO_RE.match(l.strip())]
    out = {}
    for pos, i in enumerate(demo_idx):
        m = DEMO_RE.match(lines[i].strip())
        sex = m.group(1)
        age_raw, color, breed = split_demo(m.group(2))

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

        name = None
        story = None
        for k in range(i + 1, min(n, i + 14)):
            if lines[k].strip().lower().startswith("evaluation notes"):
                cand = lines[k - 1].strip()
                if cand and not ID_RE.search(cand) and not cand[0].isdigit():
                    name = cand
                story = collect_story(lines, k + 1, n)
                break

        # Block text for status markers (this animal's slice only).
        b_start = max(0, i - 6)
        b_end = (demo_idx[pos + 1] - 6) if pos + 1 < len(demo_idx) else n
        b_end = max(b_end, i + 1)
        block_text = "\n".join(lines[b_start:b_end])
        status_key, status = classify(kennel, euth, block_text)

        out[aid] = {
            "id": aid,
            "list_date": date.today().isoformat(),
            "status": status,
            "status_key": status_key,
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


def apply_pull(rows):
    """Reconcile into live acs_animals via the acs_apply_pull() function."""
    url = f"{REST}/rpc/acs_apply_pull"
    r = requests.post(
        url,
        headers={**HEADERS, "Prefer": "return=representation"},
        data=json.dumps({"p_rows": rows, "p_list_url": PDF_URL}),
        timeout=120,
    )
    if r.status_code >= 300:
        log(f"RPC ERROR {r.status_code}: {r.text[:500]}")
        r.raise_for_status()
    return r.text[:300]


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
    log(f"Supabase target: {SUPABASE_URL} (live acs_animals via acs_apply_pull)")
    pdf_bytes = fetch_pdf(PDF_URL)
    raw_text, page_count = extract(pdf_bytes)
    log(f"Extracted {page_count} pages, {len(raw_text)} chars of text")
    rows = parse_rows(raw_text)
    log(f"Parsed {len(rows)} animal rows")
    counts = {}
    for r in rows:
        counts[r["status_key"]] = counts.get(r["status_key"], 0) + 1
    log(f"Status breakdown: {counts}")
    write_debug(PDF_URL, page_count, len(rows), raw_text, f"run={started}")
    if not rows:
        log("WARNING: 0 rows parsed. Check acs_pull_debug for raw layout.")
        sys.exit(0)
    res = apply_pull(rows)
    log(f"acs_apply_pull result: {res}")


if __name__ == "__main__":
    main()
