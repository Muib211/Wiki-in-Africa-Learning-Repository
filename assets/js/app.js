/* global $ */
"use strict";

// Page size must match the server-side PAGE_SIZE constant in app.py.
var PAGE_SIZE = 24;

// Cached metadata from /api/metadata (campaign/skill lookup tables, dataset
// totals, precomputed insights). Populated by loadMetadata().
var _metadata = null;

// Cached facets from the most recent /api/resources response. Used to
// rebuild filter panels on local search-within-panel changes without a new
// API call.
var _lastFacets = {};

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
  language: "",
  year: "",
  reviews: [],
  topics: [],
  topicSearch: "",
  creatorSearch: "",
  creators: [],
  projectSearch: "",
  projects: [],
  maintenance: {
    missingCreator: false,
    missingUrl: false,
    missingLanguage: false,
    missingTopic: false,
    missingYear: false,
    missingSkill: false
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
  state.language  = params.get("lang") || "";
  state.year      = params.get("year") || "";
  state.reviews   = params.getAll("review");
  state.topics    = params.getAll("topic");
  state.creators  = params.getAll("creator");
  state.projects  = params.getAll("project");

  var missingStr   = params.get("missing") || "";
  var missingFlags = missingStr ? missingStr.split(",") : [];
  state.maintenance.missingCreator  = missingFlags.indexOf("creator")  !== -1;
  state.maintenance.missingUrl      = missingFlags.indexOf("url")      !== -1;
  state.maintenance.missingLanguage = missingFlags.indexOf("language") !== -1;
  state.maintenance.missingTopic    = missingFlags.indexOf("topic")    !== -1;
  state.maintenance.missingYear     = missingFlags.indexOf("year")     !== -1;
  state.maintenance.missingSkill    = missingFlags.indexOf("skill")    !== -1;

  state.sort = params.get("sort") || "title";
  var page = parseInt(params.get("page"), 10);
  state.page = (page && page > 0) ? page : 1;
  var view = params.get("view");
  state.view = (view === "list") ? "list" : "grid";

  state.topicSearch = "";
  state.creatorSearch = "";
  state.projectSearch = "";
}

function buildUrlParams() {
  var params = new URLSearchParams();
  if (state.search)   params.set("q", state.search);
  if (state.language) params.set("lang", state.language);
  if (state.year)     params.set("year", state.year);
  $.each(state.campaigns, function (i, c) { params.append("campaign", c); });
  $.each(state.skills,    function (i, s) { params.append("skill", s); });
  $.each(state.formats,   function (i, f) { params.append("format", f); });
  $.each(state.reviews,   function (i, r) { params.append("review", r); });
  $.each(state.topics,    function (i, t) { params.append("topic", t); });
  $.each(state.creators,  function (i, c) { params.append("creator", c); });
  $.each(state.projects,  function (i, p) { params.append("project", p); });

  var missingFlags = [];
  if (state.maintenance.missingCreator)  missingFlags.push("creator");
  if (state.maintenance.missingUrl)      missingFlags.push("url");
  if (state.maintenance.missingLanguage) missingFlags.push("language");
  if (state.maintenance.missingTopic)    missingFlags.push("topic");
  if (state.maintenance.missingYear)     missingFlags.push("year");
  if (state.maintenance.missingSkill)    missingFlags.push("skill");
  if (missingFlags.length) params.set("missing", missingFlags.join(","));

  if (state.sort && state.sort !== "title") params.set("sort", state.sort);
  if (state.page && state.page > 1)         params.set("page", state.page);
  if (state.view === "list")                params.set("view", "list");
  return params;
}

function replaceUrlState() {
  var params = buildUrlParams();
  var search = params.toString();
  var newUrl = search ? location.pathname + "?" + search : location.pathname;
  history.replaceState({ wia: true }, "", newUrl);
}

function syncUiToState() {
  $("#searchInput").val(state.search);
  $("#languageFilter").val(state.language);
  $("#sortSelect").val(state.sort);
  $("#missingCreatorFilter").prop("checked", state.maintenance.missingCreator);
  $("#missingUrlFilter").prop("checked", state.maintenance.missingUrl);
  $("#missingLanguageFilter").prop("checked", state.maintenance.missingLanguage);
  $("#missingTopicFilter").prop("checked", state.maintenance.missingTopic);
  $("#missingYearFilter").prop("checked", state.maintenance.missingYear);
  $("#missingSkillFilter").prop("checked", state.maintenance.missingSkill);
  updateImproveDataCount();
  $("#viewGrid").attr("aria-pressed", state.view === "grid").toggleClass("is-active", state.view === "grid");
  $("#viewList").attr("aria-pressed", state.view === "list").toggleClass("is-active", state.view === "list");
  $("#topicSearchInput").val("");
  $("#creatorSearchInput").val("");
  $("#projectSearchInput").val("");
}

// ---------------------------------------------------------------------------
// Copy-link / CSV export
// ---------------------------------------------------------------------------
function initCopyLinkButton() {
  $("#copyLinkButton").on("click", function () {
    var url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(showCopied).catch(function () { legacyCopy(url); });
    } else {
      legacyCopy(url);
    }
  });
}
function legacyCopy(text) {
  var ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); showCopied(); } finally { document.body.removeChild(ta); }
}
function showCopied() {
  var $btn = $("#copyLinkButton");
  $btn.text("\u2713 Copied").addClass("copy-link-button--copied");
  setTimeout(function () { $btn.text("Copy link").removeClass("copy-link-button--copied"); }, 2200);
}

function initExportCsvButton() {
  $("#exportCsvButton").on("click", exportCsv);
}
function csvQuote(value) {
  var str = (value === null || value === undefined) ? "" : String(value);
  return '"' + str.replace(/"/g, '""') + '"';
}
function exportCsv() {
  var $btn = $("#exportCsvButton");
  $btn.prop("disabled", true).text("Exporting\u2026");
  var params = buildUrlParams();
  params.set("all", "1");
  params.delete("page");
  params.delete("view");
  $.getJSON("/api/resources?" + params.toString())
    .done(function (data) {
      var columns = ["id", "title", "campaign", "skills", "formats", "projects", "languages", "topics", "creators", "year", "reviews", "primary_url", "item_url"];
      var rows = [columns.map(csvQuote).join(",")];
      $.each(data.results, function (i, r) {
        var row = [
          r.id, r.title, r.campaign,
          (r.skills || []).join(" | "), (r.formats || []).join(" | "), (r.projects || []).join(" | "),
          (r.languages || []).join(" | "), (r.topics || []).join(" | "), (r.creators || []).join(" | "),
          r.year, (r.reviews || []).join(" | "), r.primaryUrl, r.itemUrl
        ].map(csvQuote).join(",");
        rows.push(row);
      });
      var csv = rows.join("\r\n");
      var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      var today = new Date();
      a.download = "wia-resources-" + today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0") + ".csv";
      a.style.display = "none";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      $btn.prop("disabled", false).text("Export CSV");
    })
    .fail(function () {
      alert("Export failed. Please try again.");
      $btn.prop("disabled", false).text("Export CSV");
    });
}

// ---------------------------------------------------------------------------
// View toggle / nav modals / title reset / jump to top
// ---------------------------------------------------------------------------
function initViewToggle() {
  $("#viewGrid").on("click", function () { if (state.view !== "grid") { state.view = "grid"; syncUiToState(); render(); } });
  $("#viewList").on("click", function () { if (state.view !== "list") { state.view = "list"; syncUiToState(); render(); } });
}
function initNavMenu() {
  function openModal(id, focusTarget) { $(id).prop("hidden", false); $("body").addClass("modal-open"); $(focusTarget).focus(); }
  function closeModal(id, returnFocus) { $(id).prop("hidden", true); $("body").removeClass("modal-open"); $(returnFocus).focus(); }
  $("#navAbout").on("click", function () { openModal("#aboutModal", "#aboutModal .modal-close"); });
  $("#closeAboutModal").on("click", function () { closeModal("#aboutModal", "#navAbout"); });
  $("#aboutModal").on("click", function (e) { if (e.target === this) closeModal("#aboutModal", "#navAbout"); });
  $("#navContribute").on("click", function () { openModal("#contributeModal", "#contributeModal .modal-close"); });
  $("#closeContributeModal").on("click", function () { closeModal("#contributeModal", "#navContribute"); });
  $("#contributeModal").on("click", function (e) { if (e.target === this) closeModal("#contributeModal", "#navContribute"); });
  $(document).on("keydown.navModals", function (e) {
    if (e.key !== "Escape") return;
    if (!$("#aboutModal").prop("hidden")) closeModal("#aboutModal", "#navAbout");
    if (!$("#contributeModal").prop("hidden")) closeModal("#contributeModal", "#navContribute");
  });
}
function initTitleReset() {
  $("#brandTitle").on("click", function () { clearAllFilters(); })
    .attr("title", "Reset to default view");
}
function initJumpToTop() {
  var $btn = $("#jumpToTop");
  $(window).on("scroll.jumpToTop", function () { $btn.toggleClass("is-visible", $(window).scrollTop() > 300); });
  $btn.on("click", function () { $("html, body").animate({ scrollTop: 0 }, 220); });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
$(function () {
  readStateFromUrl();

  var _searchDebounce = null;
  $("#searchInput").on("input", function () {
    state.search = $(this).val().trim().toLowerCase();
    state.page = 1;
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(render, 300);
  });
  $("#creatorSearchInput").on("input", function () { state.creatorSearch = $(this).val().trim().toLowerCase(); buildCreatorFilters(_lastFacets); });
  $("#projectSearchInput").on("input", function () { state.projectSearch = $(this).val().trim().toLowerCase(); buildProjectFilters(_lastFacets); });
  $("#topicSearchInput").on("input", function () { state.topicSearch = $(this).val().trim().toLowerCase(); buildTopicPanel(_lastFacets); });
  $("#clearSearch").on("click", function () { clearAllFilters(); });

  $("#languageFilter").on("change", function () { state.language = $(this).val(); state.page = 1; render(); });
  $("#sortSelect").on("change", function () { state.sort = $(this).val(); state.page = 1; render(); });

  $.each(["missingCreator", "missingUrl", "missingLanguage", "missingTopic", "missingYear", "missingSkill"], function (i, key) {
    $("#" + key + "Filter").on("change", function () {
      state.maintenance[key] = $(this).is(":checked");
      state.page = 1; updateImproveDataCount(); render();
    });
  });

  $("#resetFilters").on("click", function () { clearAllFilters(); });
  $("#closeLanguageInsights").on("click", function () { closeLanguageInsights(); });
  $("#closeTopicInsights").on("click", function () { closeTopicInsights(); });
  $("#languageInsightsModal").on("click", function (e) { if (e.target === this) closeLanguageInsights(); });
  $("#topicInsightsModal").on("click", function (e) { if (e.target === this) closeTopicInsights(); });
  $(document).on("keydown", function (e) { if (e.key === "Escape") { closeLanguageInsights(); closeTopicInsights(); } });

  $(window).on("popstate", function () { readStateFromUrl(); syncUiToState(); render(); });

  initCopyLinkButton();
  initExportCsvButton();
  initViewToggle();
  initNavMenu();
  initTitleReset();
  initJumpToTop();

  loadMetadata();
  render();
});

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------
function clearAllFilters() {
  state.search = ""; state.campaigns = []; state.skills = []; state.formats = [];
  state.language = ""; state.year = ""; state.reviews = [];
  state.topics = []; state.topicSearch = "";
  state.creators = []; state.creatorSearch = "";
  state.projects = []; state.projectSearch = "";
  state.maintenance.missingCreator = false;
  state.maintenance.missingUrl = false;
  state.maintenance.missingLanguage = false;
  state.maintenance.missingTopic = false;
  state.maintenance.missingYear = false;
  state.maintenance.missingSkill = false;
  state.page = 1;
  syncUiToState();
  render();
}

// ---------------------------------------------------------------------------
// Metadata (labels/icons/dataset stats/insights)
// ---------------------------------------------------------------------------
function campaignMeta(id) { return (_metadata && _metadata.campaignMeta && _metadata.campaignMeta[id]) || {}; }
function campaignLabel(id) { return campaignMeta(id).label || id; }
function skillLabel(id) { return (_metadata && _metadata.skillMeta && _metadata.skillMeta[id]) || id; }

function loadMetadata() {
  $.getJSON("/api/metadata")
    .done(function (data) {
      _metadata = data;
      var note = "Data last updated: unknown";
      if (data.generatedAt) {
        var date = new Date(data.generatedAt);
        if (!isNaN(date.getTime())) {
          note = "Data last updated: " + date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        }
      }
      $("#dataUpdatedAt").text(note);
      renderSummaryStats();
    })
    .fail(function () { $("#dataUpdatedAt").text("Data last updated: unknown"); });
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------
function normalizeResources(data) {
  var normalized = [];
  $.each(data, function (i, r) {
    normalized.push({
      id:          r.id || "",
      title:       r.title || r.id || "",
      titleIsFallback: !!r.titleIsFallback,
      campaignId:  r.campaignId || "",
      campaign:    r.campaign || "",
      skillIds:    r.skillIds || [],
      skills:      r.skills || [],
      formats:     r.formats || [],
      projectIds:  r.projectIds || [],
      projects:    r.projects || [],
      languages:   r.languages || [],
      topics:      r.topics || [],
      creators:    r.creators || [],
      urls:        r.urls || [],
      primaryUrl:  r.primaryUrl || "",
      year:        r.year || "",
      reviews:     r.reviews || [],
      itemUrl:     r.itemUrl || "",
      missing:     r.missing || {}
    });
  });
  return normalized;
}

// ---------------------------------------------------------------------------
// Filter panel builders — receive facet counts from the API response
// ---------------------------------------------------------------------------
function buildCheckboxFacet(containerSel, countSel, counts, selectedArr, labelFn, dataAttr, onToggle) {
  var keys = Object.keys(counts || {});
  keys.sort(function (a, b) { return (labelFn(a) || a).localeCompare(labelFn(b) || b); });
  setCollapsibleCount(countSel, selectedArr.length, keys.length);
  if (!keys.length) {
    $(containerSel).html('<p class="filter-empty">None found.</p>');
    return;
  }
  var html = "";
  $.each(keys, function (i, key) {
    var activeClass = selectedArr.indexOf(key) !== -1 ? " is-active" : "";
    html += '<button type="button" class="resource-type-filter-button' + activeClass + '" data-' + dataAttr + '="' + escapeAttribute(key) + '">';
    html += '<span class="resource-type-filter-name">' + escapeHtml(labelFn(key) || key) + "</span>";
    html += '<span class="resource-type-filter-count">' + counts[key] + "</span>";
    html += "</button>";
  });
  $(containerSel).html(html);
  $(containerSel + " .resource-type-filter-button").on("click", function () { onToggle($(this).attr("data-" + dataAttr)); });
}

function buildCampaignFilter(facets) {
  buildCheckboxFacet("#campaignFilters", "#campaignCount", facets.campaigns, state.campaigns, campaignLabel, "campaign-id", function (id) {
    toggleInArray(state.campaigns, id); state.page = 1; render();
  });
}
function buildSkillFilter(facets) {
  buildCheckboxFacet("#skillFilters", "#skillCount", facets.skills, state.skills, skillLabel, "skill-id", function (id) {
    toggleInArray(state.skills, id); state.page = 1; render();
  });
}
function buildFormatFilter(facets) {
  buildCheckboxFacet("#formatFilters", "#formatCount", facets.formats, state.formats, function (v) { return v; }, "format", function (v) {
    toggleInArray(state.formats, v); state.page = 1; render();
  });
}
function buildReviewFilter(facets) {
  buildCheckboxFacet("#reviewFilters", "#reviewCount", facets.reviews, state.reviews, function (v) { return v; }, "review", function (v) {
    toggleInArray(state.reviews, v); state.page = 1; render();
  });
}

function buildLanguageFilter(facets) {
  var langCounts = facets.languages || {};
  var languages = Object.keys(langCounts);
  languages.sort(function (a, b) { if (langCounts[b] !== langCounts[a]) return langCounts[b] - langCounts[a]; return a.localeCompare(b); });
  var html = '<option value="">All languages</option>';
  $.each(languages, function (i, l) {
    html += '<option value="' + escapeAttribute(l) + '"' + (state.language === l ? " selected" : "") + ">" + escapeHtml(l) + " (" + langCounts[l] + ")</option>";
  });
  $("#languageFilter").html(html);
}

function buildYearFilter(facets) {
  var yearCounts = facets.years || {};
  var noDate = facets.yearNoDate || 0;
  var years = Object.keys(yearCounts).sort();
  setCollapsibleCount("#yearFilterCount", state.year ? 1 : 0, years.length);
  if (!years.length) { $("#yearFilters").html('<p class="filter-empty">No years found.</p>'); return; }
  var maxCount = 0;
  $.each(years, function (i, y) { if (yearCounts[y] > maxCount) maxCount = yearCounts[y]; });
  var html = "";
  $.each(years, function (i, year) {
    var pct = maxCount ? Math.round((yearCounts[year] / maxCount) * 100) : 0;
    var active = state.year === year;
    html += '<button type="button" class="year-bar-button' + (active ? " is-active" : "") + '" data-year="' + escapeAttribute(year) + '">';
    html += '<span class="year-bar-label">' + escapeHtml(year) + "</span>";
    html += '<span class="year-bar-track"><span class="year-bar-fill" style="width:' + pct + '%"></span></span>';
    html += '<span class="year-bar-count">' + yearCounts[year] + "</span></button>";
  });
  if (noDate) html += '<p class="year-no-date">No year: ' + noDate + "</p>";
  $("#yearFilters").html(html);
  $(".year-bar-button").on("click", function () {
    var year = $(this).attr("data-year");
    state.year = (state.year === year) ? "" : year;
    state.page = 1; render();
  });
}

function buildSearchableList(containerSel, countSel, counts, selectedArr, searchTerm, dataAttr, onToggle) {
  var keys = Object.keys(counts || {});
  keys.sort(function (a, b) { if (counts[b] !== counts[a]) return counts[b] - counts[a]; return a.localeCompare(b); });
  if (searchTerm) keys = keys.filter(function (k) { return k.toLowerCase().indexOf(searchTerm) !== -1; });
  setCollapsibleCount(countSel, selectedArr.length, keys.length);
  if (!keys.length) { $(containerSel).html('<p class="filter-empty">None found.</p>'); return; }
  var html = "";
  $.each(keys, function (i, key) {
    var activeClass = selectedArr.indexOf(key) !== -1 ? " is-active" : "";
    html += '<button type="button" class="publisher-filter-button' + activeClass + '" data-' + dataAttr + '="' + escapeAttribute(key) + '">';
    html += '<span class="publisher-filter-name">' + escapeHtml(key) + "</span>";
    html += '<span class="publisher-filter-count">' + counts[key] + "</span></button>";
  });
  $(containerSel).html(html);
  $(containerSel + " .publisher-filter-button").on("click", function () { onToggle($(this).attr("data-" + dataAttr)); });
}
function buildCreatorFilters(facets) {
  buildSearchableList("#creatorFilters", "#creatorCount", (facets && facets.creators) || {}, state.creators, state.creatorSearch, "creator", function (v) {
    toggleInArray(state.creators, v); state.page = 1; render();
  });
}
function buildProjectFilters(facets) {
  buildSearchableList("#projectFilters", "#projectCount", (facets && facets.projects) || {}, state.projects, state.projectSearch, "project", function (v) {
    toggleInArray(state.projects, v); state.page = 1; render();
  });
}
function buildTopicPanel(facets) {
  var subjectCounts = (facets && facets.topics) || {};
  var topics = Object.keys(subjectCounts);
  topics.sort(function (a, b) { if (subjectCounts[b] !== subjectCounts[a]) return subjectCounts[b] - subjectCounts[a]; return a.localeCompare(b); });
  if (state.topicSearch) topics = topics.filter(function (t) { return t.toLowerCase().indexOf(state.topicSearch) !== -1; });
  setCollapsibleCount("#topicCount", state.topics.length, topics.length);
  if (!topics.length) { $("#topicFilters").html('<p class="filter-empty">No topics found.</p>'); return; }
  var html = "";
  $.each(topics, function (i, topic) {
    var activeClass = state.topics.indexOf(topic) !== -1 ? " is-active" : "";
    html += '<button type="button" class="subject-filter-button' + activeClass + '" data-topic="' + escapeAttribute(topic) + '">';
    html += '<span class="subject-filter-name">' + escapeHtml(topic) + "</span>";
    html += '<span class="subject-filter-count">' + subjectCounts[topic] + "</span></button>";
  });
  $("#topicFilters").html(html);
  $(".subject-filter-button").on("click", function () { toggleTopicFilter($(this).data("topic")); });
}

function setCollapsibleCount(selector, activeCount, shownCount) {
  var text = shownCount + " shown";
  if (activeCount) { text = activeCount + " active \u00b7 " + text; $(selector).addClass("has-active"); }
  else { $(selector).removeClass("has-active"); }
  $(selector).text(text);
}
function updateImproveDataCount() {
  var active = 0;
  $.each(state.maintenance, function (key, isOn) { if (isOn) active++; });
  var $count = $("#improveDataCount");
  if (active) $count.text(active + " active").addClass("has-active");
  else $count.text("").removeClass("has-active");
}

// ---------------------------------------------------------------------------
// Main render — async, calls the API
// ---------------------------------------------------------------------------
function render() {
  var requestId = ++_renderRequestId;
  replaceUrlState();
  $("#resultCount").text("Loading resources\u2026");
  $("#results").attr("aria-busy", "true");

  var params = buildUrlParams();
  params.delete("view");

  $.getJSON("/api/resources?" + params.toString())
    .done(function (data) {
      if (requestId !== _renderRequestId) return;
      _lastFacets = data.facets;
      state.page = data.page;
      $("#exportCsvButton").prop("disabled", false);

      buildCampaignFilter(data.facets);
      buildSkillFilter(data.facets);
      buildFormatFilter(data.facets);
      buildReviewFilter(data.facets);
      buildLanguageFilter(data.facets);
      buildYearFilter(data.facets);
      buildCreatorFilters(data.facets);
      buildProjectFilters(data.facets);
      buildTopicPanel(data.facets);

      renderActiveFilters();

      var from = (data.page - 1) * data.pageSize + 1;
      var to = Math.min(data.page * data.pageSize, data.total);
      $("#resultCount").text(data.total ? (data.total <= PAGE_SIZE ? data.total + " resources" : from + "\u2013" + to + " of " + data.total + " resources") : "0 resources");

      if (!data.total) {
        $("#results").attr("aria-busy", "false").removeClass("card-grid card-list")
          .html('<div class="empty-state">No resources found. Try another search term, language, topic, campaign, creator, or project.</div>');
        $("#pagination").empty();
        return;
      }

      var pageItems = normalizeResources(data.results);
      var html = (state.view === "list") ? renderListItems(pageItems) : renderCardItems(pageItems);
      $("#results").attr("aria-busy", "false").removeClass("card-grid card-list").addClass(state.view === "list" ? "card-list" : "card-grid").html(html);
      bindResultEvents();
      renderPagination(data.total, data.totalPages);
    })
    .fail(function (xhr, status, error) {
      if (requestId !== _renderRequestId) return;
      $("#resultCount").text("Could not load resources");
      $("#results").attr("aria-busy", "false").empty();
      $("#statusMessage").html('<div class="error-state"><strong>Could not load resources.</strong><br>Make sure the server is running.</div>');
      console.error("API error:", status, error);
    });
}

// ---------------------------------------------------------------------------
// Item renderers
// ---------------------------------------------------------------------------
var LINK_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M6.5 3H3.75A1.75 1.75 0 0 0 2 4.75v7.5C2 13.216 2.784 14 3.75 14h7.5A1.75 1.75 0 0 0 13 12.25V9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M9 2h5v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M14 2 7.5 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function linkIconButton(url, label) {
  return '<a class="link-icon-button" href="' + escapeAttribute(url) + '" target="_blank" rel="noopener" title="' + escapeAttribute(label) + '" aria-label="' + escapeAttribute(label) + '">' + LINK_ICON_SVG + "</a>";
}
function renderLinkIcons(resource) {
  var html = "";
  $.each(resource.urls, function (i, url) { html += linkIconButton(url, "Open resource"); });
  return html;
}

function renderBadges(resource, context) {
  var html = "";
  var campActive = state.campaigns.indexOf(resource.campaignId) !== -1 ? " is-active" : "";
  if (context === "list") {
    if (resource.campaign) {
      html += '<button type="button" class="row-type-label' + campActive + '" data-campaign-id="' + escapeAttribute(resource.campaignId) + '">' + escapeHtml(resource.campaign) + "</button>";
    }
    $.each(resource.languages, function (j, language) {
      var langActive = state.language === language ? " is-active" : "";
      html += '<button type="button" class="row-lang-label' + langActive + '" data-language="' + escapeAttribute(language) + '">' + escapeHtml(language) + "</button>";
    });
    return html;
  }
  if (resource.campaign) {
    html += '<button type="button" class="badge badge--campaign badge--clickable' + campActive + '" data-campaign-id="' + escapeAttribute(resource.campaignId) + '">' + escapeHtml(resource.campaign) + "</button>";
  }
  $.each(resource.skillIds, function (i, skillId) {
    var skActive = state.skills.indexOf(skillId) !== -1 ? " is-active" : "";
    html += '<button type="button" class="badge badge--skill badge--clickable' + skActive + '" data-skill-id="' + escapeAttribute(skillId) + '">' + escapeHtml(skillLabel(skillId)) + "</button>";
  });
  $.each(resource.languages, function (j, language) {
    var langActive = state.language === language ? " is-active" : "";
    html += '<button type="button" class="badge badge--lang badge--clickable' + langActive + '" data-language="' + escapeAttribute(language) + '">' + escapeHtml(language) + "</button>";
  });
  return html;
}

function renderCreators(resource) {
  if (!resource.creators.length) return "";
  var html = '<p class="resource-creator"><span class="resource-creator-label" title="Creator">\u270D\uFE0F</span> ';
  $.each(resource.creators, function (j, creator) {
    var activeClass = state.creators.indexOf(creator) !== -1 ? " is-active" : "";
    if (j > 0) html += ", ";
    html += '<button type="button" class="creator-link' + activeClass + '" data-creator="' + escapeAttribute(creator) + '">' + escapeHtml(creator) + "</button>";
  });
  return html + "</p>";
}
function renderProjects(resource) {
  if (!resource.projects.length) return "";
  var html = '<p class="resource-project"><span class="resource-project-label" title="Project">\uD83E\uDDE9</span> ';
  $.each(resource.projects, function (j, project) {
    var activeClass = state.projects.indexOf(project) !== -1 ? " is-active" : "";
    if (j > 0) html += ", ";
    html += '<button type="button" class="project-link' + activeClass + '" data-project="' + escapeAttribute(project) + '">' + escapeHtml(project) + "</button>";
  });
  return html + "</p>";
}
function renderReviews(resource) {
  if (!resource.reviews.length) return "";
  return '<p class="resource-review"><span class="resource-review-label" title="Review status">\u2705</span> ' + escapeHtml(resource.reviews.join(", ")) + "</p>";
}
function renderSubjectTags(resource) {
  if (!resource.topics.length) return "";
  var html = '<div class="subject-tags">';
  $.each(resource.topics, function (j, topic) {
    var activeClass = state.topics.indexOf(topic) !== -1 ? " is-active" : "";
    html += '<button type="button" class="subject-tag' + activeClass + '" data-topic="' + escapeAttribute(topic) + '">' + escapeHtml(topic) + "</button>";
  });
  return html + "</div>";
}

function renderCardItems(pageItems) {
  var html = "";
  $.each(pageItems, function (i, resource) {
    html += '<article class="resource-card">';
    html += '<div class="card-meta"><div class="card-badges">' + renderBadges(resource, "grid") + '<span class="badge badge--id">' + escapeHtml(resource.id) + "</span></div>";
    var icons = renderLinkIcons(resource);
    if (icons) html += '<div class="card-link-icons">' + icons + "</div>";
    html += "</div>";
    html += '<h2><a class="resource-title-link" href="' + escapeAttribute(resource.itemUrl) + '" target="_blank" rel="noopener">' + escapeHtml(resource.title) + "</a></h2>";
    if (resource.year) html += '<p class="resource-date" title="Year">\uD83D\uDCC5 ' + escapeHtml(resource.year) + "</p>";
    html += renderCreators(resource);
    html += renderProjects(resource);
    html += renderReviews(resource);
    html += renderSubjectTags(resource);
    html += "</article>";
  });
  return html;
}
function renderListItems(pageItems) {
  var html = "";
  $.each(pageItems, function (i, resource) {
    html += '<article class="resource-row"><div class="row-badges">' + renderBadges(resource, "list") + "</div>";
    html += '<div class="row-body"><h3 class="row-title"><a class="resource-title-link" href="' + escapeAttribute(resource.itemUrl) + '" target="_blank" rel="noopener">' + escapeHtml(resource.title) + "</a></h3>";
    var metaParts = [];
    if (resource.year) metaParts.push('<span class="row-meta-date">\uD83D\uDCC5 ' + escapeHtml(resource.year) + "</span>");
    if (resource.creators.length) metaParts.push(renderCreators(resource));
    if (resource.projects.length) metaParts.push(renderProjects(resource));
    if (metaParts.length) html += '<div class="row-meta">' + metaParts.join('<span class="row-meta-sep">\u00b7</span>') + "</div>";
    html += renderSubjectTags(resource);
    html += "</div>";
    html += '<div class="row-actions">';
    var icons = renderLinkIcons(resource);
    if (icons) html += '<div class="row-links">' + icons + "</div>";
    html += '<span class="badge badge--id row-id-badge">' + escapeHtml(resource.id) + "</span></div></article>";
  });
  return html;
}

function bindResultEvents() {
  $(".badge--campaign, .row-type-label").on("click", function () { toggleCampaignFilter($(this).data("campaign-id")); });
  $(".badge--skill").on("click", function () { toggleSkillFilter($(this).data("skill-id")); });
  $(".badge--lang, .row-lang-label").on("click", function () {
    var language = $(this).data("language");
    state.language = (state.language === language) ? "" : language;
    state.page = 1; $("#languageFilter").val(state.language); render();
  });
  $(".subject-tag").on("click", function () { toggleTopicFilter($(this).data("topic")); });
  $(".creator-link").on("click", function () { toggleInArray(state.creators, $(this).data("creator")); state.page = 1; render(); });
  $(".project-link").on("click", function () { toggleInArray(state.projects, $(this).data("project")); state.page = 1; render(); });
}

// ---------------------------------------------------------------------------
// Toggle helpers
// ---------------------------------------------------------------------------
function toggleInArray(arr, value) {
  var idx = arr.indexOf(value);
  if (idx === -1) arr.push(value); else arr.splice(idx, 1);
}
function toggleCampaignFilter(id) { toggleInArray(state.campaigns, id); state.page = 1; render(); }
function toggleSkillFilter(id) { toggleInArray(state.skills, id); state.page = 1; render(); }
function toggleTopicFilter(topic) { toggleInArray(state.topics, topic); state.page = 1; render(); }

// ---------------------------------------------------------------------------
// Summary stats (uses cached metadata, not live resource list)
// ---------------------------------------------------------------------------
function renderSummaryStats() {
  if (!_metadata) return;
  var stats = {
    resources: _metadata.totalResources || 0,
    formats:   Object.keys(_metadata.formats || {}).length,
    languages: Object.keys(_metadata.languages || {}).length,
    topics:    Object.keys(_metadata.topics || {}).length,
    campaigns: Object.keys(_metadata.campaigns || {}).length,
    creators:  Object.keys(_metadata.creators || {}).length
  };
  var html = "";
  html += '<div class="summary-stat"><span class="summary-stat-number">' + stats.resources + '</span><span class="summary-stat-label">Resources</span></div>';
  html += '<div class="summary-stat"><span class="summary-stat-number">' + stats.campaigns + '</span><span class="summary-stat-label">Campaigns</span></div>';
  html += '<div class="summary-stat"><span class="summary-stat-number">' + stats.formats + '</span><span class="summary-stat-label">Formats</span></div>';
  html += '<button type="button" id="languageInsightsButton" class="summary-stat summary-stat-button"><span class="summary-stat-number">' + stats.languages + '</span><span class="summary-stat-label">Languages</span><span class="summary-stat-hint">View insights \u2192</span></button>';
  html += '<button type="button" id="topicInsightsButton" class="summary-stat summary-stat-button"><span class="summary-stat-number">' + stats.topics + '</span><span class="summary-stat-label">Topics</span><span class="summary-stat-hint">View insights \u2192</span></button>';
  html += '<div class="summary-stat"><span class="summary-stat-number">' + stats.creators + '</span><span class="summary-stat-label">Creators</span></div>';
  $("#summaryStats").html(html);
  $("#languageInsightsButton").on("click", function () { openLanguageInsights(); });
  $("#topicInsightsButton").on("click", function () { openTopicInsights(); });
}

// ---------------------------------------------------------------------------
// Active filter strip
// ---------------------------------------------------------------------------
function renderActiveFilters() {
  var hasCampaigns = state.campaigns.length > 0;
  var hasSkills = state.skills.length > 0;
  var hasFormats = state.formats.length > 0;
  var hasYear = !!state.year;
  var hasReviews = state.reviews.length > 0;
  var hasTopics = state.topics.length > 0;
  var hasCreators = state.creators.length > 0;
  var hasProjects = state.projects.length > 0;
  var hasMaint = state.maintenance.missingCreator || state.maintenance.missingUrl || state.maintenance.missingLanguage || state.maintenance.missingTopic || state.maintenance.missingYear || state.maintenance.missingSkill;

  if (!hasCampaigns && !hasSkills && !hasFormats && !hasYear && !hasReviews && !hasTopics && !hasCreators && !hasProjects && !hasMaint) {
    $("#activeFilters").empty();
    return;
  }
  var html = '<div class="active-filter-strip">';
  if (hasCampaigns) {
    html += "<span>Campaign: <strong>" + escapeHtml(state.campaigns.map(campaignLabel).join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-generic-filter" data-clear="campaigns">Clear</button>';
  }
  if (hasSkills) {
    html += "<span>Skill: <strong>" + escapeHtml(state.skills.map(skillLabel).join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-generic-filter" data-clear="skills">Clear</button>';
  }
  if (hasFormats) {
    html += "<span>Format: <strong>" + escapeHtml(state.formats.join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-generic-filter" data-clear="formats">Clear</button>';
  }
  if (hasYear) {
    html += "<span>Year: <strong>" + escapeHtml(state.year) + "</strong></span>";
    html += '<button type="button" class="clear-year-filter">Clear</button>';
  }
  if (hasReviews) {
    html += "<span>Review: <strong>" + escapeHtml(state.reviews.join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-generic-filter" data-clear="reviews">Clear</button>';
  }
  if (hasTopics) {
    html += '<span class="active-filter-label">Topic:</span>';
    $.each(state.topics, function (i, topic) {
      html += '<button type="button" class="active-filter-chip remove-topic-chip" data-topic="' + escapeAttribute(topic) + '">' + escapeHtml(topic) + ' <span aria-hidden="true">\u00d7</span></button>';
    });
  }
  if (hasCreators) {
    html += "<span>Creator: <strong>" + escapeHtml(state.creators.join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-generic-filter" data-clear="creators">Clear</button>';
  }
  if (hasProjects) {
    html += "<span>Project: <strong>" + escapeHtml(state.projects.join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-generic-filter" data-clear="projects">Clear</button>';
  }
  if (hasMaint) {
    var labels = [];
    if (state.maintenance.missingCreator) labels.push("no creator");
    if (state.maintenance.missingUrl) labels.push("no link");
    if (state.maintenance.missingLanguage) labels.push("no language");
    if (state.maintenance.missingTopic) labels.push("no topic");
    if (state.maintenance.missingYear) labels.push("no year");
    if (state.maintenance.missingSkill) labels.push("no skill level");
    html += "<span>Improve data: <strong>" + escapeHtml(labels.join(", ")) + "</strong></span>";
    html += '<button type="button" class="clear-maintenance-filter">Clear</button>';
  }
  html += "</div>";
  $("#activeFilters").html(html);

  $(".clear-generic-filter").on("click", function () {
    var key = $(this).data("clear");
    state[key] = [];
    state.page = 1; render();
  });
  $(".clear-year-filter").on("click", function () { state.year = ""; state.page = 1; render(); });
  $(".remove-topic-chip").on("click", function () {
    var topic = $(this).data("topic");
    state.topics = state.topics.filter(function (t) { return t !== topic; });
    state.page = 1; render();
  });
  $(".clear-maintenance-filter").on("click", function () {
    state.maintenance.missingCreator = false;
    state.maintenance.missingUrl = false;
    state.maintenance.missingLanguage = false;
    state.maintenance.missingTopic = false;
    state.maintenance.missingYear = false;
    state.maintenance.missingSkill = false;
    state.page = 1;
    syncUiToState();
    render();
  });
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
function renderPagination(total, totalPages) {
  var $el = $("#pagination");
  if (totalPages <= 1) { $el.empty(); return; }
  var current = state.page;
  var pageNums = getPageNumbers(current, totalPages);
  var html = "";
  html += '<button type="button" class="pagination-button pagination-prev"' + (current === 1 ? ' disabled aria-disabled="true"' : "") + ' aria-label="Previous page">\u2190 Prev</button>';
  $.each(pageNums, function (i, num) {
    if (num === "...") {
      html += '<span class="pagination-ellipsis" aria-hidden="true">\u2026</span>';
    } else {
      html += '<button type="button" class="pagination-button pagination-number' + (num === current ? " is-current" : "") + '" data-page="' + num + '"' + (num === current ? ' aria-current="page"' : "") + ' aria-label="Page ' + num + '">' + num + "</button>";
    }
  });
  html += '<button type="button" class="pagination-button pagination-next"' + (current === totalPages ? ' disabled aria-disabled="true"' : "") + ' aria-label="Next page">Next \u2192</button>';
  $el.html(html);
  $(".pagination-prev").on("click", function () { if (state.page > 1) { state.page -= 1; scrollToResults(); render(); } });
  $(".pagination-next").on("click", function () { if (state.page < totalPages) { state.page += 1; scrollToResults(); render(); } });
  $(".pagination-number").on("click", function () {
    var target = parseInt($(this).data("page"), 10);
    if (target !== state.page) { state.page = target; scrollToResults(); render(); }
  });
}
function getPageNumbers(current, total) {
  var WING = 2;
  if (total <= 2 * WING + 5) { var all = []; for (var p = 1; p <= total; p++) all.push(p); return all; }
  var rangeStart = Math.max(2, current - WING);
  var rangeEnd = Math.min(total - 1, current + WING);
  var pages = [1];
  if (rangeStart > 2) pages.push("...");
  for (var i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (rangeEnd < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
function scrollToResults() {
  var $results = $("#results");
  if (!$results.length) return;
  var offset = $results.offset().top - 20;
  if ($(window).scrollTop() > offset) $("html, body").animate({ scrollTop: offset }, 180);
}

// ---------------------------------------------------------------------------
// Language insights modal
// ---------------------------------------------------------------------------
function openLanguageInsights() { renderLanguageInsights(); $("#languageInsightsModal").prop("hidden", false); $("body").addClass("modal-open"); }
function closeLanguageInsights() { $("#languageInsightsModal").prop("hidden", true); $("body").removeClass("modal-open"); }
function getLanguageInsights() {
  var li = (_metadata && _metadata.insights && _metadata.insights.languages) || {};
  var total = (_metadata && _metadata.totalResources) || 0;
  var unique = Object.keys((_metadata && _metadata.languages) || {}).length;
  return {
    totalResources: total, uniqueLanguages: unique,
    resourcesWithLanguage: li.withLanguage || 0, missingLanguage: li.missingLanguage || 0,
    topLanguages: li.topLanguages || [], rareLanguages: li.rareLanguages || [], maxLanguageCount: li.maxCount || 0,
    diversity: [
      { label: "Monolingual", count: li.monolingual || 0, note: "resources with exactly one language" },
      { label: "Bilingual", count: li.bilingual || 0, note: "resources with two languages" },
      { label: "Multilingual", count: li.multilingual || 0, note: "resources with three or more languages" },
      { label: "Missing language", count: li.missingLanguage || 0, note: "resources without language data" }
    ]
  };
}
function renderOverviewCard(number, label, note) {
  return '<div class="language-overview-card"><span class="language-overview-number">' + escapeHtml(String(number)) + '</span><span class="language-overview-label">' + escapeHtml(label) + '</span><p class="language-overview-note">' + escapeHtml(note) + "</p></div>";
}
function renderLanguageInsights() {
  var insights = getLanguageInsights();
  var html = '<div class="language-overview-grid">';
  html += renderOverviewCard(insights.uniqueLanguages, "Languages", "unique languages in the dataset");
  html += renderOverviewCard(insights.resourcesWithLanguage, "Tagged resources", "resources with at least one language");
  html += renderOverviewCard(insights.missingLanguage, "Missing language", "resources needing language data");
  html += "</div>";
  if (insights.missingLanguage > 0) {
    html += '<div class="language-action-strip"><span>There are resources without language data.</span><button type="button" class="language-missing-button" id="langMissingBtn">Show resources missing language</button></div>';
  }
  html += '<div class="language-insight-section"><div class="section-heading-row"><div><h3>Top languages</h3><p>Click a language to filter the resource list.</p></div><p>' + insights.topLanguages.length + ' shown</p></div><div class="language-bar-list">';
  $.each(insights.topLanguages, function (i, item) {
    var width = insights.maxLanguageCount ? Math.round((item.count / insights.maxLanguageCount) * 100) : 0;
    html += '<button type="button" class="language-bar-button" data-language="' + escapeAttribute(item.language) + '"><span class="language-bar-label">' + escapeHtml(item.language) + '</span><span class="language-bar-track"><span class="language-bar-fill" style="width:' + width + '%"></span></span><span class="language-bar-count">' + item.count + "</span></button>";
  });
  html += "</div></div>";
  html += '<div class="language-insight-grid"><div class="language-insight-section"><h3>Language diversity</h3><div class="diversity-list">';
  $.each(insights.diversity, function (i, item) {
    var width = insights.totalResources ? Math.round((item.count / insights.totalResources) * 100) : 0;
    html += '<div class="diversity-row"><div class="diversity-row-top"><span>' + escapeHtml(item.label) + "</span><strong>" + item.count + '</strong></div><div class="diversity-track"><span style="width:' + width + '%"></span></div><p>' + escapeHtml(item.note) + "</p></div>";
  });
  html += "</div></div>";
  html += '<div class="language-insight-section"><div class="section-heading-row"><div><h3>Rare languages</h3><p>Used by only one or two resources.</p></div><p>' + insights.rareLanguages.length + " found</p></div>";
  if (insights.rareLanguages.length) {
    html += '<div class="rare-language-list">';
    $.each(insights.rareLanguages, function (i, item) {
      html += '<button type="button" class="rare-language-pill" data-language="' + escapeAttribute(item.language) + '">' + escapeHtml(item.language) + " <span>(" + item.count + ")</span></button>";
    });
    html += "</div>";
  } else {
    html += '<p class="insight-note">No rare languages found.</p>';
  }
  html += "</div></div>";
  $("#languageInsightsContent").html(html);
  $(".language-bar-button, .rare-language-pill").on("click", function () { applyLanguageFilter($(this).data("language")); });
  $("#langMissingBtn").on("click", function () {
    state.maintenance.missingLanguage = true; state.page = 1;
    $("#missingLanguageFilter").prop("checked", true);
    closeLanguageInsights(); render();
  });
}
function applyLanguageFilter(language) {
  state.language = language; state.page = 1;
  $("#languageFilter").val(language);
  closeLanguageInsights(); render();
}

// ---------------------------------------------------------------------------
// Topic insights modal
// ---------------------------------------------------------------------------
function openTopicInsights() { renderTopicInsights(); $("#topicInsightsModal").prop("hidden", false); $("body").addClass("modal-open"); }
function closeTopicInsights() { $("#topicInsightsModal").prop("hidden", true); $("body").removeClass("modal-open"); }
function getTopicInsights() {
  var ti = (_metadata && _metadata.insights && _metadata.insights.topics) || {};
  var total = (_metadata && _metadata.totalResources) || 0;
  var unique = Object.keys((_metadata && _metadata.topics) || {}).length;
  return {
    totalResources: total, uniqueTopics: unique,
    resourcesWithTopics: ti.withTopics || 0, missingTopics: ti.missingTopics || 0,
    topTopics: ti.topTopics || [], rareTopics: ti.rareTopics || [], maxTopicCount: ti.maxCount || 0,
    coverage: [
      { label: "No topics", count: ti.zero || 0, note: "resources with no topics" },
      { label: "1\u20132 topics", count: ti.oneTwo || 0, note: "resources with one or two topics" },
      { label: "3\u20135 topics", count: ti.threeToFive || 0, note: "resources with three to five topics" },
      { label: "6+ topics", count: ti.sixPlus || 0, note: "resources with six or more topics" }
    ]
  };
}
function renderTopicInsights() {
  var insights = getTopicInsights();
  var html = '<div class="language-overview-grid">';
  html += renderOverviewCard(insights.uniqueTopics, "Topics", "unique topics in the dataset");
  html += renderOverviewCard(insights.resourcesWithTopics, "Tagged resources", "resources with at least one topic");
  html += renderOverviewCard(insights.missingTopics, "Missing topics", "resources needing topic data");
  html += "</div>";
  if (insights.missingTopics > 0) {
    html += '<div class="language-action-strip"><span>There are resources without topic data.</span><button type="button" class="language-missing-button" id="topicMissingBtn">Show resources missing topics</button></div>';
  }
  html += '<div class="language-insight-grid"><div class="language-insight-section"><div class="section-heading-row"><div><h3>Top topics</h3><p>Click a topic to filter.</p></div><p>' + insights.topTopics.length + ' shown</p></div><div class="language-bar-list">';
  $.each(insights.topTopics, function (i, item) {
    var width = insights.maxTopicCount ? Math.round((item.count / insights.maxTopicCount) * 100) : 0;
    html += '<button type="button" class="language-bar-button" data-topic="' + escapeAttribute(item.topic) + '"><span class="language-bar-label">' + escapeHtml(item.topic) + '</span><span class="language-bar-track"><span class="language-bar-fill" style="width:' + width + '%"></span></span><span class="language-bar-count">' + item.count + "</span></button>";
  });
  html += "</div></div>";
  html += '<div class="language-insight-section"><h3>Topic coverage</h3><div class="diversity-list">';
  $.each(insights.coverage, function (i, item) {
    var width = insights.totalResources ? Math.round((item.count / insights.totalResources) * 100) : 0;
    html += '<div class="diversity-row"><div class="diversity-row-top"><span>' + escapeHtml(item.label) + "</span><strong>" + item.count + '</strong></div><div class="diversity-track"><span style="width:' + width + '%"></span></div><p>' + escapeHtml(item.note) + "</p></div>";
  });
  html += "</div>";
  html += '<div class="section-heading-row" style="margin-top:16px"><div><h3>Rarely used topics</h3><p>Used only once or twice.</p></div><p>' + insights.rareTopics.length + " found</p></div>";
  if (insights.rareTopics.length) {
    html += '<div class="rare-language-list">';
    $.each(insights.rareTopics, function (i, item) {
      html += '<button type="button" class="rare-language-pill" data-topic="' + escapeAttribute(item.topic) + '">' + escapeHtml(item.topic) + " <span>(" + item.count + ")</span></button>";
    });
    html += "</div>";
  } else {
    html += '<p class="insight-note">No rarely used topics found.</p>';
  }
  html += "</div></div>";
  $("#topicInsightsContent").html(html);
  $(".language-bar-button, .rare-language-pill").on("click", function () {
    var topic = $(this).data("topic");
    if (state.topics.indexOf(topic) === -1) state.topics.push(topic);
    state.page = 1; closeTopicInsights(); render();
  });
  $("#topicMissingBtn").on("click", function () {
    state.maintenance.missingTopic = true; state.page = 1;
    $("#missingTopicFilter").prop("checked", true);
    closeTopicInsights(); render();
  });
}

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttribute(value) { return escapeHtml(value || "#"); }
