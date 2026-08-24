"use strict";

// Page size must match the server-side PAGE_SIZE constant in app.py.
var PAGE_SIZE = 24;

// Cached metadata from /api/metadata (campaign/skill lookup tables, static
// dataset totals). Populated once by loadMetadata().
var _metadata = null;

// Monotonically increasing request counter, used to discard stale responses
// when the user changes filters faster than responses arrive.
var _renderRequestId = 0;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
var state = {
  search: "",
  campaigns: [],
  skills: [],
  formats: [],
  projects: [],
  languages: [],
  topics: [],
  year: "",
  reviews: [],
  missing: {
    creator: false,
    url: false,
    language: false,
    topic: false,
    year: false,
    skill: false
  },
  sort: "title",
  page: 1,
  view: "grid"
};

// ---------------------------------------------------------------------------
// URL state — read, write, sync
// ---------------------------------------------------------------------------
function readStateFromUrl() {
  var params = new URLSearchParams(location.search);
  state.search    = params.get("q") || "";
  state.campaigns = params.getAll("campaign");
  state.skills    = params.getAll("skill");
  state.formats   = params.getAll("format");
  state.projects  = params.getAll("project");
  state.languages = params.getAll("lang");
  state.topics    = params.getAll("topic");
  state.year      = params.get("year") || "";
  state.reviews   = params.getAll("review");

  var missingStr   = params.get("missing") || "";
  var missingFlags = missingStr ? missingStr.split(",") : [];
  state.missing.creator  = missingFlags.indexOf("creator")  !== -1;
  state.missing.url      = missingFlags.indexOf("url")      !== -1;
  state.missing.language = missingFlags.indexOf("language") !== -1;
  state.missing.topic    = missingFlags.indexOf("topic")    !== -1;
  state.missing.year     = missingFlags.indexOf("year")     !== -1;
  state.missing.skill    = missingFlags.indexOf("skill")    !== -1;

  state.sort = params.get("sort") || "title";
  var page = parseInt(params.get("page"), 10);
  state.page = (page && page > 0) ? page : 1;
  state.view = (params.get("view") === "list") ? "list" : "grid";
}

function buildUrlParams() {
  var params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  state.campaigns.forEach(function (c) { params.append("campaign", c); });
  state.skills.forEach(function (s) { params.append("skill", s); });
  state.formats.forEach(function (f) { params.append("format", f); });
  state.projects.forEach(function (p) { params.append("project", p); });
  state.languages.forEach(function (l) { params.append("lang", l); });
  state.topics.forEach(function (t) { params.append("topic", t); });
  if (state.year) params.set("year", state.year);
  state.reviews.forEach(function (r) { params.append("review", r); });

  var missingFlags = [];
  if (state.missing.creator)  missingFlags.push("creator");
  if (state.missing.url)      missingFlags.push("url");
  if (state.missing.language) missingFlags.push("language");
  if (state.missing.topic)    missingFlags.push("topic");
  if (state.missing.year)     missingFlags.push("year");
  if (state.missing.skill)    missingFlags.push("skill");
  if (missingFlags.length) params.set("missing", missingFlags.join(","));

  if (state.sort && state.sort !== "title") params.set("sort", state.sort);
  if (state.page && state.page > 1) params.set("page", state.page);
  if (state.view === "list") params.set("view", "list");
  return params;
}

function replaceUrlState() {
  var params = buildUrlParams();
  var search = params.toString();
  var newUrl = search ? location.pathname + "?" + search : location.pathname;
  history.replaceState({ wia: true }, "", newUrl);
}

function syncUiToState() {
  document.getElementById("searchInput").value = state.search;
  document.getElementById("clearBtn").style.display = state.search ? "block" : "none";
  document.getElementById("sortSelect").value = state.sort;

  document.querySelectorAll("[data-skill]").forEach(function (btn) {
    var val = btn.dataset.skill;
    var isActive = (val === "all") ? state.skills.length === 0 : state.skills.indexOf(val) !== -1;
    btn.classList.toggle("active", isActive);
  });
  document.querySelectorAll("[data-missing]").forEach(function (btn) {
    btn.classList.toggle("active", !!state.missing[btn.dataset.missing]);
  });

  document.getElementById("gridBtn").classList.toggle("active", state.view === "grid");
  document.getElementById("listBtn").classList.toggle("active", state.view === "list");
  document.getElementById("cardsContainer").classList.toggle("list-view", state.view === "list");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function campaignLabel(id) {
  return (_metadata && _metadata.campaignMeta && _metadata.campaignMeta[id] && _metadata.campaignMeta[id].label) || id;
}
function campaignColor(id) {
  return (_metadata && _metadata.campaignMeta && _metadata.campaignMeta[id] && _metadata.campaignMeta[id].color) || "#784c99";
}
function campaignIcon(id) {
  return (_metadata && _metadata.campaignMeta && _metadata.campaignMeta[id] && _metadata.campaignMeta[id].icon) || "\uD83D\uDD17";
}
function skillLabel(id) {
  return (_metadata && _metadata.skillMeta && _metadata.skillMeta[id]) || id;
}
function skillBadgeClass(label) {
  if (label === "Beginner") return "badge-beginner";
  if (label === "Intermediate") return "badge-intermediate";
  if (label === "Advanced") return "badge-advanced";
  return "badge-format";
}
function toggleInArray(arr, value) {
  var idx = arr.indexOf(value);
  if (idx === -1) { arr.push(value); } else { arr.splice(idx, 1); }
}

// ---------------------------------------------------------------------------
// Metadata load — static, dataset-wide numbers (unaffected by filters)
// ---------------------------------------------------------------------------
function loadMetadata() {
  fetch("/api/metadata")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      _metadata = data;
      renderStaticSections();
    })
    .catch(function () {
      // Static sections stay at their placeholder "—" values.
    });
}

function renderStaticSections() {
  var m = _metadata;
  var campaignMeta = m.campaignMeta || {};
  var campaignTotals = m.campaigns || {};
  var skillTotals = m.skills || {};
  var reviewTotals = m.reviews || {};
  var projectTotals = m.projects || {};

  var total = m.totalResources || 0;
  var beg = skillTotals["Q26"] || 0;
  var int_ = skillTotals["Q27"] || 0;
  var adv = skillTotals["Q28"] || 0;
  var wla = (campaignTotals["Q4"] && campaignTotals["Q4"].count) || 0;
  var reviewed = reviewTotals["Reviewed"] || 0;
  var campCount = Object.keys(campaignTotals).length;
  var projCount = Object.keys(projectTotals).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statCampaigns").textContent = campCount;
  document.getElementById("statProjects").textContent = projCount || "\u2014";
  document.getElementById("sbTotal").textContent = total;
  document.getElementById("sbBeginner").textContent = beg;
  document.getElementById("sbIntermediate").textContent = int_;
  document.getElementById("sbAdvanced").textContent = adv;
  document.getElementById("sbWLA").textContent = wla;
  document.getElementById("sbReviewed").textContent = reviewed;
  document.getElementById("pathBeg").textContent = beg;
  document.getElementById("pathInt").textContent = int_;
  document.getElementById("pathAdv").textContent = adv;

  // Campaigns grid
  var campsGrid = document.getElementById("campsGrid");
  campsGrid.innerHTML = "";
  Object.keys(campaignMeta).forEach(function (id) {
    var meta = campaignMeta[id];
    var count = (campaignTotals[id] && campaignTotals[id].count) || 0;
    var div = document.createElement("div");
    div.className = "camp-card" + (state.campaigns.indexOf(id) !== -1 ? " active" : "");
    div.style.borderTopColor = meta.color;
    div.innerHTML =
      '<div class="camp-icon">' + meta.icon + '</div>' +
      '<div class="camp-name">' + escapeHtml(meta.label) + '</div>' +
      '<div class="camp-count"><span>' + count + '</span> resource' + (count !== 1 ? "s" : "") + '</div>';
    div.addEventListener("click", function () {
      if (state.campaigns.indexOf(id) !== -1) {
        state.campaigns = [];
      } else {
        state.campaigns = [id];
      }
      var el = document.getElementById("campaignFilter");
      if (el) el.value = state.campaigns[0] || "all";
      state.page = 1;
      render();
      document.getElementById("resources").scrollIntoView({ behavior: "smooth" });
    });
    campsGrid.appendChild(div);
  });

  // Project pills
  var pillsWrap = document.getElementById("projPills");
  pillsWrap.innerHTML = "";
  Object.keys(projectTotals).sort(function (a, b) { return projectTotals[b] - projectTotals[a]; }).forEach(function (p) {
    var btn = document.createElement("button");
    btn.className = "proj-pill" + (state.projects.indexOf(p) !== -1 ? " active" : "");
    btn.innerHTML = escapeHtml(p) + ' <span class="pill-count">' + projectTotals[p] + '</span>';
    btn.addEventListener("click", function () {
      if (state.projects.indexOf(p) !== -1) { state.projects = []; } else { state.projects = [p]; }
      state.page = 1;
      render();
      document.getElementById("resources").scrollIntoView({ behavior: "smooth" });
    });
    pillsWrap.appendChild(btn);
  });
}

// ---------------------------------------------------------------------------
// Contextual filter selects — rebuilt from live facet counts each render()
// ---------------------------------------------------------------------------
function buildSelect(selectEl, counts, selectedValues, allLabel, labelFn) {
  var keys = Object.keys(counts);
  keys.sort(function (a, b) { return counts[b] - counts[a]; });
  var html = '<option value="all">' + allLabel + '</option>';
  keys.forEach(function (k) {
    var label = labelFn ? labelFn(k) : k;
    var selected = selectedValues.indexOf(k) !== -1 ? " selected" : "";
    html += '<option value="' + escapeAttr(k) + '"' + selected + '>' + escapeHtml(label) + ' (' + counts[k] + ')</option>';
  });
  selectEl.innerHTML = html;
  if (selectedValues.length === 0) { selectEl.value = "all"; }
}
function escapeAttr(v) { return escapeHtml(v); }

function buildFilterSelects(facets) {
  buildSelect(document.getElementById("campaignFilter"), facets.campaigns, state.campaigns, "All campaigns", campaignLabel);
  buildSelect(document.getElementById("formatFilter"),   facets.formats,   state.formats,   "All formats");
  buildSelect(document.getElementById("languageFilter"), facets.languages, state.languages, "All languages");
  buildSelect(document.getElementById("topicFilter"),    facets.topics,    state.topics,    "All topics");
  buildSelect(document.getElementById("reviewFilter"),   facets.reviews,   state.reviews,   "Any review status");
}

// ---------------------------------------------------------------------------
// Active filter strip
// ---------------------------------------------------------------------------
function renderActiveFilters() {
  var el = document.getElementById("activeFilters");
  var chips = [];

  state.campaigns.forEach(function (c) {
    chips.push({ label: "Campaign: " + campaignLabel(c), clear: function () { state.campaigns = []; syncSelect("campaignFilter"); } });
  });
  state.skills.forEach(function (s) {
    chips.push({ label: "Skill: " + skillLabel(s), clear: function () { state.skills = []; } });
  });
  state.formats.forEach(function (f) {
    chips.push({ label: "Format: " + f, clear: function () { state.formats = []; syncSelect("formatFilter"); } });
  });
  state.projects.forEach(function (p) {
    chips.push({ label: "Project: " + p, clear: function () { state.projects = []; } });
  });
  state.languages.forEach(function (l) {
    chips.push({ label: "Language: " + l, clear: function () { state.languages = []; syncSelect("languageFilter"); } });
  });
  state.topics.forEach(function (t) {
    chips.push({ label: "Topic: " + t, clear: function () { state.topics = []; syncSelect("topicFilter"); } });
  });
  if (state.year) {
    chips.push({ label: "Year: " + state.year, clear: function () { state.year = ""; } });
  }
  state.reviews.forEach(function (r) {
    chips.push({ label: "Review: " + r, clear: function () { state.reviews = []; syncSelect("reviewFilter"); } });
  });
  Object.keys(state.missing).forEach(function (key) {
    if (state.missing[key]) {
      chips.push({ label: "Missing " + key, clear: function () { state.missing[key] = false; } });
    }
  });

  if (!chips.length) { el.innerHTML = ""; return; }
  el.innerHTML = "";
  chips.forEach(function (chip, i) {
    var btn = document.createElement("button");
    btn.className = "active-filter-chip";
    btn.innerHTML = escapeHtml(chip.label) + ' <span aria-hidden="true">\u00d7</span>';
    btn.addEventListener("click", function () {
      chip.clear();
      state.page = 1;
      syncUiToState();
      render();
    });
    el.appendChild(btn);
  });
}
function syncSelect(id) {
  var el = document.getElementById(id);
  if (el) el.value = "all";
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
function renderCards(items) {
  var container = document.getElementById("cardsContainer");
  container.querySelectorAll(".card").forEach(function (c) { c.remove(); });
  var empty = document.getElementById("emptyState");

  if (!items.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  items.forEach(function (m, i) {
    var color = campaignColor(m.campaignId);
    var skillLbl = m.skills && m.skills[0] ? m.skills[0] : "";
    var badges = "";
    if (skillLbl) badges += '<button type="button" class="badge ' + skillBadgeClass(skillLbl) + (state.skills.indexOf(m.skillIds[0]) !== -1 ? " is-active" : "") + '" data-skill-toggle="' + escapeAttr(m.skillIds[0]) + '">' + escapeHtml(skillLbl) + '</button>';
    (m.formats || []).slice(0, 1).forEach(function (f) {
      badges += '<button type="button" class="badge badge-format' + (state.formats.indexOf(f) !== -1 ? " is-active" : "") + '" data-format-toggle="' + escapeAttr(f) + '">' + escapeHtml(f) + '</button>';
    });
    (m.languages || []).slice(0, 1).forEach(function (l) {
      badges += '<button type="button" class="badge badge-lang' + (state.languages.indexOf(l) !== -1 ? " is-active" : "") + '" data-lang-toggle="' + escapeAttr(l) + '">' + escapeHtml(l) + '</button>';
    });
    (m.topics || []).slice(0, 2).forEach(function (t) {
      badges += '<button type="button" class="badge badge-topic' + (state.topics.indexOf(t) !== -1 ? " is-active" : "") + '" data-topic-toggle="' + escapeAttr(t) + '">' + escapeHtml(t) + '</button>';
    });

    var metaParts = [];
    if (m.topics && m.topics.length) metaParts.push(m.topics.join(", "));
    if (m.creators && m.creators.length) metaParts.push(m.creators.join(", "));
    if (m.year) metaParts.push(m.year);

    var card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = Math.min(i * 0.03, 0.4) + "s";
    card.innerHTML =
      '<div class="card-stripe" style="background:' + color + '"></div>' +
      '<div class="card-body">' +
        '<div class="card-badges">' + badges + '</div>' +
        '<div class="card-title">' + escapeHtml(m.title || "Untitled") + '</div>' +
        '<div class="card-meta">' + escapeHtml(metaParts.join(" \u00b7 ")) + '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        '<button type="button" class="card-campaign" data-campaign-toggle="' + escapeAttr(m.campaignId) + '">' + escapeHtml(m.campaign || "") + '</button>' +
        '<a class="card-link" href="' + escapeAttr(m.primaryUrl || m.itemUrl) + '" target="_blank" rel="noopener">View \u2197</a>' +
      '</div>';
    container.appendChild(card);
  });

  container.querySelectorAll("[data-skill-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      toggleInArray(state.skills, btn.dataset.skillToggle);
      state.page = 1; syncUiToState(); render();
    });
  });
  container.querySelectorAll("[data-format-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.formats = state.formats.indexOf(btn.dataset.formatToggle) !== -1 ? [] : [btn.dataset.formatToggle];
      state.page = 1; render();
    });
  });
  container.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.languages = state.languages.indexOf(btn.dataset.langToggle) !== -1 ? [] : [btn.dataset.langToggle];
      state.page = 1; render();
    });
  });
  container.querySelectorAll("[data-topic-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.topics = state.topics.indexOf(btn.dataset.topicToggle) !== -1 ? [] : [btn.dataset.topicToggle];
      state.page = 1; render();
    });
  });
  container.querySelectorAll("[data-campaign-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.campaigns = state.campaigns.indexOf(btn.dataset.campaignToggle) !== -1 ? [] : [btn.dataset.campaignToggle];
      state.page = 1; render();
    });
  });
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
function renderPagination(total, totalPages) {
  var el = document.getElementById("pagination");
  el.innerHTML = "";
  if (totalPages <= 1) return;

  var current = state.page;
  function pageBtn(label, page, opts) {
    opts = opts || {};
    var btn = document.createElement("button");
    btn.className = "page-btn" + (opts.current ? " is-current" : "");
    btn.textContent = label;
    if (opts.disabled) { btn.disabled = true; }
    else {
      btn.addEventListener("click", function () {
        state.page = page;
        render();
        document.getElementById("resources").scrollIntoView({ behavior: "smooth" });
      });
    }
    return btn;
  }

  el.appendChild(pageBtn("\u2190 Prev", current - 1, { disabled: current === 1 }));

  var wing = 2;
  var rangeStart = Math.max(2, current - wing);
  var rangeEnd = Math.min(totalPages - 1, current + wing);
  el.appendChild(pageBtn("1", 1, { current: current === 1 }));
  if (rangeStart > 2) {
    var e1 = document.createElement("span"); e1.className = "page-ellipsis"; e1.textContent = "\u2026"; el.appendChild(e1);
  }
  for (var p = rangeStart; p <= rangeEnd; p++) {
    el.appendChild(pageBtn(String(p), p, { current: p === current }));
  }
  if (rangeEnd < totalPages - 1) {
    var e2 = document.createElement("span"); e2.className = "page-ellipsis"; e2.textContent = "\u2026"; el.appendChild(e2);
  }
  if (totalPages > 1) {
    el.appendChild(pageBtn(String(totalPages), totalPages, { current: current === totalPages }));
  }
  el.appendChild(pageBtn("Next \u2192", current + 1, { disabled: current === totalPages }));
}

// ---------------------------------------------------------------------------
// Main render — calls the API
// ---------------------------------------------------------------------------
function render() {
  var requestId = ++_renderRequestId;
  replaceUrlState();
  document.getElementById("resultCount").textContent = "\u2026";

  var params = buildUrlParams();
  params.delete("view");

  fetch("/api/resources?" + params.toString())
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (requestId !== _renderRequestId) return;

      state.page = data.page;
      document.getElementById("exportCsvBtn").disabled = false;
      buildFilterSelects(data.facets);
      renderActiveFilters();
      document.getElementById("resultCount").textContent = data.total;
      renderCards(data.results);
      renderPagination(data.total, data.totalPages);
    })
    .catch(function (err) {
      if (requestId !== _renderRequestId) return;
      document.getElementById("resultCount").textContent = "\u2014";
      var container = document.getElementById("cardsContainer");
      container.querySelectorAll(".card").forEach(function (c) { c.remove(); });
      document.getElementById("emptyState").style.display = "none";
      var errEl = document.createElement("div");
      errEl.className = "error-state";
      errEl.style.gridColumn = "1/-1";
      errEl.textContent = "Could not load resources. Make sure the server is running.";
      container.appendChild(errEl);
      console.error("API error:", err);
    });
}

// ---------------------------------------------------------------------------
// CSV export — fetches all filtered results from the server
// ---------------------------------------------------------------------------
function csvQuote(value) {
  var str = value === null || value === undefined ? "" : String(value);
  return '"' + str.replace(/"/g, '""') + '"';
}
function exportCsv() {
  var btn = document.getElementById("exportCsvBtn");
  btn.disabled = true;
  btn.textContent = "Exporting\u2026";

  var params = buildUrlParams();
  params.set("all", "1");
  params.delete("page");
  params.delete("view");

  fetch("/api/resources?" + params.toString())
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var columns = ["id", "title", "campaign", "skills", "formats", "projects", "languages", "topics", "creators", "year", "reviews", "primary_url", "item_url"];
      var rows = [columns.map(csvQuote).join(",")];
      data.results.forEach(function (r) {
        rows.push([
          r.id, r.title, r.campaign,
          (r.skills || []).join(" | "),
          (r.formats || []).join(" | "),
          (r.projects || []).join(" | "),
          (r.languages || []).join(" | "),
          (r.topics || []).join(" | "),
          (r.creators || []).join(" | "),
          r.year, (r.reviews || []).join(" | "),
          r.primaryUrl, r.itemUrl
        ].map(csvQuote).join(","));
      });
      var csv = rows.join("\r\n");
      var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      var today = new Date();
      a.download = "wia-resources-" + today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0") + ".csv";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      btn.disabled = false;
      btn.textContent = "\u2b07 Export CSV";
    })
    .catch(function () {
      alert("Export failed. Please try again.");
      btn.disabled = false;
      btn.textContent = "\u2b07 Export CSV";
    });
}

// ---------------------------------------------------------------------------
// Copy link
// ---------------------------------------------------------------------------
function copyLink() {
  var btn = document.getElementById("copyLinkBtn");
  function done() {
    btn.textContent = "\u2713 Copied";
    btn.classList.add("tool-btn--copied");
    setTimeout(function () {
      btn.textContent = "\uD83D\uDD17 Copy link";
      btn.classList.remove("tool-btn--copied");
    }, 2200);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(location.href).then(done).catch(function () { legacyCopy(location.href, done); });
  } else {
    legacyCopy(location.href, done);
  }
}
function legacyCopy(text, done) {
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } finally { document.body.removeChild(ta); }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
function clearAllFilters() {
  state.search = "";
  state.campaigns = [];
  state.skills = [];
  state.formats = [];
  state.projects = [];
  state.languages = [];
  state.topics = [];
  state.year = "";
  state.reviews = [];
  state.missing = { creator: false, url: false, language: false, topic: false, year: false, skill: false };
  state.page = 1;
  syncUiToState();
  render();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  readStateFromUrl();
  syncUiToState();

  var searchDebounce = null;
  document.getElementById("searchInput").addEventListener("input", function (e) {
    state.search = e.target.value.trim();
    document.getElementById("clearBtn").style.display = state.search ? "block" : "none";
    state.page = 1;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(render, 300);
  });
  document.getElementById("clearBtn").addEventListener("click", clearAllFilters);

  document.querySelectorAll("[data-skill]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var val = btn.dataset.skill;
      state.skills = (val === "all") ? [] : [val];
      state.page = 1;
      syncUiToState();
      render();
    });
  });
  document.querySelectorAll("[data-skill-jump]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.skills = [btn.dataset.skillJump];
      state.page = 1;
      syncUiToState();
      render();
      document.getElementById("resources").scrollIntoView({ behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-missing]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.dataset.missing;
      state.missing[key] = !state.missing[key];
      state.page = 1;
      syncUiToState();
      render();
    });
  });

  ["campaignFilter", "formatFilter", "languageFilter", "topicFilter", "reviewFilter"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function (e) {
      var val = e.target.value;
      var map = {
        campaignFilter: "campaigns",
        formatFilter: "formats",
        languageFilter: "languages",
        topicFilter: "topics",
        reviewFilter: "reviews"
      };
      state[map[id]] = (val === "all") ? [] : [val];
      state.page = 1;
      render();
    });
  });

  document.getElementById("sortSelect").addEventListener("change", function (e) {
    state.sort = e.target.value;
    state.page = 1;
    render();
  });

  document.getElementById("gridBtn").addEventListener("click", function () {
    state.view = "grid"; syncUiToState(); replaceUrlState();
  });
  document.getElementById("listBtn").addEventListener("click", function () {
    state.view = "list"; syncUiToState(); replaceUrlState();
  });

  document.getElementById("copyLinkBtn").addEventListener("click", copyLink);
  document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);
  document.getElementById("navBrand").addEventListener("click", clearAllFilters);

  window.addEventListener("popstate", function () {
    readStateFromUrl();
    syncUiToState();
    render();
  });

  loadMetadata();
  render();
});
