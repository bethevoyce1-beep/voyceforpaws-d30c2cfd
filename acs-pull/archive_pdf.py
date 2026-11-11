#!/usr/bin/env python3
"""Archive every distinct version of the ACS capacity-euthanasia PDF.

WHY THIS EXISTS
---------------
The ACS list is the only published record of which animals were at risk on a
given day, and the City overwrites it in place several times a day. Once it is
overwritten, the previous version is gone from sanantonio.gov.

The parsed *text* of every poll is already kept in acs_pull_debug. This keeps
the original *document* -- the thing you can put in front of ACS, a reporter or
a council member and say "this is what you published, at this time".

This job used to live in the older bethevoyce1-beep/voyceforpaws repository,
which committed the PDF into git whenever it changed. That workflow is being
retired, so the archive moves here, next to the pipeline that actually reads
the PDF.

HOW IT WORKS
------------
The object is named by the SHA-256 of its own bytes, so an unchanged PDF is
stored exactly once however often we poll (~96 polls/day, ~5 distinct versions
per day). The object's created_at in Supabase Storage is therefore the first
moment we saw that version. To list the archive in order:

    select name, created_at
    from storage.objects
    where bucket_id = 'acs-pdf' and name like 'archive/san-antonio/%'
    order by created_at;

THIS SCRIPT NEVER FAILS THE WORKFLOW
------------------------------------
The archive is evidence, not a dependency of the data pull. A storage outage,
a bad key or a City timeout must never stop animals being tracked, so every
path here exits 0 and the workflow step is also marked continue-on-error.

Standard library only -- no dependency on requirements.txt, so this keeps
working even if the pull pipeline's dependencies change.
"""
import hashlib
import os
import re
import sys
import urllib.error
import urllib.request

DEFAULT_SUPABASE_URL = "https://okmukfrhvqkxphzueqww.supabase.co"
PDF_URL = os.environ.get(
    "PDF_URL", "https://www.sanantonio.gov/acs/ACS_website_euth_capacity.pdf"
)
BUCKET = os.environ.get("ARCHIVE_BUCKET", "acs-pdf")
PREFIX = os.environ.get("ARCHIVE_PREFIX", "archive/san-antonio")
UA = "VoyceForPaws-ACS-Archive/1.0"


def log(*a):
    print(*a, flush=True)


def clean_url(raw):
    """Accept a bare host, a full URL, or a pasted dashboard string."""
    m = re.search(r"([a-z0-9-]+\.supabase\.co)", (raw or "").strip(), re.I)
    return f"https://{m.group(1)}" if m else DEFAULT_SUPABASE_URL


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def upload(supabase_url, service_key, path, body):
    """Upload with x-upsert: false so an identical PDF is never re-stored.

    Returns one of: "stored", "duplicate", "error".
    """
    req = urllib.request.Request(
        f"{supabase_url}/storage/v1/object/{BUCKET}/{path}",
        data=body,
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/pdf",
            "x-upsert": "false",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return "stored" if r.status in (200, 201) else "error"
    except urllib.error.HTTPError as e:
        # 409 Duplicate is the normal, expected outcome: the PDF has not
        # changed since the last poll.
        if e.code in (400, 409):
            detail = e.read().decode("utf-8", errors="replace")
            if "Duplicate" in detail or "already exists" in detail:
                return "duplicate"
            log(f"  archive HTTP {e.code}: {detail[:300]}")
            return "error"
        log(f"  archive HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}")
        return "error"


def main():
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_key:
        log("No SUPABASE_SERVICE_ROLE_KEY set - skipping PDF archive.")
        return

    supabase_url = clean_url(os.environ.get("SUPABASE_URL", ""))

    try:
        body = fetch(PDF_URL)
    except Exception as e:
        log(f"Could not download the ACS PDF, nothing archived: {e}")
        return

    if not body or not body.startswith(b"%PDF"):
        # A maintenance page or a WAF block returns HTML with a 200. Storing it
        # as evidence would be worse than storing nothing.
        log(f"Downloaded {len(body)} bytes that are not a PDF - not archiving.")
        return

    digest = hashlib.sha256(body).hexdigest()
    path = f"{PREFIX}/{digest[:16]}.pdf"

    result = upload(supabase_url, service_key, path, body)
    if result == "stored":
        log(f"Archived a new PDF version: {path} ({len(body)} bytes)")
    elif result == "duplicate":
        log(f"PDF unchanged since the last poll ({digest[:16]}) - already archived.")
    else:
        log("PDF archive did not complete this run. The data pull is unaffected.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"PDF archive skipped (non-fatal): {e}")
    sys.exit(0)
