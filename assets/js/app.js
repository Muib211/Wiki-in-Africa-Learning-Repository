/* ==========================================================================
   Wiki In Africa — Learning Resources
   Structure follows MEOW's layout; colors follow the Wiki In Africa palette.
   ========================================================================== */
:root {
  /* Wiki In Africa brand colors */
  --orange:  #ff9600;
  --sand:    #b7ac95;
  --red:     #ff0000;
  --green:   #5ab43c;
  --purple:  #784c99;
  --pink:    #ff3c82;

  /* Layout tokens, mapped from MEOW's roles onto the WiA palette */
  --bg:             #FBF7EF;      /* cream */
  --card:           #ffffff;
  --text:           #1E1710;      /* ink */
  --muted:          #8A7F6B;      /* stone */
  --border:         #E4DBC4;      /* line */
  --accent:         #ff9600;      /* orange — fills/borders, not text on light bg */
  --accent-dark:    #b96e00;      /* deepened orange for hover/focus rings */
  --accent-soft:    #FFE9C4;      /* pale orange tint for hover backgrounds */
  --subject-bg:     #EBE0F2;      /* purple tint, for topic tags */
  --subject-text:   #784c99;
  --subject-border: #d9c3e8;
  --ink:            #1E1710;
  --radius:         8px;
}

* { box-sizing: border-box; }
body {
  margin: 0; line-height: 1.5;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg); color: var(--text);
}
.container { max-width: 1480px; margin: 0 auto; padding: 0 20px; }
.noscript-message {
  max-width: 720px; margin: 20px auto; border: 1px solid var(--subject-border);
  border-radius: var(--radius); background: var(--accent-soft); padding: 14px 18px;
  color: var(--text); font-weight: 600;
}
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--accent-dark); outline-offset: 2px;
}

/* ── Header ── */
.site-header { background: white; border-top: 3px solid var(--accent); border-bottom: 1px solid var(--border); padding: 14px 0; }
.header-inner { display: flex; align-items: center; gap: 16px; justify-content: space-between; flex-wrap: wrap; }
.brand-block { border-left: 3px solid var(--accent); padding-left: 14px; }
.site-header h1 { margin: 0; color: var(--ink); font-size: clamp(22px, 2.5vw, 34px); line-height: 1.05; letter-spacing: -0.02em; white-space: nowrap; }
.site-header h2 { margin: 2px 0 0; font-size: 13px; font-weight: 400; color: var(--muted); }
#brandTitle { cursor: pointer; transition: color .15s; background: none; border: none; padding: 0; font: inherit; text-align: left; }
#brandTitle:hover { color: var(--purple); }
.data-updated-at { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.search-panel { display: flex; gap: 8px; width: min(520px, 100%); }
.search-panel input { flex: 1; border: 1px solid var(--border); border-radius: var(--radius); padding: 9px 14px; font-size: 14px; background: white; color: var(--text); }
.search-panel input:focus { outline: 2px solid var(--accent-dark); outline-offset: 0; border-color: var(--accent-dark); }
.search-panel button { border: 1px solid transparent; border-radius: var(--radius); padding: 9px 16px; background: var(--ink); color: white; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background .12s; }
.search-panel button:hover { background: var(--accent); color: var(--text); }
.site-nav { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.nav-link { display: inline-flex; align-items: center; border: none; background: none; color: var(--muted); font-size: 13px; font-family: inherit; padding: 6px 10px; border-radius: var(--radius); cursor: pointer; text-decoration: none; white-space: nowrap; transition: color .12s, background .12s; }
.nav-link:hover, .nav-link:focus { color: var(--text); background: var(--accent-soft); outline: none; }

/* ── Three-column layout ── */
.app-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr) 250px; gap: 16px; padding-top: 16px; padding-bottom: 40px; }
.filters, .subject-panel { align-self: start; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: 0 2px 6px rgba(30,23,16,.05); }
.filters-header, .subject-panel-header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.filters h2, .subject-panel h2 { margin: 0; font-size: 16px; }
.subject-count { margin: 0; color: var(--muted); font-size: 12px; font-weight: 600; }
.reset-button { border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 10px; background: white; color: var(--muted); font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; transition: color .12s, border-color .12s; }
.reset-button:hover { color: var(--text); border-color: var(--accent-dark); }

/* ── Filter groups ── */
.filter-group { padding-top: 12px; margin-top: 12px; }
.filter-group label, .filter-group h3 { display: block; margin: 0 0 7px; font-size: 13px; font-weight: 700; }
.filter-group select { width: 100%; border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 10px; background: white; color: var(--text); font-size: 13px; font-family: inherit; }
.filter-group select:focus { outline: 2px solid var(--accent-dark); border-color: var(--accent-dark); }
.collapsible-filter-group.improve-data-group { background: var(--accent-soft); border: 1px solid var(--subject-border); border-radius: var(--radius); padding: 2px 6px 8px; }
.collapsible-filter-group { padding-top: 8px; margin-top: 12px; }
.collapsible-filter-group summary { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 6px; min-height: 30px; border-radius: 5px; padding: 4px 6px; cursor: pointer; list-style: none; color: var(--text); font-size: 13px; font-weight: 700; }
.collapsible-filter-group summary::-webkit-details-marker { display: none; }
.collapsible-filter-group summary::before { content: "▸"; color: var(--muted); font-size: 11px; }
.collapsible-filter-group[open] summary::before { content: "▾"; }
.collapsible-filter-group summary:hover { background: var(--accent-soft); }
.collapsible-filter-group summary:focus-visible { outline: 2px solid var(--accent-dark); }
.collapsible-filter-title { overflow: hidden; text-overflow: ellipsis; }
.collapsible-filter-icon { display: inline-block; width: 1.3em; text-align: center; margin-right: 2px; }
.collapsible-filter-count { justify-self: end; white-space: nowrap; font-size: 11px; color: var(--muted); font-weight: 400; }
.collapsible-filter-count.has-active { color: var(--subject-text); font-weight: 700; }
.collapsible-filter-content { padding-top: 6px; }
.checkbox-row { display: flex; align-items: center; gap: 7px; margin: 6px 0; color: var(--muted); font-size: 13px; cursor: pointer; }
.checkbox-row input { flex: 0 0 auto; }
.checkbox-label { flex: 1; }
.filter-empty { margin: 4px 0; color: var(--muted); font-size: 12px; }

/* Shared filter-item buttons */
.publisher-search, .author-search, .event-search { width: 100%; margin-bottom: 8px; border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; font-size: 13px; font-family: inherit; background: white; color: var(--text); }
.publisher-search:focus, .author-search:focus, .event-search:focus { outline: 2px solid var(--accent-dark); border-color: var(--accent-dark); }
.publisher-filter-list, .author-filter-list, .event-filter-list, .resource-type-filter-list { max-height: 180px; overflow-y: auto; padding-right: 2px; }
.publisher-filter-button, .author-filter-button, .event-filter-button, .resource-type-filter-button {
  width: 100%; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text);
  padding: 5px 7px; font-size: 13px; font-family: inherit; cursor: pointer; text-align: left;
  display: grid; grid-template-columns: 1fr auto; gap: 7px; align-items: center; transition: background .1s, border-color .1s;
}
.publisher-filter-button:hover, .author-filter-button:hover, .event-filter-button:hover, .resource-type-filter-button:hover { background: var(--accent-soft); border-color: var(--accent-dark); }
.publisher-filter-button.is-active, .author-filter-button.is-active, .event-filter-button.is-active, .resource-type-filter-button.is-active { background: var(--accent); border-color: var(--accent); color: var(--text); }
.publisher-filter-name, .author-filter-name, .event-filter-name, .resource-type-filter-name { overflow: hidden; text-overflow: ellipsis; }
.publisher-filter-count, .author-filter-count, .event-filter-count, .resource-type-filter-count { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; color: var(--muted); padding: 1px 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.publisher-filter-button.is-active .publisher-filter-count, .author-filter-button.is-active .author-filter-count, .event-filter-button.is-active .event-filter-count, .resource-type-filter-button.is-active .resource-type-filter-count { background: rgba(30,23,16,.12); border-color: rgba(30,23,16,.28); color: var(--text); }

/* ── Topic (keyword) panel ── */
.subject-search { width: 100%; margin: 10px 0 8px; border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 10px; font-size: 13px; font-family: inherit; background: white; color: var(--text); }
.subject-search:focus { outline: 2px solid var(--accent-dark); border-color: var(--accent-dark); }
.subject-filter-list { max-height: calc(100vh - 180px); overflow-y: auto; padding-right: 2px; }
.subject-filter-button {
  width: 100%; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--text);
  padding: 5px 7px; font-size: 13px; font-family: inherit; cursor: pointer; text-align: left;
  display: grid; grid-template-columns: 1fr auto; gap: 7px; align-items: center; transition: background .1s, border-color .1s;
}
.subject-filter-button:hover { background: var(--subject-bg); border-color: var(--subject-border); }
.subject-filter-button.is-active { background: var(--subject-text); border-color: var(--subject-text); color: white; }
.subject-filter-name { overflow: hidden; text-overflow: ellipsis; }
.subject-filter-count { background: var(--bg); border: 1px solid var(--border); border-radius: 3px; color: var(--muted); padding: 1px 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.subject-filter-button.is-active .subject-filter-count { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.3); color: white; }

/* ── Year histogram ── */
.year-filter-list { display: grid; gap: 2px; padding-top: 2px; }
.year-bar-button { width: 100%; display: grid; grid-template-columns: 46px 1fr 28px; gap: 6px; align-items: center; border: 1px solid transparent; border-radius: 5px; background: transparent; padding: 4px 6px; font: inherit; font-size: 12px; cursor: pointer; text-align: left; transition: background .1s, border-color .1s; }
.year-bar-button:hover { background: var(--accent-soft); border-color: var(--accent-dark); }
.year-bar-button.is-active { background: var(--accent); border-color: var(--accent); color: var(--text); }
.year-bar-button:focus-visible { outline: 2px solid var(--accent-dark); }
.year-bar-label { font-weight: 700; white-space: nowrap; }
.year-bar-track { height: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
.year-bar-button.is-active .year-bar-track { border-color: rgba(30,23,16,.25); background: rgba(30,23,16,.12); }
.year-bar-fill { display: block; height: 100%; background: var(--accent); transition: width .2s ease; }
.year-bar-button.is-active .year-bar-fill { background: var(--text); }
.year-bar-count { color: var(--muted); font-size: 11px; font-weight: 600; text-align: right; white-space: nowrap; }
.year-bar-button.is-active .year-bar-count { color: rgba(30,23,16,.75); }
.year-no-date { margin: 5px 6px 0; color: var(--muted); font-size: 11px; }

/* ── Results area ── */
.results-area { min-width: 0; }
.results-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px; flex-wrap: wrap; }
.results-toolbar p { margin: 0; color: var(--muted); font-size: 13px; font-weight: 600; }
.results-toolbar-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.results-toolbar select { border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 11px; background: white; color: var(--text); font-size: 13px; font-family: inherit; }
.results-toolbar select:focus { outline: 2px solid var(--accent-dark); border-color: var(--accent-dark); }

.summary-stats { display: grid; grid-template-columns: repeat(6, minmax(90px, 1fr)); gap: 8px; margin-bottom: 12px; }
.summary-stat { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; }
.summary-stat-number { display: block; color: var(--ink); font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.summary-stat-label { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; font-weight: 600; }
.summary-stat-button { appearance: none; width: 100%; text-align: left; cursor: pointer; font: inherit; color: inherit; border-left: 3px solid var(--accent); padding-left: 9px; transition: background .12s; background: var(--card); border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); border-radius: var(--radius); }
.summary-stat-button:hover, .summary-stat-button:focus { background: var(--accent-soft); outline: none; }
.summary-stat-hint { display: block; margin-top: 4px; color: var(--text); font-size: 11px; font-weight: 700; }

.active-filter-strip { background: var(--accent-soft); border: 1px solid var(--subject-border); border-radius: var(--radius); padding: 8px 12px; margin-bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--muted); font-size: 12px; }
.active-filter-strip strong { color: var(--subject-text); }
.active-filter-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.active-filter-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); border-radius: 999px; background: white; color: var(--text); padding: 3px 10px; font-size: 11px; font-weight: 500; font-family: inherit; cursor: pointer; transition: border-color .1s, background .1s; }
.active-filter-chip:hover { border-color: var(--ink); background: var(--bg); }
.active-filter-chip span { opacity: .5; font-size: 13px; }
.clear-type-filter, .clear-year-filter, .clear-publisher-filter, .clear-author-filter, .clear-maintenance-filter, .clear-generic-filter {
  border: 1px solid var(--subject-border); border-radius: var(--radius); background: white; color: var(--subject-text); padding: 3px 9px; font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background .1s;
}
.clear-type-filter:hover, .clear-year-filter:hover, .clear-publisher-filter:hover, .clear-author-filter:hover, .clear-maintenance-filter:hover, .clear-generic-filter:hover { background: var(--subject-bg); }

/* ── Toolbar buttons ── */
.view-toggle { display: flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: white; }
.view-toggle-button { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: none; background: transparent; color: var(--muted); cursor: pointer; transition: background .1s, color .1s; }
.view-toggle-button:hover { background: var(--accent-soft); color: var(--text); }
.view-toggle-button.is-active { background: var(--ink); color: white; }
.view-toggle-button:focus-visible { outline: 2px solid var(--accent-dark); outline-offset: -2px; }
.copy-link-button, .export-csv-button { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 12px; background: white; color: var(--muted); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; transition: color .12s, border-color .12s, background .12s; }
.copy-link-button::before { content: "🔗"; font-size: 11px; }
.export-csv-button::before { content: "⬇"; font-size: 11px; }
.copy-link-button:hover, .copy-link-button:focus, .export-csv-button:hover:not(:disabled), .export-csv-button:focus:not(:disabled) { color: var(--ink); border-color: var(--accent-dark); background: var(--accent-soft); outline: none; }
.copy-link-button--copied { border-color: var(--green); background: #e6f7e0; color: #2E6B1D; }
.copy-link-button--copied::before { content: "✓"; }
.export-csv-button:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Resource cards (grid view) ── */
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 12px; }
.resource-card { display: flex; flex-direction: column; min-height: 100%; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: 0 1px 4px rgba(30,23,16,.05); transition: border-color .14s, box-shadow .14s; }
.resource-card:hover { border-color: rgba(185,110,0,.5); box-shadow: 0 3px 10px rgba(30,23,16,.09); }
.card-meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 9px; }
.card-badges { display: flex; flex-wrap: wrap; gap: 5px; flex: 1 1 auto; min-width: 0; }
.card-link-icons { display: flex; gap: 4px; flex: 0 0 auto; }
.badge { display: inline-flex; align-items: center; max-width: 100%; border: 1px solid transparent; border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 700; line-height: 1.3; white-space: nowrap; }
.badge--campaign { background: var(--ink); border-color: var(--ink); color: white; }
.badge--skill { background: #DEF0D9; border-color: #b8dfaa; color: #2E6B1D; }
.badge--lang { background: var(--subject-bg); border-color: var(--subject-border); color: var(--subject-text); }
.badge--id { margin-left: auto; background: transparent; border-color: var(--border); color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; opacity: .7; }
.badge--clickable { cursor: pointer; font: inherit; transition: background .1s, color .1s, border-color .1s; }
.badge--clickable:hover { background: var(--accent-soft); color: var(--text); border-color: var(--accent-dark); }
.badge--clickable.is-active { background: var(--accent) !important; color: var(--text) !important; border-color: var(--accent) !important; }
.badge--clickable:focus-visible { outline: 2px solid var(--accent-dark); }
.resource-card h2 { margin: 0 0 7px; font-size: 16px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; }
.resource-title-link { color: var(--text); text-decoration: none; text-underline-offset: 3px; }
.resource-title-link:hover, .resource-title-link:focus { color: var(--text); text-decoration: underline; outline: none; }
.description { margin: 0 0 2px; color: var(--muted); font-size: 13px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.description--empty { font-style: italic; }
.resource-date { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
.resource-creator, .resource-project, .resource-review { margin: 6px 0 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
.resource-creator-label, .resource-project-label, .resource-review-label { display: inline-flex; width: 1.3em; justify-content: center; }
.creator-link, .project-link { border: 0; background: transparent; color: var(--text); padding: 0; margin: 0; font: inherit; font-size: 12px; cursor: pointer; text-decoration: none; }
.creator-link:hover, .project-link:hover, .creator-link:focus, .project-link:focus { text-decoration: underline; outline: none; }
.creator-link.is-active, .project-link.is-active { background: var(--subject-bg); color: var(--subject-text); text-decoration: underline; }
.subject-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 9px; }
.subject-tag { background: var(--subject-bg); color: var(--subject-text); border: 1px solid var(--subject-border); border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background .1s, color .1s; }
.subject-tag:hover, .subject-tag:focus { background: #d9c3e8; outline: none; }
.subject-tag.is-active { background: var(--subject-text); border-color: var(--subject-text); color: white; }
.link-icon-button { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--accent); background: var(--accent); color: var(--text) !important; text-decoration: none; transition: background .12s, border-color .12s; }
.link-icon-button svg { display: block; }
.link-icon-button:hover, .link-icon-button:focus-visible { background: var(--accent-dark); border-color: var(--accent-dark); outline: none; }
.empty-state, .error-state { background: white; border: 1px dashed var(--border); border-radius: var(--radius); padding: 28px; text-align: center; color: var(--muted); grid-column: 1/-1; }
.error-state { border-color: #cc3333; color: #992222; }

/* ── List view ── */
.card-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--card); box-shadow: 0 1px 4px rgba(30,23,16,.05); }
.resource-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; gap: 0 12px; align-items: start; padding: 9px 13px; border-bottom: 1px solid var(--border); transition: background .1s; }
.resource-row:last-child { border-bottom: none; }
.resource-row:hover { background: var(--accent-soft); }
.row-badges { display: flex; flex-direction: column; gap: 3px; padding-top: 2px; }
.resource-row .badge { justify-content: center; white-space: normal; text-align: center; }
.row-body { min-width: 0; }
.row-title { margin: 0 0 3px; font-size: 14px; font-weight: 700; line-height: 1.3; }
.row-description { -webkit-line-clamp: 2; margin-bottom: 5px; }
.row-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 5px; margin-bottom: 5px; color: var(--muted); font-size: 12px; }
.row-meta-date { font-weight: 600; white-space: nowrap; }
.row-meta-sep { color: var(--border); user-select: none; }
.row-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; padding-top: 1px; }
.row-links { display: flex; flex-direction: row; gap: 4px; }
.row-links .link-icon-button { width: 26px; height: 26px; }
.row-links .link-icon-button svg { width: 13px; height: 13px; }
.row-id-badge { margin-left: 0 !important; }
.row-type-label, .row-lang-label { display: block; width: 100%; border: none; background: none; padding: 0; margin: 0; font-family: inherit; font-size: 11px; font-weight: 700; color: var(--text); cursor: pointer; text-align: left; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; }
.row-lang-label { font-weight: 600; color: var(--subject-text); }
.row-type-label:hover, .row-type-label.is-active, .row-lang-label:hover, .row-lang-label.is-active { text-decoration: underline; }

/* ── Pagination ── */
.pagination { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 24px; padding-bottom: 4px; }
.pagination-button { min-width: 38px; height: 36px; padding: 0 11px; border: 1px solid var(--border); border-radius: var(--radius); background: white; color: var(--text); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; transition: background .1s, border-color .1s, color .1s; }
.pagination-button:hover:not(:disabled):not(.is-current) { border-color: var(--accent-dark); color: var(--text); background: var(--accent-soft); }
.pagination-button:focus-visible { outline: 2px solid var(--accent-dark); }
.pagination-button.is-current { background: var(--ink); border-color: var(--ink); color: white; cursor: default; }
.pagination-button:disabled { opacity: 0.38; cursor: not-allowed; }
.pagination-prev, .pagination-next { padding: 0 14px; }
.pagination-ellipsis { min-width: 26px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); font-size: 14px; user-select: none; pointer-events: none; }

/* ── Jump to top ── */
.jump-to-top { position: fixed; bottom: 24px; right: 24px; z-index: 500; width: 40px; height: 40px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); color: var(--ink); font-size: 18px; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(30,23,16,.1); opacity: 0; pointer-events: none; transition: opacity .2s, background .12s, color .12s; }
.jump-to-top.is-visible { opacity: 1; pointer-events: auto; }
.jump-to-top:hover { background: var(--ink); color: white; }
.jump-to-top:focus-visible { outline: 2px solid var(--accent-dark); }

/* ── Modals ── */
body.modal-open { overflow: hidden; }
.modal-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(30,23,16,.48); padding: 24px; overflow-y: auto; }
.modal-backdrop[hidden] { display: none; }
.modal-dialog { width: min(960px, 100%); margin: 0 auto; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,.18); overflow: hidden; }
.modal-dialog--narrow { width: min(560px, 100%); }
.modal-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; background: white; border-bottom: 1px solid var(--border); padding: 16px 20px; }
.modal-kicker { margin: 0 0 3px; color: var(--purple); font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.modal-header h2 { margin: 0; color: var(--ink); font-size: clamp(20px, 2.5vw, 30px); line-height: 1.1; letter-spacing: -0.02em; }
.modal-close { flex: 0 0 auto; width: 34px; height: 34px; border: 1px solid var(--border); border-radius: var(--radius); background: white; color: var(--ink); font-size: 22px; line-height: 1; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; transition: background .12s, color .12s; }
.modal-close:hover, .modal-close:focus { background: var(--ink); color: white; outline: none; }
.modal-body { padding: 20px; font-size: 14px; line-height: 1.6; color: var(--text); }
.modal-body h3 { margin: 18px 0 6px; font-size: 14px; font-weight: 700; color: var(--ink); }
.modal-body h3:first-child { margin-top: 0; }
.modal-body p { margin: 0 0 10px; }
.modal-body ul { margin: 0 0 10px; padding-left: 20px; }
.modal-body li { margin: 4px 0; }
.modal-body a { color: var(--purple); text-decoration: underline; }

/* ── Insights modals ── */
.language-modal-content { padding: 16px; }
.language-overview-grid { display: grid; grid-template-columns: repeat(3, minmax(110px, 1fr)); gap: 8px; margin-bottom: 12px; }
.language-overview-card, .language-insight-section, .language-action-strip { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); }
.language-overview-card { padding: 12px; }
.language-overview-number { display: block; color: var(--ink); font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
.language-overview-label { display: block; margin-top: 4px; color: var(--text); font-size: 12px; font-weight: 700; }
.language-overview-note, .insight-note, .diversity-row p, .section-heading-row p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
.language-action-strip { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px 14px; background: var(--accent-soft); color: var(--muted); font-size: 13px; flex-wrap: wrap; }
.language-missing-button { border: 1px solid var(--subject-border); border-radius: var(--radius); background: white; color: var(--subject-text); padding: 5px 11px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background .1s; }
.language-missing-button:hover { background: var(--subject-bg); }
.language-insight-grid { display: grid; grid-template-columns: minmax(220px, .85fr) minmax(260px, 1.15fr); gap: 12px; margin-top: 12px; }
.language-insight-section { padding: 14px; }
.language-insight-section h3 { margin: 0 0 10px; color: var(--ink); font-size: 16px; line-height: 1.2; }
.section-heading-row { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; }
.language-bar-list { display: grid; gap: 5px; }
.language-bar-button { width: 100%; display: grid; grid-template-columns: minmax(110px, .65fr) minmax(140px, 1fr) auto; gap: 9px; align-items: center; border: 1px solid transparent; border-radius: 5px; background: transparent; padding: 5px 7px; color: var(--text); font: inherit; cursor: pointer; text-align: left; transition: background .1s, border-color .1s; }
.language-bar-button:hover, .language-bar-button:focus { background: var(--accent-soft); border-color: var(--accent-dark); outline: none; }
.language-bar-label { overflow: hidden; text-overflow: ellipsis; font-size: 13px; font-weight: 600; }
.language-bar-track { height: 9px; overflow: hidden; border-radius: 2px; background: var(--bg); border: 1px solid var(--border); }
.language-bar-fill { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
.language-bar-count { min-width: 30px; color: var(--muted); font-size: 12px; font-weight: 700; text-align: right; }
.diversity-list { display: grid; gap: 11px; }
.diversity-row-top { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px; color: var(--text); font-size: 12px; font-weight: 700; }
.diversity-track { height: 9px; overflow: hidden; border-radius: 2px; background: var(--bg); border: 1px solid var(--border); }
.diversity-track span { display: block; height: 100%; border-radius: 2px; background: var(--accent); }
.rare-language-list { display: flex; flex-wrap: wrap; gap: 5px; max-height: 220px; overflow-y: auto; }
.rare-language-pill { border: 1px solid var(--subject-border); border-radius: 4px; background: var(--subject-bg); color: var(--subject-text); padding: 3px 7px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background .1s, color .1s; }
.rare-language-pill:hover, .rare-language-pill:focus { background: var(--subject-text); color: white; outline: none; }
.rare-language-pill span { opacity: .75; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}

/* ── Responsive ── */
@media (min-width: 1181px) {
  .app-layout { align-items: start; }
  .filters, .subject-panel { position: sticky; top: 14px; max-height: calc(100vh - 28px); overflow-y: auto; scrollbar-gutter: stable; }
  .publisher-filter-list, .author-filter-list, .event-filter-list, .resource-type-filter-list, .subject-filter-list { max-height: none; overflow-y: visible; }
}
@media (max-width: 1180px) {
  .app-layout { grid-template-columns: 210px minmax(0, 1fr); }
  .subject-panel { grid-column: 1 / -1; }
  .subject-filter-list { max-height: 320px; }
}
@media (max-width: 900px) {
  .header-inner { align-items: stretch; flex-direction: column; gap: 10px; }
  .site-header h1 { white-space: normal; }
  .search-panel { width: 100%; }
  .site-nav { flex-wrap: wrap; }
  .app-layout { grid-template-columns: 1fr; }
  .summary-stats { grid-template-columns: repeat(3, minmax(80px, 1fr)); }
  .modal-backdrop { padding: 12px; }
  .language-overview-grid, .language-insight-grid { grid-template-columns: 1fr 1fr; }
  .language-bar-button { grid-template-columns: 1fr auto; }
  .language-bar-track { grid-column: 1 / -1; }
  .resource-row { grid-template-columns: 1fr auto; grid-template-rows: auto auto; }
  .row-badges { grid-column: 1; grid-row: 1; flex-direction: row; }
  .row-body { grid-column: 1 / -1; grid-row: 2; }
  .row-actions { grid-column: 2; grid-row: 1; align-items: flex-end; }
}
@media (max-width: 620px) {
  .search-panel { flex-direction: column; }
  .results-toolbar { align-items: flex-start; flex-direction: column; }
  .results-toolbar-actions { flex-direction: column; align-items: flex-start; gap: 5px; }
  .summary-stats { grid-template-columns: 1fr 1fr; }
  .card-grid { grid-template-columns: 1fr; }
  .pagination-prev, .pagination-next { flex: 1; max-width: 140px; }
  .modal-header, .language-action-strip, .section-heading-row { align-items: flex-start; flex-direction: column; }
  .language-overview-grid, .language-insight-grid { grid-template-columns: 1fr; }
  .resource-row { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }
  .row-badges { grid-row: 1; flex-direction: row; }
  .row-body { grid-row: 2; }
  .row-actions { grid-column: 1; grid-row: 3; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start; }
  .row-links { flex-direction: row; width: auto; }
  .jump-to-top { bottom: 14px; right: 14px; }
}
