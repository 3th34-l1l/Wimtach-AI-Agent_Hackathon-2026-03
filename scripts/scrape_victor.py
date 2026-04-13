import os
import re
import json
import time
from datetime import datetime, timezone
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
import psycopg2


BASE_URL = "https://www.flyvictor.com"
START_URL = "https://www.flyvictor.com/en-us/flights/?passengers=2"

HEADLESS = False  # set True later once stable
PAGE_START = 1
PAGE_END = 3


def log(msg: str):
    print(f"[victor] {msg}", flush=True)


def clean_price(value: str):
    if not value:
        return None
    digits = re.sub(r"[^\d]", "", value)
    return int(digits) if digits else None


def parse_capacity(text: str):
    if not text:
        return None
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else None


def normalize_date(text: str):
    if not text:
        return None
    for fmt in ("%a %d %b %Y", "%a %e %b %Y"):
        try:
            dt = datetime.strptime(text.strip(), fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except Exception:
            pass
    return None


def upsert_rows(rows):
    if not rows:
        log("No rows to upsert.")
        return

    log(f"Connecting to Postgres to upsert {len(rows)} rows...")
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS empty_legs (
          id TEXT PRIMARY KEY,
          source TEXT NOT NULL,
          source_url TEXT,
          origin_label TEXT,
          dest_label TEXT,
          route_label TEXT,
          dep_utc TIMESTAMPTZ NOT NULL,
          arr_utc TIMESTAMPTZ,
          seats_available INTEGER,
          min_price_usd NUMERIC,
          aircraft_type TEXT,
          operator_name TEXT,
          tail_number TEXT,
          score NUMERIC,
          publish_status TEXT DEFAULT 'published',
          image_url TEXT,
          package_hint TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """
    )

    for row in rows:
        cur.execute(
            """
            INSERT INTO empty_legs (
              id, source, source_url,
              origin_label, dest_label, route_label,
              dep_utc, seats_available, min_price_usd,
              aircraft_type, publish_status, image_url, updated_at
            )
            VALUES (
              %(id)s, %(source)s, %(source_url)s,
              %(origin_label)s, %(dest_label)s, %(route_label)s,
              %(dep_utc)s, %(seats_available)s, %(min_price_usd)s,
              %(aircraft_type)s, %(publish_status)s, %(image_url)s, NOW()
            )
            ON CONFLICT (id)
            DO UPDATE SET
              source_url = EXCLUDED.source_url,
              origin_label = EXCLUDED.origin_label,
              dest_label = EXCLUDED.dest_label,
              route_label = EXCLUDED.route_label,
              dep_utc = EXCLUDED.dep_utc,
              seats_available = EXCLUDED.seats_available,
              min_price_usd = EXCLUDED.min_price_usd,
              aircraft_type = EXCLUDED.aircraft_type,
              publish_status = EXCLUDED.publish_status,
              image_url = EXCLUDED.image_url,
              updated_at = NOW();
            """,
            row,
        )

    conn.commit()
    cur.close()
    conn.close()
    log("Postgres upsert complete.")


def debug_dump(page, name="victor_debug"):
    try:
        page.screenshot(path=f"{name}.png", full_page=True)
        with open(f"{name}.html", "w", encoding="utf-8") as f:
            f.write(page.content())
        log(f"Saved debug files: {name}.png and {name}.html")
    except Exception as e:
        log(f"Failed to save debug dump: {e}")


def wait_for_results(page):
    """
    Wait for page content we actually care about,
    instead of waiting for 'networkidle'.
    """
    selectors = [
        'div[class*="ean7XG__wrapper"]',
        'h6',
        'h4',
        'text=Matches',
    ]

    for selector in selectors:
        try:
            page.wait_for_selector(selector, timeout=20000)
            log(f"Selector appeared: {selector}")
            return True
        except PlaywrightTimeoutError:
            continue

    return False


def scrape_page(page, page_num: int):
    rows = []

    cards = page.locator('div[class*="ean7XG__wrapper"]')
    count = cards.count()
    log(f"Page {page_num}: found {count} cards")

    for i in range(count):
        card = cards.nth(i)

        try:
            h6s = card.locator("h6")
            if h6s.count() < 2:
                continue

            origin = h6s.nth(0).inner_text().strip()
            dest = h6s.nth(1).inner_text().strip()

            try:
                price_text = card.locator("h4").inner_text().strip()
            except Exception:
                price_text = ""

            try:
                body_text = card.inner_text()
            except Exception:
                body_text = ""

            try:
                img = card.locator("img").first
                image_url = img.get_attribute("src")
                if image_url and image_url.startswith("/"):
                    image_url = urljoin(BASE_URL, image_url)
            except Exception:
                image_url = None

            dep_match = re.search(
                r"Departure:\s*([A-Za-z]{3}\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4})",
                body_text,
            )
            aircraft_match = re.search(
                r"Aircraft:\s*([^,]+),\s*([^,]+),\s*Capacity:\s*(\d+)",
                body_text,
            )

            dep_label = dep_match.group(1) if dep_match else None
            dep_utc = normalize_date(dep_label) if dep_label else None

            aircraft_type = None
            aircraft_class = None
            seats = None
            if aircraft_match:
                aircraft_type = aircraft_match.group(1).strip()
                aircraft_class = aircraft_match.group(2).strip()
                seats = int(aircraft_match.group(3))

            if not origin or not dest or not dep_utc:
                continue

            route_label = f"{origin} → {dest}"
            full_aircraft = ", ".join([x for x in [aircraft_type, aircraft_class] if x])

            row_id = f"victor:{page_num}:{i}:{route_label}:{dep_utc}"

            rows.append(
                {
                    "id": row_id,
                    "source": "victor",
                    "source_url": page.url,
                    "origin_label": origin,
                    "dest_label": dest,
                    "route_label": route_label,
                    "dep_utc": dep_utc,
                    "seats_available": seats or parse_capacity(body_text),
                    "min_price_usd": clean_price(price_text),
                    "aircraft_type": full_aircraft or None,
                    "publish_status": "published",
                    "image_url": image_url,
                }
            )

        except Exception as e:
            log(f"Page {page_num}, card {i}: scrape error: {e}")

    return rows


def run():
    all_rows = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS, slow_mo=150 if not HEADLESS else 0)

        context = browser.new_context(
            viewport={"width": 1440, "height": 1200}
        )
        page = context.new_page()

        for page_num in range(PAGE_START, PAGE_END + 1):
            url = f"{START_URL}&page={page_num}"
            log(f"Loading page {page_num}: {url}")

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(4000)

                ok = wait_for_results(page)
                if not ok:
                    log(f"Page {page_num}: results did not appear")
                    debug_dump(page, f"victor_page_{page_num}_no_results")
                    continue

                rows = scrape_page(page, page_num)
                log(f"Page {page_num}: parsed {len(rows)} rows")
                all_rows.extend(rows)

            except PlaywrightTimeoutError as e:
                log(f"Page {page_num}: timeout: {e}")
                debug_dump(page, f"victor_page_{page_num}_timeout")
            except Exception as e:
                log(f"Page {page_num}: unexpected error: {e}")
                debug_dump(page, f"victor_page_{page_num}_error")

        browser.close()

    log(f"Total rows collected: {len(all_rows)}")

    if all_rows:
        upsert_rows(all_rows)

    print(json.dumps({"inserted": len(all_rows)}, indent=2))


if __name__ == "__main__":
    run()