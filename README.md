# Wiki In Africa — Learning Resources

A searchable, filterable catalogue of Wiki In Africa training resources, built
from data harvested from the [Wiki In Africa Wikibase](https://wikiinafrica.wikibase.cloud/).

Architecture follows the same two-stage pattern as Wikimedia Sverige's MEOW:

```
Wiki In Africa Wikibase (SPARQL)
        |
        v
harvest_wikiinafrica_resources.py  ->  data/resources.json + data/metadata.json
        |
        v
app.py (Flask)  ->  /api/resources, /api/metadata
        |
        v
index.html + assets/js/app.js  ->  browsable, filterable catalogue UI
```

## Wikibase schema (as discovered)

This Wikibase has **no "instance of" property** marking resources. Instead, an
item counts as a training resource simply by carrying a `P2` (campaign)
statement whose value is one of nine known campaign items. If new resource
types are ever added that *don't* carry a campaign, this harvester will miss
them — worth keeping in mind if the data model evolves.

| Property | Meaning                              | Value type                  |
|----------|---------------------------------------|------------------------------|
| P1       | Resource URL                          | string                       |
| P2       | Campaign (**required**)               | item ref, restricted to Q4-Q12 |
| P3       | Wikimedia project                     | item ref, multi              |
| P4       | Skill level                           | item ref, multi (Q26/Q27/Q28) |
| P6       | Format                                | item ref, multi              |
| P7       | Language                              | item ref *or* string, multi  |
| P8       | Creator                               | string, multi                |
| P9       | Year                                  | value                        |
| P10      | Topic                                 | item ref *or* string, multi  |
| P11      | Review status                         | item ref, multi              |

**Campaigns:** Q4 Wiki Loves Africa · Q5 ISA Campaign · Q6 WikiFundi ·
Q7 Wiki Loves Women · Q8 Cross-Cutting · Q9 WikiAfrica Hour ·
Q10 Inspiring Open · Q11 WikiChallenge African Schools · Q12 WikiAfrica Heritage

**Skill levels:** Q26 Beginner · Q27 Intermediate · Q28 Advanced

Campaign/skill labels, icons, and colors are *not* derivable from SPARQL —
they're editorial metadata, kept in one place (`CAMPAIGNS` / `SKILLS` in
`app.py`, mirrored in the harvester) and served to the frontend via
`/api/metadata` so the JS never hardcodes them.

If new properties are added to the Wikibase later (a description field, for
instance — none currently exists), extend `QUERY` in the harvester with
another isolated `OPTIONAL { SELECT ?item (GROUP_CONCAT(...)) ... }` subquery,
following the existing pattern, rather than adding it to one shared subquery —
that's what keeps the query fast on the live endpoint.

## Local setup

```bash
pip install -r requirements.txt

# Harvest data from the live Wikibase
python3 harvest_wikiinafrica_resources.py --pretty

# Run the app
python3 app.py
# -> http://localhost:5000
```

## Keeping data fresh

`scripts/harvest_and_reload.sh` does both steps in one call: runs the
harvester, then POSTs to `/admin/reload` so the change is live immediately
(no need to wait for the app's 5-minute mtime-polling fallback).

```bash
APP_URL=http://localhost:5000 ./scripts/harvest_and_reload.sh
```

### Securing /admin/reload

Once this is deployed and publicly reachable, anyone who finds the tool's URL
can otherwise trigger a reload. Set `ADMIN_RELOAD_TOKEN` to a random secret
in the environment the Flask app runs in — the app then requires that same
token (via `X-Admin-Token` header or `?token=` query param) on every
`/admin/reload` call. Leave it unset only for local development.

```bash
python3 -c "import secrets; print(secrets.token_hex(24))"   # generate one
```

## Deploying to Toolforge, with a daily harvest

Same shape as MEOW: a Toolforge webservice tool running this Flask app, plus
a scheduled job that runs the harvester once a day and reloads the app. See
the [Toolforge Flask quickstart](https://wikitech.wikimedia.org/wiki/Help:Toolforge/Web/Flask)
if the webservice side isn't set up yet. Once it is:

**1. Generate and store the reload token as a Toolforge envvar** (so both the
webservice and the scheduled job can read it without hardcoding it anywhere):

```bash
toolforge envvars create ADMIN_RELOAD_TOKEN
# paste the secret generated above when prompted
```

**2. Make sure the webservice itself has that envvar available** — Toolforge
webservices started via `webservice start` inherit envvars set with
`toolforge envvars create` automatically; restart the webservice after
creating it if it was already running:

```bash
webservice restart
```

**3. Schedule the daily job.** `APP_URL` should be your tool's public URL
(`https://<toolname>.toolforge.org`) so the job talks to the real running
webservice, not `localhost`:

```bash
toolforge jobs run wia-daily-harvest \
  --command "APP_URL=https://<toolname>.toolforge.org bash scripts/harvest_and_reload.sh" \
  --image python3.11 \
  --schedule "0 3 * * *" \
  --mem 512Mi \
  --cpu 1
```

`0 3 * * *` runs it once a day at 03:00 UTC — pick any hour that suits you.
Toolforge also accepts `--schedule "@daily"` if you don't care which hour.

**4. Check it worked:**

```bash
toolforge jobs list                 # confirm the job is scheduled
toolforge jobs logs wia-daily-harvest   # check the most recent run's output
```

The job's own `ADMIN_RELOAD_TOKEN` envvar is picked up automatically from the
tool account the same way the webservice's is — no need to pass it on the
command line.

## Known gaps / things to double-check against the real data

- **Title fallback**: if an item has no English label, SPARQL's label service
  returns the bare Q-ID as a stand-in. The harvester flags this as
  `missing.title` — worth checking after the first real harvest how common
  this is, since Metabase's equivalent case was common enough to need its own
  "Improve data" filter.
- **Review values**: only "Reviewed" is used in the stat bar (mirroring the
  original prototype). If other review-status values exist (e.g. "Draft",
  "Needs review"), they'll still show up in the review filter dropdown and in
  CSV exports, just not broken out in the hero stats — expand `app.js`'s
  `renderStaticSections()` if you want those surfaced too.
- **P7/P10 mixed types**: language and topic values can be either Wikibase
  items or plain strings. The `COALESCE` in the harvester handles this, but
  it means the same real-world value entered once as a string and once as an
  item reference will show up as two separate facet entries. Worth a data
  cleanup pass in the Wikibase itself if that turns out to be common.
