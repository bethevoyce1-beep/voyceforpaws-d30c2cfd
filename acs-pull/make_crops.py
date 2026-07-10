#!/usr/bin/env python3
"""
Per-dog ACS PDF crops.

Runs AFTER pull_acs.py as a separate, isolated step so it can never affect the
live animal data. For each currently-listed animal that doesn't yet have a
stored crop, it:

  1. finds that animal's entry on the ACS capacity PDF (by the position of its
     A######## id heading),
  2. crops just that animal's block out of the page (from its heading down to
     the next animal's heading, full page width),
  3. uploads the crop as a PNG to the public `acs-pdf` Supabase Storage bucket,
  4. saves the public URL on acs_animals.pdf_url.

The whole thing is wrapped so any failure exits cleanly (0) without disturbing
the data the main pull already wrote.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required); PDF_URL, MAX_PDF_CROPS,
ENRICH_PDF (optional).
"""
import io
import json
import os
import re
import sys

import requests

DEFAULT_SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co"


def _clean_url(raw):
    raw = (raw or "").strip()
    m = re.search(r"([a-z0-9-]+\.supabase\.co)", raw, re.I)
    return f"https://{m.group(1)}" if m else DEFAULT_SUPABASE_URL


SUPABASE_URL = _clean_url(os.environ.get("SUPABASE_URL", ""))
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
PDF_URL = os.environ.get(
    "PDF_URL", "https://www.sanantonio.gov/acs/ACS_website_euth_capacity.pdf"
)
ENRICH_PDF = os.environ.get("ENRICH_PDF", "true").lower() == "true"
MAX_PDF_CROPS = int(os.environ.get("MAX_PDF_CROPS", "80"))
BUCKET = "acs-pdf"
DPI = 150
SCALE = DPI / 72.0

REST = f"{SUPABASE_URL}/rest/v1"
HJSON = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}
HBIN = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
UA = {"User-Agent": "VoyceForPaws-ACS/1.0"}
IDRE = re.compile(r"^A\d{6,8}$")


def log(*a):
    print(*a, flush=True)


def ids_needing_crop():
    """Currently-listed animals (not left/euthanized) that have no crop yet."""
    r = requests.get(
        f"{REST}/acs_animals?select=id,pdf_url,status_key", headers=HJSON, timeout=60
    )
    r.raise_for_status()
    out = set()
    for row in r.json():
        sk = (row.get("status_key") or "").lower()
        if sk in ("left", "euthanized"):
            continue
        if not (row.get("pdf_url") or "").strip():
            out.add(row["id"])
    return out


def upload_png(aid, png_bytes):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{aid}.png"
    h = {**HBIN, "Content-Type": "image/png", "x-upsert": "true"}
    r = requests.post(url, headers=h, data=png_bytes, timeout=60)
    if r.status_code >= 300:
        log(f"  upload {aid} failed {r.status_code}: {r.text[:160]}")
        return None
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{aid}.png"


def save_url(aid, url):
    r = requests.patch(
        f"{REST}/acs_animals?id=eq.{aid}",
        headers={**HJSON, "Prefer": "return=minimal"},
        data=json.dumps({"pdf_url": url}),
        timeout=60,
    )
    if r.status_code >= 300:
        log(f"  patch {aid} failed {r.status_code}: {r.text[:160]}")


def main():
    if not ENRICH_PDF:
        log("ENRICH_PDF disabled — skipping.")
        return
    if not SERVICE_KEY:
        log("No service key — skipping.")
        return

    need = ids_needing_crop()
    log(f"{len(need)} animals need a crop.")
    if not need:
        return

    import pdfplumber
    import pypdfium2 as pdfium

    pdf_bytes = requests.get(PDF_URL, headers=UA, timeout=90).content
    log(f"PDF {len(pdf_bytes)} bytes.")

    # Map each id -> (page_index, heading_top). An id's entry lives on one page;
    # its heading is the topmost occurrence of that id on that page.
    header = {}
    dims = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for pi, page in enumerate(pdf.pages):
            dims.append((float(page.width), float(page.height)))
            tops = {}
            for w in page.extract_words():
                if IDRE.match(w["text"]):
                    t = float(w["top"])
                    if w["text"] not in tops or t < tops[w["text"]]:
                        tops[w["text"]] = t
            for aid, t in tops.items():
                if aid not in header:  # first page seen = heading page
                    header[aid] = (pi, t)

    # Per page, the sorted list of entry tops (to find each entry's bottom).
    page_entries = {}
    for aid, (pi, t) in header.items():
        page_entries.setdefault(pi, []).append(t)
    for pi in page_entries:
        page_entries[pi].sort()

    doc = pdfium.PdfDocument(pdf_bytes)
    made = 0
    for aid in need:
        if made >= MAX_PDF_CROPS:
            break
        if aid not in header:
            continue
        try:
            pi, top = header[aid]
            pw, ph = dims[pi]
            nxt = ph
            for t in page_entries.get(pi, []):
                if t > top + 1 and t < nxt:
                    nxt = t
            top_pt = max(0.0, top - 26.0)
            bot_pt = min(ph, nxt - 4.0)
            pil = doc[pi].render(scale=SCALE).to_pil()
            W, H = pil.size
            crop = pil.crop((0, int(top_pt * SCALE), W, int(bot_pt * SCALE)))
            buf = io.BytesIO()
            crop.save(buf, format="PNG")
            url = upload_png(aid, buf.getvalue())
            if url:
                save_url(aid, url)
                made += 1
        except Exception as e:
            log(f"  crop {aid} error: {e}")
    log(f"Uploaded {made} crops.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"make_crops failed (non-fatal): {e}")
    sys.exit(0)
