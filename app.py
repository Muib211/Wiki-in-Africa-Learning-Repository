#!/usr/bin/env python3
"""
Wiki In Africa Learning Resources — Flask backend.

Loads resources.json once into memory, then serves a JSON API for
filtered, sorted, paginated results and facet counts. The frontend
only receives the data it needs for the current view.

Routes
------
GET  /                      -> index.html
GET  /api/metadata          -> dataset stats
GET  /api/resources         -> filtered, paginated resources + facet counts
POST /admin/reload          -> hot-reload data without restarting
                               (requires X-Admin-Token / ?token= if
                               ADMIN_RELOAD_TOKEN is set in the environment)
"""

import json
import os
import threading
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request, send_from_directory

# Shared secret for POST /admin/reload. Set this in the environment (e.g. the
# Toolforge job/webservice env) so the scheduled harvest job can trigger a
# reload without the endpoint being open to anyone who finds the tool's URL.
# If unset, /admin/reload is left open -- fine for local development, NOT
# recommended once the app is deployed and reachable from the internet.
ADMIN_RELOAD_TOKEN = os.environ.get("ADMIN_RELOAD_TOKEN", "")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATA_DIR            = Path(__file__).parent / "data"
RESOURCES_PATH      = DATA_DIR / "resources.json"
METADATA_PATH       = DATA_DIR / "metadata.json"
PAGE_SIZE            = 24
DATA_WATCH_INTERVAL = 300  # seconds between mtime checks

# Editorial campaign metadata (labels, icons, colors). Kept here as the
# single source of truth so the frontend never has to hardcode it -- it is
# served via /api/metadata instead. Must match the harvester's CAMPAIGNS.
CAMPAIGNS: Dict[str, Dict[str, str]] = {
    "Q4":  {"label": "Wiki Loves Africa",             "icon": "\U0001F4F8", "color": "#f16160"},
    "Q5":  {"label": "ISA Campaign",                  "icon": "\U0001F3F7", "color": "#46b4ff"},
    "Q6":  {"label": "WikiFundi",                     "icon": "\U0001F4F1", "color": "#ffc800"},
    "Q7":  {"label": "Wiki Loves Women",               "icon": "\u2640",     "color": "#642882"},
    "Q8":  {"label": "Cross-Cutting",                 "icon": "\U0001F517", "color": "#b7ac95"},
    "Q9":  {"label": "WikiAfrica Hour",                "icon": "\U0001F399", "color": "#e60046"},
    "Q10": {"label": "Inspiring Open",                "icon": "\U0001F30D", "color": "#ff3c82"},
    "Q11": {"label": "WikiChallenge African Schools",  "icon": "\U0001F3EB", "color": "#eb5a23"},
    "Q12": {"label": "WikiAfrica Heritage",           "icon": "\U0001F3DB", "color": "#5ab43c"},
}

SKILLS: Dict[str, str] = {
    "Q26": "Beginner",
    "Q27": "Intermediate",
    "Q28": "Advanced",
}
SKILL_ORDER = ["Q26", "Q27", "Q28"]

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
_HERE = Path(__file__).parent
app = Flask(
    __name__,
    static_folder=str(_HERE / "assets"),
    static_url_path="/assets",
)

# ---------------------------------------------------------------------------
# In-memory data store (protected by an RLock)
# ---------------------------------------------------------------------------
_data_lock       = threading.RLock()
_resources:      List[Dict[str, Any]] = []
_metadata:       Dict[str, Any]       = {}
_insights:       Dict[str, Any]       = {}
_resources_mtime: float               = 0.0


def _compute_insights(resources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Precompute the "insights" data used by the Languages / Keywords (Topics)
    modals: top items, rare items (used <=2 times), and a diversity/coverage
    breakdown. Mirrors MEOW's approach -- computed once at load time rather
    than per-request, since it scans the whole dataset.
    """
    # --- Language insights ---
    lang_counts: Counter = Counter()
    with_lang = missing_lang = mono = bi = multi = 0
    for r in resources:
        langs = r.get("languages", [])
        n = len(langs)
        if n == 0:
            missing_lang += 1
        else:
            with_lang += 1
        if n == 1:   mono  += 1
        elif n == 2: bi    += 1
        elif n >= 3: multi += 1
        for l in langs:
            lang_counts[l] += 1
    top_langs = lang_counts.most_common()
    rare_langs = [(l, c) for l, c in top_langs if c <= 2]

    # --- Topic (keyword) insights ---
    topic_counts: Counter = Counter()
    with_topic = missing_topic = t0 = t12 = t35 = t6p = 0
    for r in resources:
        topics = r.get("topics", [])
        n = len(topics)
        if n == 0:
            missing_topic += 1
            t0 += 1
        else:
            with_topic += 1
            if n <= 2:   t12 += 1
            elif n <= 5: t35 += 1
            else:        t6p += 1
        for t in topics:
            topic_counts[t] += 1
    top_topics = topic_counts.most_common()
    rare_topics = [(t, c) for t, c in top_topics if c <= 2]

    return {
        "languages": {
            "topLanguages":    [{"language": l, "count": c} for l, c in top_langs[:15]],
            "rareLanguages":   [{"language": l, "count": c} for l, c in rare_langs],
            "withLanguage":    with_lang,
            "missingLanguage": missing_lang,
            "monolingual":     mono,
            "bilingual":       bi,
            "multilingual":    multi,
            "maxCount":        top_langs[0][1] if top_langs else 0,
        },
        "topics": {
            "topTopics":     [{"topic": t, "count": c} for t, c in top_topics[:20]],
            "rareTopics":    [{"topic": t, "count": c} for t, c in rare_topics],
            "withTopics":    with_topic,
            "missingTopics": missing_topic,
            "zero":          t0,
            "oneTwo":        t12,
            "threeToFive":   t35,
            "sixPlus":       t6p,
            "maxCount":      top_topics[0][1] if top_topics else 0,
        },
    }


def load_data() -> None:
    """Read data files from disk and refresh the in-memory store."""
    global _resources, _metadata, _resources_mtime, _insights
    try:
        new_resources = json.loads(RESOURCES_PATH.read_text(encoding="utf-8"))
        new_metadata  = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        new_mtime     = RESOURCES_PATH.stat().st_mtime
        new_insights  = _compute_insights(new_resources)
        with _data_lock:
            _resources       = new_resources
            _metadata        = new_metadata
            _resources_mtime = new_mtime
            _insights        = new_insights
        print(f"[WIA] Loaded {len(new_resources)} resources.")
    except FileNotFoundError as exc:
        print(f"[WIA] Data file not found ({exc}). Serving empty dataset.")
    except Exception as exc:
        print(f"[WIA] Error loading data: {exc}")


def _watch_data() -> None:
    """Background thread: reload data when resources.json changes on disk."""
    while True:
        time.sleep(DATA_WATCH_INTERVAL)
        try:
            new_mtime = RESOURCES_PATH.stat().st_mtime
            with _data_lock:
                current = _resources_mtime
            if new_mtime > current:
                print("[WIA] Data files changed - reloading...")
                load_data()
        except Exception:
            pass  # file may not exist yet; keep watching


# ---------------------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------------------
def _has_any(values: List[str], selected: List[str]) -> bool:
    return any(v in selected for v in values)


def _apply_filters(
    resources: List[Dict[str, Any]],
    *,
    q: str = "",
    campaigns: Optional[List[str]] = None,
    skills: Optional[List[str]] = None,
    formats: Optional[List[str]] = None,
    projects: Optional[List[str]] = None,
    languages: Optional[List[str]] = None,
    topics: Optional[List[str]] = None,
    creators: Optional[List[str]] = None,
    year: str = "",
    reviews: Optional[List[str]] = None,
    missing_flags: Optional[set] = None,
    exclude: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Filter resources against the given criteria.
    exclude: one of "campaigns", "skills", "formats", "projects",
             "languages", "topics", "creators", "year", "reviews" -- that
             dimension is skipped, enabling context-aware facet counts
             (conjunctive faceted search), matching MEOW's approach.
    """
    campaigns  = campaigns  or []
    skills     = skills     or []
    formats    = formats    or []
    projects   = projects   or []
    languages  = languages  or []
    topics     = topics     or []
    creators   = creators   or []
    reviews    = reviews    or []
    missing_flags = missing_flags or set()

    result = []
    for r in resources:
        if q:
            haystack = " ".join([
                r.get("id", ""),
                r.get("title", ""),
                r.get("campaign", ""),
                " ".join(r.get("creators", [])),
                " ".join(r.get("formats", [])),
                " ".join(r.get("languages", [])),
                " ".join(r.get("topics", [])),
                " ".join(r.get("skills", [])),
                " ".join(r.get("projects", [])),
            ]).lower()
            if q not in haystack:
                continue

        if exclude != "campaigns" and campaigns:
            if r.get("campaignId") not in campaigns:
                continue
        if exclude != "skills" and skills:
            if not _has_any(r.get("skillIds", []), skills):
                continue
        if exclude != "formats" and formats:
            if not _has_any(r.get("formats", []), formats):
                continue
        if exclude != "projects" and projects:
            if not _has_any(r.get("projects", []), projects):
                continue
        if exclude != "languages" and languages:
            if not _has_any(r.get("languages", []), languages):
                continue
        if exclude != "topics" and topics:
            if not _has_any(r.get("topics", []), topics):
                continue
        if exclude != "creators" and creators:
            if not _has_any(r.get("creators", []), creators):
                continue
        if exclude != "year" and year:
            if r.get("year", "") != year:
                continue
        if exclude != "reviews" and reviews:
            if not _has_any(r.get("reviews", []), reviews):
                continue

        miss = r.get("missing", {})
        if "title"    in missing_flags and not miss.get("title"):    continue
        if "creator"  in missing_flags and not miss.get("creator"):  continue
        if "url"      in missing_flags and not miss.get("url"):      continue
        if "format"   in missing_flags and not miss.get("format"):   continue
        if "language" in missing_flags and not miss.get("language"): continue
        if "topic"    in missing_flags and not miss.get("topic"):    continue
        if "skill"    in missing_flags and not miss.get("skill"):    continue
        if "year"     in missing_flags and not miss.get("year"):     continue
        if "project"  in missing_flags and not miss.get("project"):  continue
        if "review"   in missing_flags and not miss.get("review"):   continue

        result.append(r)
    return result


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------
def _sort_resources(resources: List[Dict[str, Any]], sort: str) -> List[Dict[str, Any]]:
    def title_key(r: Dict[str, Any]) -> str:
        return (r.get("title") or "").lower()

    def campaign_key(r: Dict[str, Any]) -> str:
        return (r.get("campaign") or "").lower()

    def skill_key(r: Dict[str, Any]) -> int:
        ids = r.get("skillIds") or []
        for i, s in enumerate(SKILL_ORDER):
            if s in ids:
                return i
        return len(SKILL_ORDER)

    def year_key(r: Dict[str, Any]) -> str:
        return r.get("year") or ""

    if sort == "campaign":
        return sorted(resources, key=lambda r: (campaign_key(r), title_key(r)))
    if sort == "skill":
        return sorted(resources, key=lambda r: (skill_key(r), title_key(r)))
    if sort in ("year-asc", "year-desc"):
        has_year = [r for r in resources if year_key(r)]
        no_year  = [r for r in resources if not year_key(r)]
        has_year.sort(key=lambda r: (year_key(r), title_key(r)), reverse=(sort == "year-desc"))
        no_year.sort(key=title_key)
        return has_year + no_year
    # default: title
    return sorted(resources, key=title_key)


# ---------------------------------------------------------------------------
# Facet counters
# ---------------------------------------------------------------------------
def _count(pool: List[Dict], key: str) -> Dict[str, int]:
    c: Counter = Counter()
    for r in pool:
        for v in r.get(key, []):
            c[v] += 1
    return dict(c)


def _count_campaigns(pool: List[Dict]) -> Dict[str, int]:
    c: Counter = Counter()
    for r in pool:
        cid = r.get("campaignId")
        if cid:
            c[cid] += 1
    return dict(c)


def _count_years(pool: List[Dict]):
    c: Counter = Counter()
    no_year = 0
    for r in pool:
        y = r.get("year", "")
        if y:
            c[y] += 1
        else:
            no_year += 1
    return dict(c), no_year


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(_HERE, "index.html")


@app.route("/api/metadata")
def api_metadata():
    """
    Returns stored dataset metadata plus the editorial campaign/skill
    lookup tables, so the frontend never has to hardcode labels/icons/colors.
    """
    with _data_lock:
        meta = dict(_metadata)
        insights = dict(_insights)
    meta["campaignMeta"] = CAMPAIGNS
    meta["skillMeta"]    = SKILLS
    meta["skillOrder"]   = SKILL_ORDER
    meta["insights"]     = insights
    return jsonify(meta)


@app.route("/api/resources")
def api_resources():
    """
    Returns filtered, sorted, paginated resources plus context-aware facet
    counts for all filter panels.

    Query params
    ------------
    q          free-text search
    campaign   campaign Q-ID (repeatable)
    skill      skill Q-ID (repeatable)
    format     format label (repeatable)
    project    project label (repeatable)
    lang       language label (repeatable)
    topic      topic label (repeatable)
    creator    creator name (repeatable)
    year       4-digit year
    review     review status label (repeatable)
    missing    comma-separated flags: title, creator, url, format, language,
               topic, skill, year, project, review
    sort       title | campaign | skill | year-asc | year-desc
    page       1-based page number (default 1)
    all        1 = return all results without pagination (for CSV export)
    """
    q          = request.args.get("q", "").strip().lower()
    campaigns  = request.args.getlist("campaign")
    skills     = request.args.getlist("skill")
    formats    = request.args.getlist("format")
    projects   = request.args.getlist("project")
    languages  = request.args.getlist("lang")
    topics     = request.args.getlist("topic")
    creators   = request.args.getlist("creator")
    year       = request.args.get("year", "")
    reviews    = request.args.getlist("review")
    missing_str = request.args.get("missing", "")
    missing_flags = set(missing_str.split(",")) if missing_str else set()
    sort       = request.args.get("sort", "title")
    export_all = request.args.get("all", "0") == "1"

    try:
        page = max(1, int(request.args.get("page", 1) or 1))
    except (ValueError, TypeError):
        page = 1

    fkw: Dict[str, Any] = dict(
        q=q, campaigns=campaigns, skills=skills, formats=formats,
        projects=projects, languages=languages, topics=topics,
        creators=creators, year=year, reviews=reviews, missing_flags=missing_flags,
    )

    with _data_lock:
        resources = _resources  # safe: we only ever replace, never mutate

    filtered = _apply_filters(resources, **fkw)
    filtered = _sort_resources(filtered, sort)
    total    = len(filtered)

    year_counts, year_no_date = _count_years(_apply_filters(resources, **fkw, exclude="year"))
    facets = {
        "campaigns": _count_campaigns(_apply_filters(resources, **fkw, exclude="campaigns")),
        "skills":    _count(_apply_filters(resources, **fkw, exclude="skills"),    "skillIds"),
        "formats":   _count(_apply_filters(resources, **fkw, exclude="formats"),   "formats"),
        "projects":  _count(_apply_filters(resources, **fkw, exclude="projects"),  "projects"),
        "languages": _count(_apply_filters(resources, **fkw, exclude="languages"), "languages"),
        "topics":    _count(_apply_filters(resources, **fkw, exclude="topics"),    "topics"),
        "creators":  _count(_apply_filters(resources, **fkw, exclude="creators"),  "creators"),
        "years":     year_counts,
        "yearNoDate": year_no_date,
        "reviews":   _count(_apply_filters(resources, **fkw, exclude="reviews"),   "reviews"),
    }

    if export_all:
        return jsonify({"results": filtered, "total": total, "facets": facets})

    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page        = min(page, total_pages)
    start       = (page - 1) * PAGE_SIZE
    page_items  = filtered[start : start + PAGE_SIZE]

    return jsonify({
        "total":      total,
        "page":       page,
        "totalPages": total_pages,
        "pageSize":   PAGE_SIZE,
        "results":    page_items,
        "facets":     facets,
    })


@app.route("/admin/reload", methods=["POST"])
def admin_reload():
    """
    Hot-reload data files without restarting the server.

    If ADMIN_RELOAD_TOKEN is set in the environment, the request must supply
    a matching token via the X-Admin-Token header or ?token= query param.
    """
    if ADMIN_RELOAD_TOKEN:
        supplied = request.headers.get("X-Admin-Token") or request.args.get("token", "")
        if supplied != ADMIN_RELOAD_TOKEN:
            return jsonify({"status": "error", "message": "Invalid or missing admin token"}), 403

    load_data()
    with _data_lock:
        count = len(_resources)
    return jsonify({"status": "ok", "resourceCount": count})


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
load_data()
_watcher = threading.Thread(target=_watch_data, daemon=True)
_watcher.start()

if __name__ == "__main__":
    import os
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug, host="0.0.0.0", port=5000)
