#!/usr/bin/env python3
"""Resolve every documentation URL in the guide and report what breaks.

Roughly a dozen of these were verified during authoring. The rest follow the
documented URL structure but were constructed rather than fetched, so treat any
404 here as expected maintenance, not a surprise.

Requires network egress. On a restricted corporate network this will report
connection errors for everything, which is a network result, not a link result.

Usage:
    python3 scripts/verify_links.py guide/ccdv-f-glass.html
"""
import argparse, re, sys, urllib.error, urllib.request
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (link-check; ccdv-f-study-system)"}


def extract(path: Path) -> "OrderedDict[str, list]":
    """Pull URLs out of the SRC map (P+"..." / E+"...") and plain hrefs."""
    h = path.read_text()
    base = dict(re.findall(r"\b(P|E)\s*=\s*'([^']+)'", h))
    urls: "OrderedDict[str, list]" = OrderedDict()

    for label, var, tail in re.findall(r'\["([^"]+)",(P|E)\+"([^"]+)"\]', h):
        urls.setdefault(base.get(var, "") + tail, []).append(label)
    for label, full in re.findall(r'\["([^"]+)",\'(https://[^\']+)\'\]', h):
        urls.setdefault(full, []).append(label)
    for full in re.findall(r'href="(https://[^"]+)"', h):
        urls.setdefault(full, []).append("prose link")
    return urls


def check(url: str, timeout: int = 15) -> tuple:
    req = urllib.request.Request(url, headers=UA, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return url, r.status, ""
    except urllib.error.HTTPError as e:
        return url, e.code, e.reason
    except Exception as e:
        return url, None, f"{type(e).__name__}: {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()

    urls = extract(Path(a.target))
    if not urls:
        print("no URLs found")
        return 2
    print(f"resolving {len(urls)} unique URLs...\n")

    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        results = list(ex.map(check, urls))

    ok, broken, unreachable = [], [], []
    for url, status, note in results:
        if status == 200:
            ok.append(url)
        elif status is None:
            unreachable.append((url, note))
        else:
            broken.append((url, status, note))

    for url, status, note in sorted(broken, key=lambda x: x[1]):
        print(f"  {status}  {url}")
        print(f"        used by: {', '.join(urls[url])}")
    for url, note in unreachable:
        print(f"  ERR  {url}\n        {note}")

    print(f"\nok {len(ok)} | broken {len(broken)} | unreachable {len(unreachable)}")

    if unreachable and not ok:
        print("\nEverything failed to connect. That is egress, not the links.")
        return 0
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
