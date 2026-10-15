// Admin accounts. Credentials are stored as SHA-256 hashes, never plaintext.
// Accounts array: { user, hash } where hash = SHA-256("user:password").
const ADMIN_ACCOUNTS_KEY = "adminAccounts_v1";
const ADMIN_SESSION_KEY = "adminSession_v1";

// First administrator: NickosASKIHO / ASKIHEAD3345
// (only the concatenated hash is committed here, not the password itself)
const SEED_ADMIN_ACCOUNTS = [
  { user: "NickosASKIHO", hash: "04ca6c3c1638a901e41c2629b271bd6696c61089b7afdd3b23dd8f2661282add" }
];

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(function (b) { return b.toString(16).padStart(2, "0"); })
    .join("");
}

function loadAdminAccounts() {
  const raw = localStorage.getItem(ADMIN_ACCOUNTS_KEY);
  if (!raw) return SEED_ADMIN_ACCOUNTS;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : SEED_ADMIN_ACCOUNTS;
  } catch (e) {
    return SEED_ADMIN_ACCOUNTS;
  }
}

// Returns the username if credentials match, otherwise null.
async function checkAdminCredentials(user, password) {
  if (!user || !password) return null;
  const hash = await sha256Hex(user + ":" + password);
  const accounts = loadAdminAccounts();
  for (const account of accounts) {
    if (account.user === user && account.hash === hash) {
      return user;
    }
  }
  return null;
}

// Session: sessionStorage (per-tab) or localStorage (survives refresh in same browser).
// We use localStorage so a refresh keeps the admin logged in.
function adminSessionActive() {
  return localStorage.getItem(ADMIN_SESSION_KEY) !== null;
}

function startAdminSession(user) {
  localStorage.setItem(ADMIN_SESSION_KEY, user);
}

function endAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function currentUser() {
  return localStorage.getItem(ADMIN_SESSION_KEY);
}
