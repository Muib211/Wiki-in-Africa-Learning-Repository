#!/usr/bin/env python3
"""
Harvest training resources from the Wiki In Africa Wikibase and save them as JSON.

Creates:
  data/resources.json
  data/metadata.json

Usage:
  python3 harvest_wikiinafrica_resources.py
  python3 harvest_wikiinafrica_resources.py --output-dir data --pretty

Schema (discovered from the Wiki In Africa Wikibase, wikiinafrica.wikibase.cloud)
----------------------------------------------------------------------------------
Unlike Metabase, this Wikibase has no "instance of" property marking resources.
Instead, an item counts as a training resource simply by carrying a P2
(campaign) statement whose value is one of the nine known campaign items.

  P1  url        resource URL                         (string, single)
  P2  campaign    programme this resource belongs to   (item ref, required, Q4-Q12)
  P3  project     Wikimedia project(s) it applies to   (item ref, multi)
  P4  skill       skill level                          (item ref, multi; Q26/Q27/Q28)
  P6  format      resource format                      (item ref, multi)
  P7  language    language(s) available in             (item ref OR string, multi)
  P8  creator     creator/author name(s)                (string, multi)
  P9  year        publication year                     (string/value, single)
  P10 topic       subject/theme                         (item ref OR string, multi)
  P11 review      review status (e.g. "Reviewed")       (item ref, multi)
"""

import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

ENDPOINT = "https://wikiinafrica.wikibase.cloud/query/sparql"
APP_NAME = "Wiki In Africa Learning Resources"
DATA_SCHEMA_VERSION = 1
DEFAULT_USER_AGENT = "WikiInAfricaResourcesHarvester/1.0 (+https://wikiinafrica.wikibase.cloud/)"

# Campaign items a resource's P2 statement is restricted to. This mirrors the
# FILTER(?campQ IN (...)) in the site prototype -- it's what actually defines
# "this item is a training resource" in this Wikibase (there's no P5/instance-of
# equivalent). Names/icons/colors are editorial metadata, not derivable from
# SPARQL, so they're kept here as a maintained lookup, same as MEOW's
# RESOURCE_TYPES table.
CAMPAIGNS: Dict[str, Dict[str, str]] = {
    "Q4":  {"label": "Wiki Loves Africa",            "icon": "\U0001F4F8", "color": "#f16160"},
    "Q5":  {"label": "ISA Campaign",                 "icon": "\U0001F3F7", "color": "#46b4ff"},
    "Q6":  {"label": "WikiFundi",                    "icon": "\U0001F4F1", "color": "#ffc800"},
    "Q7":  {"label": "Wiki Loves Women",              "icon": "\u2640",     "color": "#642882"},
    "Q8":  {"label": "Cross-Cutting",                "icon": "\U0001F517", "color": "#b7ac95"},
    "Q9":  {"label": "WikiAfrica Hour",               "icon": "\U0001F399", "color": "#e60046"},
    "Q10": {"label": "Inspiring Open",               "icon": "\U0001F30D", "color": "#ff3c82"},
    "Q11": {"label": "WikiChallenge African Schools", "icon": "\U0001F3EB", "color": "#eb5a23"},
    "Q12": {"label": "WikiAfrica Heritage",          "icon": "\U0001F3DB", "color": "#5ab43c"},
}

SKILL_ORDER = ["Q26", "Q27", "Q28"]  # Beginner, Intermediate, Advanced -- used for sorting

PREFIXES = """
PREFIX wd:  <https://wikiinafrica.wikibase.cloud/entity/>
PREFIX wdt: <https://wikiinafrica.wikibase.cloud/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd:  <http://www.bigdata.com/rdf#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

# Each multi-valued property gets its OWN isolated GROUP_CONCAT subquery,
# LEFT-JOINed on ?item, rather than one big subquery with everything packed
# in. This is a deliberate choice carried over from the site prototype:
# packing every OPTIONAL into one subquery forces Blazegraph to build a large
# internal join before it can aggregate, which times out on the live
# endpoint. Isolated subqueries are cheap and still guarantee exactly one
# output row per item.
QUERY = PREFIXES + """
SELECT ?item ?itemLabel ?campQ ?campLabel
       ?skillQs ?skills ?formats ?projQs ?projects
       ?languages ?topics ?creators ?urls ?years ?reviews
WHERE {
  ?item wdt:P2 ?campQ .
  FILTER(?campQ IN (wd:Q4,wd:Q5,wd:Q6,wd:Q7,wd:Q8,wd:Q9,wd:Q10,wd:Q11,wd:Q12))

  OPTIONAL {
    SELECT ?item
      (GROUP_CONCAT(DISTINCT ?skillQ;   separator="|")  AS ?skillQs)
      (GROUP_CONCAT(DISTINCT ?skillLbl; separator=" | ") AS ?skills)
    WHERE { ?item wdt:P4 ?skillQ . ?skillQ rdfs:label ?skillLbl . FILTER(LANG(?skillLbl)="en") }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?formatLbl; separator=" | ") AS ?formats)
    WHERE { ?item wdt:P6 ?formatQ . ?formatQ rdfs:label ?formatLbl . FILTER(LANG(?formatLbl)="en") }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item
      (GROUP_CONCAT(DISTINCT ?projQ;   separator="|")  AS ?projQs)
      (GROUP_CONCAT(DISTINCT ?projLbl; separator=" | ") AS ?projects)
    WHERE { ?item wdt:P3 ?projQ . ?projQ rdfs:label ?projLbl . FILTER(LANG(?projLbl)="en") }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?langDisplay; separator=" | ") AS ?languages)
    WHERE {
      ?item wdt:P7 ?langVal .
      OPTIONAL { ?langVal rdfs:label ?langLbl . FILTER(LANG(?langLbl)="en") }
      BIND(COALESCE(?langLbl, ?langVal) AS ?langDisplay)
    }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?topicDisplay; separator=" | ") AS ?topics)
    WHERE {
      ?item wdt:P10 ?topicVal .
      OPTIONAL { ?topicVal rdfs:label ?topicLbl . FILTER(LANG(?topicLbl)="en") }
      BIND(COALESCE(?topicLbl, ?topicVal) AS ?topicDisplay)
    }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?creatorVal; separator=" & ") AS ?creators)
    WHERE { ?item wdt:P8 ?creatorVal . }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?urlVal; separator=" | ") AS ?urls)
    WHERE { ?item wdt:P1 ?urlVal . }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?yearVal; separator=" | ") AS ?years)
    WHERE { ?item wdt:P9 ?yearVal . }
    GROUP BY ?item
  }
  OPTIONAL {
    SELECT ?item (GROUP_CONCAT(DISTINCT ?reviewLbl; separator=" | ") AS ?reviews)
    WHERE { ?item wdt:P11 ?reviewQ . ?reviewQ rdfs:label ?reviewLbl . FILTER(LANG(?reviewLbl)="en") }
    GROUP BY ?item
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
ORDER BY ?campLabel ?itemLabel
"""


def run_sparql(
    query: str,
    *,
    endpoint: str,
    session: requests.Session,
    timeout: int,
    user_agent: str,
    max_retries: int,
) -> Dict[str, Any]:
    """Run a SPARQL query with small, explicit retry handling."""
    headers = {
        "Accept": "application/sparql-results+json",
        "User-Agent": user_agent,
    }
    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = session.get(
                endpoint,
                params={"query": query, "format": "json"},
                headers=headers,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt >= max_retries:
                break
            time.sleep(2 ** attempt)  # gentle exponential backoff
    raise RuntimeError(
        f"SPARQL request failed after {max_retries + 1} attempt(s): {last_error}"
    )


def value(binding: Dict[str, Any], key: str) -> str:
    """Return the string value of a SPARQL binding, or empty string if absent."""
    return binding.get(key, {}).get("value", "")


def item_id_from_uri(uri: str) -> str:
    """Extract the Q-ID from a Wikibase entity URI."""
    return uri.rstrip("/").split("/")[-1] if uri else ""


def split_list(raw: str, sep: str) -> List[str]:
    return [part for part in raw.split(sep) if part] if raw else []


def q_ids_from_grouped(raw: str) -> List[str]:
    """Turn a '|'-joined list of full entity URIs into a list of bare Q-IDs."""
    return [item_id_from_uri(u) for u in split_list(raw, "|")]


def parse_row(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    item_id = item_id_from_uri(value(row, "item"))
    if not item_id:
        return None

    title = value(row, "itemLabel") or item_id
    camp_id = item_id_from_uri(value(row, "campQ"))

    skill_ids = q_ids_from_grouped(value(row, "skillQs"))
    skills = split_list(value(row, "skills"), " | ")
    formats = split_list(value(row, "formats"), " | ")
    proj_ids = q_ids_from_grouped(value(row, "projQs"))
    projects = split_list(value(row, "projects"), " | ")
    languages = split_list(value(row, "languages"), " | ")
    topics = split_list(value(row, "topics"), " | ")
    years = split_list(value(row, "years"), " | ")
    reviews = split_list(value(row, "reviews"), " | ")
    creators_raw = value(row, "creators")
    creators = split_list(creators_raw, " & ")
    urls = split_list(value(row, "urls"), " | ")

    resource = {
        "id":         item_id,
        "title":      title,
        "titleIsFallback": title == item_id,
        "campaignId": camp_id,
        "campaign":   value(row, "campLabel") or CAMPAIGNS.get(camp_id, {}).get("label", camp_id),
        "skillIds":   skill_ids,
        "skills":     skills,
        "formats":    formats,
        "projectIds": proj_ids,
        "projects":   projects,
        "languages":  languages,
        "topics":     topics,
        "creators":   creators,
        "urls":       urls,
        "primaryUrl": urls[0] if urls else "",
        "year":       (years[0][:4] if years and years[0][:4].isdigit() else ""),
        "reviews":    reviews,
        "itemUrl":    f"https://wikiinafrica.wikibase.cloud/wiki/Item:{item_id}",
    }
    resource["missing"] = {
        "title":    resource["titleIsFallback"],
        "creator":  len(creators) == 0,
        "url":      len(urls) == 0,
        "format":   len(formats) == 0,
        "language": len(languages) == 0,
        "topic":    len(topics) == 0,
        "skill":    len(skill_ids) == 0,
        "year":     resource["year"] == "",
        "project":  len(proj_ids) == 0,
        "review":   len(reviews) == 0,
    }
    return resource


def build_metadata(resources: List[Dict[str, Any]], *, endpoint: str) -> Dict[str, Any]:
    campaign_counts: Counter = Counter()
    skill_counts:    Counter = Counter()
    format_counts:   Counter = Counter()
    project_counts:  Counter = Counter()
    language_counts: Counter = Counter()
    topic_counts:    Counter = Counter()
    creator_counts:  Counter = Counter()
    review_counts:   Counter = Counter()
    missing_counts:  Counter = Counter()

    for r in resources:
        if r["campaignId"]:
            campaign_counts[r["campaignId"]] += 1
        for sid in r["skillIds"]:   skill_counts[sid]   += 1
        for f   in r["formats"]:    format_counts[f]     += 1
        for p   in r["projects"]:   project_counts[p]    += 1
        for l   in r["languages"]:  language_counts[l]   += 1
        for t   in r["topics"]:     topic_counts[t]       += 1
        for c   in r["creators"]:   creator_counts[c]     += 1
        for rv  in r["reviews"]:    review_counts[rv]     += 1
        for key, is_missing in r.get("missing", {}).items():
            if is_missing:
                missing_counts[key] += 1

    campaign_metadata = {
        camp_id: {**CAMPAIGNS.get(camp_id, {"label": camp_id}), "count": count}
        for camp_id, count in campaign_counts.most_common()
    }

    return {
        "app":            APP_NAME,
        "schemaVersion":  DATA_SCHEMA_VERSION,
        "generatedAt":    datetime.now(timezone.utc).isoformat(),
        "endpoint":       endpoint,
        "totalResources": len(resources),
        "campaigns":      campaign_metadata,
        "skills":         dict(skill_counts.most_common()),
        "formats":        dict(format_counts.most_common()),
        "projects":       dict(project_counts.most_common()),
        "languages":      dict(language_counts.most_common()),
        "topics":         dict(topic_counts.most_common()),
        "creators":       dict(creator_counts.most_common()),
        "reviews":        dict(review_counts.most_common()),
        "missing":        dict(missing_counts),
    }


def atomic_write_json(path: Path, data: Any, indent: Optional[int] = None) -> None:
    """Write JSON atomically via a temporary file to avoid partial writes."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")
    tmp.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Harvest resources from the Wiki In Africa Wikibase and write JSON."
    )
    parser.add_argument("--output-dir", default="data",
                         help="Directory for resources.json and metadata.json (default: data)")
    parser.add_argument("--endpoint", default=ENDPOINT,
                         help="SPARQL endpoint URL (default: Wiki In Africa Wikibase Cloud)")
    parser.add_argument("--timeout", type=int, default=120,
                         help="HTTP timeout per SPARQL request, in seconds (default: 120)")
    parser.add_argument("--max-retries", type=int, default=2,
                         help="Retry a failed SPARQL request this many times (default: 2)")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT,
                         help="HTTP User-Agent header sent to the SPARQL endpoint")
    parser.add_argument("--pretty", action="store_true",
                         help="Indent JSON output (larger file, easier to read)")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    indent = 2 if args.pretty else None

    print(f"Querying {args.endpoint} ...")
    with requests.Session() as session:
        try:
            data = run_sparql(
                QUERY,
                endpoint=args.endpoint,
                session=session,
                timeout=args.timeout,
                user_agent=args.user_agent,
                max_retries=args.max_retries,
            )
        except RuntimeError as exc:
            print(f"Harvest failed: {exc}", file=sys.stderr)
            return 1

    rows = data.get("results", {}).get("bindings", [])
    print(f"  {len(rows)} rows returned")

    resources = []
    for row in rows:
        parsed = parse_row(row)
        if parsed:
            resources.append(parsed)

    resources.sort(key=lambda r: ((r["campaign"] or "").lower(), (r["title"] or "").lower()))

    metadata = build_metadata(resources, endpoint=args.endpoint)

    resources_path = output_dir / "resources.json"
    metadata_path  = output_dir / "metadata.json"
    atomic_write_json(resources_path, resources, indent)
    atomic_write_json(metadata_path,  metadata,  indent)

    print()
    print(f"Wrote {len(resources)} resources to {resources_path}")
    print(f"Wrote metadata to {metadata_path}")
    print(f"Generated at {metadata['generatedAt']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
