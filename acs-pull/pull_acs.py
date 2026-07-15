#!/usr/bin/env python3
"""
Voyce for Paws - ACS at-risk animal refresh.

Downloads the City of San Antonio ACS "Capacity Euthanasia List" PDF, parses the
per-animal narrative blocks, classifies each animal, enriches new animals with a
photo from their ACS PetSearch page, and reconciles into the live acs_animals
table via acs_apply_pull().

Status model (status_key -> public_status):
  euthanasia -> Euthanasia — happening now   euthanized -> In Memoriam
  b6spt      -> Critical - final minutes      immediate  -> Critical - today
  scheduled  -> On the clock - {date}         atrisk     -> Urgent
  adopthold  -> ACS Adoption Hold              adoption   -> ACS Rescue Hold
  foster     -> ACS Foster Hold                watch      -> Foster Pending
  secured    -> Secured

  'euthanasia' means the dog is in the EUTHANASIA kennel right now (being
  euthanized). Once ACS drops them off the list, acs_apply_pull() moves them to
  'euthanized' (In Memoriam) permanently. A dog that leaves the list from any
  other kennel is treated as 'left' (saved/adopted/other), never memorialized.

  All "today" logic uses San Antonio (Central) time — ACS's operating clock —
  not the runner's UTC, so the list date and today/scheduled rollover are honest.

Classification precedence (the right-side banner text beats a possibly-stale kennel):
  1. note "has been / was euthanized"               -> euthanized (In Memoriam)
  2. kennel EUTHANASIA (in the room now)            -> euthanasia (happening now)
  3. note "Placement has been secured"              -> secured
  4. hold banner: ADOPTION HOLD -> adopthold; RESCUE HOLD -> adoption;
     FOSTER HOLD -> foster; "family is coming" -> watch. A hold is respected
     even when the kennel still reads Office/B6/SPT.
  5. kennel B6* / *SPT* (staged for euthanasia)     -> b6spt (final minutes)
  6. kennel OFFICE is a LOCATION, not automatically critical — read the banner:
       "euthanized today" -> b6spt (critical); firm "euthanized on {date}" ->
       immediate; otherwise (conditional "could be euthanized after {date}" or
       no euthanasia wording) -> atrisk (Urgent, not final-minutes).
  7. kennel OUTSIDE* (euth today, no hold)          -> immediate
  8. "euthanized today"                             -> immediate (Critical today)
     "euthanized on {future date}"                  -> scheduled (On the clock)
  9. otherwise (incl. "euthanized after {date}")    -> atrisk

Env vars:
  SUPABASE_URL                (optional; host auto-detected/fixed)
  SUPABASE_SERVICE_ROLE_KEY   (required)
  PDF_URL                     (default: ACS capacity euthanasia PDF)
  WRITE_DEBUG                 (default: true)
  ENRICH_PHOTOS               (default: true)
  MAX_PHOTO_FETCHES           (default: 60 per run)
"""
import io
import json
import os
import re
import sys
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import requests
import pdfplumber

# ACS operates on San Antonio (Central) time. All "today" logic is anchored here
# so the list date and today/scheduled rollover don't drift on the UTC runner.
CENTRAL = ZoneInfo("America/Chicago")

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
ENRICH_PHOTOS = os.environ.get("ENRICH_PHOTOS", "true").lower() == "true"
MAX_PHOTO_FETCHES = int(os.environ.get("MAX_PHOTO_FETCHES", "60"))

REST = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}
UA = {"User-Agent": "VoyceForPaws-ACS/1.0"}

SPECIES = {
    "DOG", "CAT", "PUPPY", "KITTEN", "RABBIT", "BIRD", "OTHER", "LIVESTOCK",
    "REPTILE", "FERRET", "HAMSTER", "GUINEA", "PIG", "HORSE", "GOAT",
}

DEMO_RE = re.compile(r"^\(([A-Z])\)\s*Estimated Age\s+(.*)$")
VAL_RE = re.compile(r"^(A\d{6,8})\s+(\d{1,2}/\d{1,2}/\d{4})\s+(\S+)")
ID_RE = re.compile(r"\b(A\d{6,8})\b")
EUTH_ON_RE = re.compile(r"euthanized on\s+(\d{1,2}/\d{1,2}/\d{4})", re.I)
EUTH_TODAY_RE = re.compile(r"euthanized today", re.I)
SIZEHDR_RE = re.compile(r"^(Size|Weight)\s+Days At Shelter\s+At Risk Since", re.I)

OG_RE = re.compile(r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)', re.I)
OG_RE2 = re.compile(r'content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', re.I)
GALLERY_RE = re.compile(
    r'https://webapp1\.sanantonio\.gov/ACSPetAdopt/\d+/[^\s"\'<>]+?\.(?:png|jpg|jpeg)', re.I
)
PETCONNECT_RE = re.compile(r'https://24petconnect\.com/image/[^\s"\'<>]+', re.I)

# status_key -> friendly label shown to the public. `euthanasia` (in the room
# now) is distinct from `euthanized` (In Memoriam, already gone). `watch`
# (Foster Pending) is distinct from `foster` (ACS Foster Hold): a family is
# coming, but the placement isn't confirmed yet. ACS lists three separate hold
# types — an ADOPTION hold (someone is adopting -> adopthold), a RESCUE partner
# hold (a rescue pulled -> adoption), and a FOSTER hold (-> foster).
PUBLIC = {
    "euthanasia": "Euthanasia — happening now",
    "euthanized": "In Memoriam",
    "b6spt": "Critical · final minutes",
    "immediate": "Critical · today",
    "scheduled": "On the clock",
    "atrisk": "Urgent",
    "adoption": "ACS Rescue Hold",
    "adopthold": "ACS Adoption Hold",
    "foster": "ACS Foster Hold",
    "watch": "Foster Pending",
    "secured": "Secured",
}

CRITICAL_KEYS = ("b6spt", "immediate", "scheduled")


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


def classify(kennel, euth_on, euth_today, block_text):
    """Return (status_key, public_status).

    Interim step toward the full taxonomy: the banner text is read before the
    kennel, and an OFFICE kennel is treated as a LOCATION rather than an
    automatic "final minutes." An OFFICE dog is critical only if its banner says
    active euthanasia ("euthanized today"); a conditional "could be euthanized
    after {date}" or no euthanasia wording makes it Urgent (atrisk), not
    final-minutes. B6/SPT kennels stay critical. Only a real euthanasia (already
    done, or the EUTHANASIA kennel) outranks a hold.
    """
    k = (kennel or "").upper()
    bt = (block_text or "").upper()
    is_office = "OFFICE" in k
    is_b6spt = k.startswith("B6") or "SPT" in k
    if "HAS BEEN EUTHANIZED" in bt or "WAS EUTHANIZED" in bt:
        key = "euthanized"
    elif k == "EUTHANASIA":
        key = "euthanasia"
    elif "PLACEMENT HAS BEEN SECURED" in bt:
        key = "secured"
    elif "ADOPTION HOLD" in bt or "ADOPTION IN PROGRESS" in bt:
        key = "adopthold"
    elif "RESCUE HOLD" in bt:
        key = "adoption"
    elif "FOSTER HOLD" in bt:
        key = "foster"
    elif "FAMILY IS COMING" in bt:
        key = "watch"
    elif is_b6spt:
        key = "b6spt"
    elif is_office:
        if euth_today:
            key = "b6spt"
        elif euth_on:
            key = "immediate"
        else:
            key = "atrisk"
    elif "OUTSIDE" in k:
        key = "immediate"
    elif euth_today or euth_on:
        key = "immediate"
    else:
        key = "atrisk"
    return key, PUBLIC[key]


def fetch_pdf(url):
    log(f"Fetching PDF: {url}")
    r = requests.get(url, timeout=60, headers=UA)
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
    now_ct = datetime.now(CENTRAL)
    today = now_ct.date()
    today_iso = today.isoformat()
    today_mdy = today.strftime("%m/%d/%Y")
    demo_idx = [i for i, l in enumerate(lines) if DEMO_RE.match(l.strip())]
    out = {}
    for pos, i in enumerate(demo_idx):
        m = DEMO_RE.match(lines[i].strip())
        sex = m.group(1)
        age_raw, color, breed = split_demo(m.group(2))

        aid = due_out = kennel = euth_on = None
        for j in range(i - 1, max(-1, i - 7), -1):
            lj = lines[j].strip()
            vm = VAL_RE.match(lj)
            if vm and aid is None:
                aid = vm.group(1)
                due_out = parse_date_iso(vm.group(2))
                kennel = vm.group(3)
            em = EUTH_ON_RE.search(lines[j])
            if em and euth_on is None:
                euth_on = em.group(1)
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

        b_start = max(0, i - 6)
        b_end = (demo_idx[pos + 1] - 6) if pos + 1 < len(demo_idx) else n
        b_end = max(b_end, i + 1)
        block_text = "\n".join(lines[b_start:b_end])
        euth_today = bool(EUTH_TODAY_RE.search(block_text))
        euth_on_iso = parse_date_iso(euth_on)
        status_key, public_status = classify(kennel, euth_on, euth_today, block_text)

        # Split "immediate" into today vs a set future date ("On the clock").
        if status_key == "immediate":
            if euth_today or not euth_on_iso or euth_on_iso <= today_iso:
                public_status = "Critical · today"
            else:
                status_key = "scheduled"
                d = datetime.strptime(euth_on_iso, "%Y-%m-%d")
                public_status = f"On the clock · {d.strftime('%b')} {d.day}"

        # Critical/scheduled animals carry a deadline for the countdown.
        euth_date = euth_on or (
            today_mdy if (euth_today or status_key in CRITICAL_KEYS) else None
        )

        out[aid] = {
            "id": aid,
            "list_date": today_iso,
            "status": public_status,
            "status_key": status_key,
            "public_status": public_status,
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
            "euth_date": euth_date,
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
        if VAL_RE.match(s) or DEMO_RE.match(s) or s.endswith("pet will be") or s.endswith("animal will be"):
            break
        if s:
            buf.append(s)
    text = " ".join(buf).strip()
    return text[:4000] or None


def existing_thumb_ids():
    """IDs that already have a stored photo, so we don't refetch them."""
    try:
        r = requests.get(
            f"{REST}/acs_animals?select=id,thumb", headers=HEADERS, timeout=60
        )
        if r.status_code >= 300:
            log(f"thumb prefetch {r.status_code}: {r.text[:200]}")
            return set()
        return {row["id"] for row in r.json() if row.get("thumb")}
    except Exception as e:
        log(f"thumb prefetch failed: {e}")
        return set()


def enrich_photo(pet_search_url):
    """Return (thumb, photos[]) from an animal's ACS PetSearch page."""
    try:
        r = requests.get(pet_search_url, timeout=15, headers=UA)
        if r.status_code >= 300:
            return None, []
        html = r.text
        m = OG_RE.search(html) or OG_RE2.search(html)
        thumb = m.group(1).strip() if m else None
        photos = []
        candidates = ([thumb] if thumb else []) + PETCONNECT_RE.findall(html) + GALLERY_RE.findall(html)
        for u in candidates:
            u = (u or "").strip()
            if u and u not in photos:
                photos.append(u)
        return thumb, photos[:6]
    except Exception as e:
        log(f"photo enrich failed ({pet_search_url}): {e}")
        return None, []


def enrich_new_photos(rows):
    if not ENRICH_PHOTOS:
        return 0
    have = existing_thumb_ids()
    fetched = 0
    for row in rows:
        if fetched >= MAX_PHOTO_FETCHES:
            break
        if row["id"] in have:
            continue
        thumb, photos = enrich_photo(row["pet_search_url"])
        if thumb:
            row["thumb"] = thumb
            row["photos"] = photos
            fetched += 1
    return fetched


def apply_pull(rows):
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
    log(f"ACS day (Central): {datetime.now(CENTRAL).date().isoformat()}")
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
    enriched = enrich_new_photos(rows)
    log(f"Enriched photos for {enriched} new animals")
    res = apply_pull(rows)
    log(f"acs_apply_pull result: {res}")

    # Per-dog ACS PDF crops — isolated so any failure here never affects the
    # data pull above (which has already been written).
    try:
        import make_crops
        make_crops.main()
    except Exception as e:
        log(f"per-dog PDF crops skipped (non-fatal): {e}")


if __name__ == "__main__":
    main()
