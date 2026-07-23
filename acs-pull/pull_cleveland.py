#!/usr/bin/env python3
"""
Voyce for Paws - City Dogs Cleveland roster pull.

City Dogs Cleveland (City of Cleveland Division of Animal Care & Control kennel)
publishes its adoptable animals through a PetPoint / Petango widget embedded on
clevelandohio.gov. This job fetches that public feed, parses every dog, and
upserts them into acs_animals tagged shelter_id='cle_city_dogs_oh' via the
apply_shelter_pull RPC. Dogs that drop off the roster are marked 'left';
manually-set urgent/outcome statuses (SOS flags, euthanized, secured) are
preserved by the RPC so a refresh never wipes an escalation.

Cleveland is an open-admission municipal kennel that euthanizes for space, so
every listed dog is treated as 'at risk'. Which specific dogs are in imminent
danger is surfaced separately (e.g. CLE Pups posts) and layered on as SOS flags.
"""
import os
import re
import sys

import requests
from bs4 import BeautifulSoup

SHELTER_ID = "cle_city_dogs_oh"

# Public PetPoint/Petango widget key — taken from the City of Cleveland's own
# "Adoptable Pets" page, which ships the key in plain HTML. species=Dog only.
AUTHKEY = "ir0ebmwyhu4ts80a04lxidx3ectdc81bmsmjsob0kx72xst46t"
FEED_URL = (
    "https://ws.petango.com/webservices/adoptablesearch/wsAdoptableAnimals.aspx"
    "?species=Dog&sex=A&agegroup=All&onhold=A&orderby=ID&colnum=4&AuthKey=" + AUTHKEY
)


def _supabase_url():
    u = os.environ["SUPABASE_URL"].strip().rstrip("/")
    # The secret is sometimes stored without a scheme; requests needs https://.
    if not u.startswith("http"):
        u = "https://" + u
    return u


SUPABASE_URL = _supabase_url()
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip()


def _txt(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip() if node else ""


def parse_feed(html_text):
    """Each dog is a `.list-item` with `.list-animal-name/-id/-breed/-sexSN/-age`,
    a photo (img.list-animal-photo) and a detail link in `.list-animal-photo-block`."""
    soup = BeautifulSoup(html_text, "html.parser")
    animals = []
    for item in soup.select(".list-item"):
        name = _txt(item.select_one(".list-animal-name"))
        aid = _txt(item.select_one(".list-animal-id"))
        if not name or not aid:
            continue
        img = item.select_one("img.list-animal-photo")
        photo = img["src"].strip() if img and img.has_attr("src") else ""
        # Store the clean public 24petconnect detail link (no AuthKey in it).
        url = "https://24petconnect.com/pp4670/Details/PP4670/" + aid
        animals.append({
            "id": aid,
            "name": name,
            "breed": _txt(item.select_one(".list-animal-breed")),
            "sex": _txt(item.select_one(".list-animal-sexSN")),
            "age": _txt(item.select_one(".list-animal-age")),
            "photo": photo,
            "url": url,
        })
    return animals


def main():
    r = requests.get(FEED_URL, timeout=60, headers={"User-Agent": "VoyceForPaws/1.0 (+https://voyceforpaws.org)"})
    r.raise_for_status()
    animals = parse_feed(r.text)
    print(f"Parsed {len(animals)} Cleveland dogs from the Petango feed.")

    # Safety: never write an empty roster (that would mark every dog 'left').
    if not animals:
        print("No animals parsed — aborting to avoid wiping the roster.")
        sys.exit(1)

    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/apply_shelter_pull",
        headers={
            "Content-Type": "application/json",
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
        },
        json={"p_shelter": SHELTER_ID, "p_animals": animals},
        timeout=120,
    )
    if not resp.ok:
        print(f"apply_shelter_pull failed {resp.status_code}: {resp.text}")
        sys.exit(1)
    print(f"apply_shelter_pull result: {resp.text}")


if __name__ == "__main__":
    main()
