// Shared data layer for the client and administrator interfaces.
// All persistence is localStorage under one key, so reports, replies and
// resolution state survive a page refresh (and sync across open tabs).
//
// Data shape:
// {
//   seq: <number>,
//   reports: [ {
//     id: <number>,
//     text: <string>,              // full description; first line becomes the title
//     project: <string>,           // one of PROJECTS, or "General" for legacy data
//     type: "bug" | "feedback",
//     createdAt: <ISO string>,
//     resolved: <bool>,
//     thread: [ { from: "client" | "admin", text: <string>, at: <ISO string> } ]
//   } ]
// }

const FEEDBACK_KEY = "clientFeedbackData_v1";
const SEEN_KEY = "clientFeedbackSeen_v1";
const CLIENT_SEEN_KEY = "clientFeedbackClientSeen_v1";

// Projects offered in the submit form. Edit this list to match your projects.
const PROJECTS = ["iSynergies Web", "Cart Manager", "Other"];

const LEGACY_PROJECT = "General";
const TITLE_MAX = 70;

// ---------- Read / write ----------

// Older saved reports predate project and type, so fill sane defaults in
// memory instead of blanking the interface.
function normalizeReport(report) {
  const thread = Array.isArray(report.thread) ? report.thread : [];
  return {
    id: report.id,
    text: typeof report.text === "string" ? report.text : "",
    project:
      typeof report.project === "string" && report.project.length > 0
        ? report.project
        : LEGACY_PROJECT,
    type: report.type === "bug" ? "bug" : "feedback",
    createdAt: report.createdAt || new Date().toISOString(),
    resolved: report.resolved === true,
    thread: thread
  };
}

function loadData() {
  const raw = localStorage.getItem(FEEDBACK_KEY);
  if (!raw) return { seq: 0, reports: [] };
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.reports)) return { seq: 0, reports: [] };
    const reports = data.reports
      .filter(function (r) {
        return r && typeof r.id === "number";
      })
      .map(normalizeReport);
    let seq = typeof data.seq === "number" ? data.seq : 0;
    for (const report of reports) {
      if (report.id > seq) seq = report.id;
    }
    return { seq: seq, reports: reports };
  } catch (e) {
    return { seq: 0, reports: [] };
  }
}

function saveData(data) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(data));
}

// Subscribe to changes made in another tab/page so both interfaces stay in
// sync after each other's updates.
function onDataChange(callback) {
  window.addEventListener("storage", function (event) {
    if (event.key === FEEDBACK_KEY) callback();
  });
}

// ---------- Mutations ----------

function addReport(text, project, type) {
  const data = loadData();
  data.seq += 1;
  const report = {
    id: data.seq,
    text: text,
    project: project || PROJECTS[0],
    type: type === "feedback" ? "feedback" : "bug",
    createdAt: new Date().toISOString(),
    resolved: false,
    thread: []
  };
  data.reports.push(report);
  saveData(data);
  return report;
}

function addReply(reportId, from, text) {
  const data = loadData();
  const report = data.reports.find(function (r) {
    return r.id === reportId;
  });
  if (!report) return false;
  report.thread.push({ from: from, text: text, at: new Date().toISOString() });
  saveData(data);
  return true;
}

function setResolved(reportId, resolved) {
  const data = loadData();
  const report = data.reports.find(function (r) {
    return r.id === reportId;
  });
  if (!report) return false;
  report.resolved = resolved === true;
  saveData(data);
  return true;
}

function deleteReport(reportId) {
  const data = loadData();
  const index = data.reports.findIndex(function (r) {
    return r.id === reportId;
  });
  if (index === -1) return false;
  data.reports.splice(index, 1);
  saveData(data);
  return true;
}

// Replies are matched by creation time + author, so a stale index can never
// delete the wrong message.
function deleteReply(reportId, at, from) {
  const data = loadData();
  const report = data.reports.find(function (r) {
    return r.id === reportId;
  });
  if (!report) return false;
  const index = report.thread.findIndex(function (m) {
    return m.at === at && m.from === from;
  });
  if (index === -1) return false;
  report.thread.splice(index, 1);
  saveData(data);
  return true;
}

// ---------- Display helpers ----------

function reportProject(report) {
  return report.project || LEGACY_PROJECT;
}

function reportType(report) {
  return report.type === "bug" ? "bug" : "feedback";
}

function reportTypeLabel(report) {
  return reportType(report) === "bug" ? "Bug" : "Feedback";
}

// The issue title is the first non-empty line of the description.
function reportTitle(report) {
  const lines = String(report.text || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim().replace(/\s+/g, " ");
    if (trimmed.length > 0) {
      if (trimmed.length > TITLE_MAX) {
        return trimmed.slice(0, TITLE_MAX).trimEnd() + "\u2026";
      }
      return trimmed;
    }
  }
  return "Report #" + report.id;
}

function formatDateTime(iso) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// ---------- Administrator "unread" tracking ----------
// Ids of reports the administrator has opened.

function loadSeen() {
  const raw = localStorage.getItem(SEEN_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function isSeen(reportId) {
  return loadSeen().indexOf(reportId) !== -1;
}

function markSeen(reportId) {
  const list = loadSeen();
  if (list.indexOf(reportId) === -1) {
    list.push(reportId);
    localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  }
}

// ---------- Client "new administrator reply" tracking ----------
// Map of report id -> { at, index } for the last administrator reply the
// client has seen. Stored as a plain object, so it survives a refresh.

function loadClientSeen() {
  const raw = localStorage.getItem(CLIENT_SEEN_KEY);
  if (!raw) return {};
  try {
    const map = JSON.parse(raw);
    return map && typeof map === "object" && !Array.isArray(map) ? map : {};
  } catch (e) {
    return {};
  }
}

function latestAdminMessage(report) {
  for (let i = report.thread.length - 1; i >= 0; i--) {
    if (report.thread[i].from === "admin") return report.thread[i];
  }
  return null;
}

function hasNewAdminReply(report) {
  const message = latestAdminMessage(report);
  if (!message) return false;
  const seen = loadClientSeen()[report.id];
  if (!seen) return true;

  const seenAt = typeof seen === "string" ? seen : seen.at;
  const seenIndex =
    seen && typeof seen.index === "number" ? seen.index : -1;

  // Compare positions in the thread when the seen message still exists, so a
  // reply created in the same millisecond still counts as new.
  const seenMessage = report.thread[seenIndex];
  if (seenMessage && seenMessage.at === seenAt) {
    return report.thread.slice(seenIndex + 1).some(function (entry) {
      return entry.from === "admin";
    });
  }

  return new Date(message.at).getTime() > new Date(seenAt).getTime();
}

function markClientSeen(report) {
  const message = latestAdminMessage(report);
  if (!message) return;
  const map = loadClientSeen();
  map[report.id] = {
    at: message.at,
    index: report.thread.lastIndexOf(message)
  };
  localStorage.setItem(CLIENT_SEEN_KEY, JSON.stringify(map));
}

// ---------- Filtering (administrator dashboard) ----------

// reports: array of normalized reports (newest first is not required)
// filters: { status: "all" | "open" | "resolved" | "unread", q, project }
function filterReports(reports, filters) {
  const status = filters.status || "all";
  const query = String(filters.q || "").trim().toLowerCase();
  const project = filters.project || "all";

  return reports.filter(function (report) {
    if (status === "open" && report.resolved) return false;
    if (status === "resolved" && !report.resolved) return false;
    if (status === "unread" && isSeen(report.id)) return false;
    if (project !== "all" && reportProject(report) !== project) return false;
    if (query.length > 0) {
      const haystack = (
        reportTitle(report) +
        "\n" +
        report.text +
        "\n" +
        reportProject(report)
      ).toLowerCase();
      if (haystack.indexOf(query) === -1) return false;
    }
    return true;
  });
}

function statusCounts(reports) {
  let open = 0;
  let resolved = 0;
  let unread = 0;
  for (const report of reports) {
    if (report.resolved) resolved += 1;
    else open += 1;
    if (!isSeen(report.id)) unread += 1;
  }
  return { all: reports.length, open: open, resolved: resolved, unread: unread };
}

// ---------- Shared DOM helper ----------

// Builds the conversation list for a report. Clients may delete only their
// own messages; administrators may delete any message.
function buildThreadList(report, viewer, onDelete) {
  const list = document.createElement("ul");
  list.className = "thread";

  if (report.thread.length === 0) {
    const item = document.createElement("li");
    item.className = "msg";
    const text = document.createElement("p");
    text.className = "msg-text meta";
    text.textContent = "No messages yet.";
    item.appendChild(text);
    list.appendChild(item);
    return list;
  }

  for (const message of report.thread) {
    const item = document.createElement("li");
    item.className =
      "msg " + (message.from === "admin" ? "msg-admin" : "msg-client");

    const head = document.createElement("div");
    head.className = "msg-head";

    const author = document.createElement("span");
    author.className = "msg-author";
    author.textContent = message.from === "admin" ? "Administrator" : "Client";
    head.appendChild(author);

    const time = document.createElement("span");
    time.textContent = formatDateTime(message.at);
    head.appendChild(time);
    item.appendChild(head);

    const text = document.createElement("p");
    text.className = "msg-text";
    text.textContent = message.text;
    item.appendChild(text);

    const canDelete =
      viewer === "admin" || (viewer === "client" && message.from === "client");
    if (canDelete && typeof onDelete === "function") {
      const actions = document.createElement("div");
      actions.className = "msg-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-danger-ghost";
      button.textContent = "Delete";
      button.addEventListener("click", function () {
        onDelete(message);
      });
      actions.appendChild(button);
      item.appendChild(actions);
    }

    list.appendChild(item);
  }

  return list;
}
