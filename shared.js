// Shared data layer. All persistence is localStorage under one key.
// Data shape:
// {
//   seq: <number>,            // id counter
//   reports: [ {
//     id: <number>,
//     text: <string>,
//     createdAt: <ISO string>,
//     resolved: <bool>,
//     thread: [ { from: "client" | "admin", text: <string>, at: <ISO string> } ]
//   } ]
// }

const FEEDBACK_KEY = "clientFeedbackData_v1";

function loadData() {
  const raw = localStorage.getItem(FEEDBACK_KEY);
  if (!raw) return { seq: 0, reports: [] };
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.reports)) return { seq: 0, reports: [] };
    if (typeof data.seq !== "number") data.seq = 0;
    return data;
  } catch (e) {
    return { seq: 0, reports: [] };
  }
}

function saveData(data) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(data));
}

// Subscribe to changes made in another tab/page so both
// interfaces stay in sync after each other's updates.
function onDataChange(callback) {
  window.addEventListener("storage", function (event) {
    if (event.key === FEEDBACK_KEY) callback();
  });
}

// Mutations: each mutator loads, changes, saves. Pages re-render after.
function addReport(text) {
  const data = loadData();
  data.seq += 1;
  const report = {
    id: data.seq,
    text: text,
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
  const report = data.reports.find(function (r) { return r.id === reportId; });
  if (!report) return false;
  report.thread.push({ from: from, text: text, at: new Date().toISOString() });
  saveData(data);
  return true;
}

function setResolved(reportId, resolved) {
  const data = loadData();
  const report = data.reports.find(function (r) { return r.id === reportId; });
  if (!report) return false;
  report.resolved = resolved;
  saveData(data);
  return true;
}

function deleteReport(reportId) {
  const data = loadData();
  const index = data.reports.findIndex(function (r) { return r.id === reportId; });
  if (index === -1) return false;
  data.reports.splice(index, 1);
  saveData(data);
  return true;
}

// Replies are matched by creation time + author, so a stale index
// can never delete the wrong message.
function deleteReply(reportId, at, from) {
  const data = loadData();
  const report = data.reports.find(function (r) { return r.id === reportId; });
  if (!report) return false;
  const index = report.thread.findIndex(function (m) { return m.at === at && m.from === from; });
  if (index === -1) return false;
  report.thread.splice(index, 1);
  saveData(data);
  return true;
}

// Admin "unread" tracking: ids of reports the administrator has opened.
const SEEN_KEY = "clientFeedbackSeen_v1";

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

function unreadCount() {
  return loadData().reports.filter(function (r) { return !isSeen(r.id); }).length;
}
