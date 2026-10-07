import { getSupabase, isSupabaseConfigured } from "./supabaseClient.js";
import {
  deleteLearningExample,
  ensureLearnerProfile,
  getLearnerProfile,
  listLearningExamples,
  updateLearnerProfile,
  upsertLearningExample
} from "./learnerStore.js";

const els = {
  accountBtn: document.getElementById("accountBtn"),
  accountStatus: document.getElementById("accountStatus"),
  authDialog: document.getElementById("authDialog"),
  authClose: document.getElementById("authCloseBtn"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSignIn: document.getElementById("authSignInBtn"),
  authSignUp: document.getElementById("authSignUpBtn"),
  authGoogle: document.getElementById("authGoogleBtn"),
  authGithub: document.getElementById("authGithubBtn"),
  authSignOut: document.getElementById("authSignOutBtn"),
  authTabs: document.querySelectorAll("[data-auth-tab]"),
  signInPanel: document.getElementById("signInPanel"),
  profilePanel: document.getElementById("profilePanel"),
  profileDisplayName: document.getElementById("profileDisplayName"),
  profileEmail: document.getElementById("profileEmail"),
  profileProvider: document.getElementById("profileProvider"),
  profileSave: document.getElementById("profileSaveBtn"),
  themeToggle: document.getElementById("themeToggleBtn"),
  focusMode: document.getElementById("focusModeToggle"),
  compactMode: document.getElementById("compactModeToggle"),
  authMessage: document.getElementById("authMessage")
};

const supabase = getSupabase();
let currentUser = null;
let currentProfile = null;
let preferences = { theme: "dark", focusMode: false, compactMode: false };

window.pystepAuth = {
  isConfigured: isSupabaseConfigured,
  getUser: () => currentUser,
  openSignIn: () => {
    if (els.authDialog && !els.authDialog.open) els.authDialog.showModal();
  },
  loadExamples,
  saveExample,
  deleteExample
};

initAuthUi();

async function initAuthUi() {
  if (!els.accountBtn) return;

  bindEvents();

  if (!supabase) {
    setSignedOut("Local only");
    setMessage("Cloud accounts are not configured yet. Add Supabase settings to enable sign-in.");
    els.authEmail.disabled = true;
    els.authPassword.disabled = true;
    els.authSignIn.disabled = true;
    els.authSignUp.disabled = true;
    els.authGoogle.disabled = true;
    els.authGithub.disabled = true;
    return;
  }

  const { data } = await supabase.auth.getSession();
  await setUser(data.session?.user || null);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    await setUser(session?.user || null);
  });
}

function bindEvents() {
  els.accountBtn.addEventListener("click", () => els.authDialog.showModal());
  els.authClose.addEventListener("click", () => els.authDialog.close());
  els.authSignIn.addEventListener("click", () => signInWithPassword());
  els.authSignUp.addEventListener("click", () => signUpWithPassword());
  els.authGoogle.addEventListener("click", () => signInWithProvider("google"));
  els.authGithub.addEventListener("click", () => signInWithProvider("github"));
  els.authSignOut.addEventListener("click", () => signOut());
  els.profileSave.addEventListener("click", () => saveProfile());
  els.themeToggle.addEventListener("click", () => setPreference("theme", preferences.theme === "dark" ? "light" : "dark"));
  els.focusMode.addEventListener("change", () => setPreference("focusMode", els.focusMode.checked));
  els.compactMode.addEventListener("change", () => setPreference("compactMode", els.compactMode.checked));
  els.authTabs.forEach(tab => {
    tab.addEventListener("click", () => setAuthTab(tab.dataset.authTab));
  });
}

async function signInWithPassword() {
  const credentials = readCredentials();
  if (!credentials) return;
  await runAuthAction(async () => {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    setMessage("Signed in. Your saved examples will sync now.");
    els.authDialog.close();
  });
}

async function signUpWithPassword() {
  const credentials = readCredentials();
  if (!credentials) return;
  await runAuthAction(async () => {
    const { error } = await supabase.auth.signUp(credentials);
    if (error) throw error;
    setMessage("Account created. Check your email if confirmation is enabled.");
  });
}

async function signInWithProvider(provider) {
  await runAuthAction(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href.split("#")[0]
      }
    });
    if (error) throw error;
  });
}

async function signOut() {
  await runAuthAction(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setMessage("Signed out. My learning and AI are locked until the next sign-in.");
  });
}

function readCredentials() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setMessage("Enter an email and password first.", true);
    return null;
  }
  return { email, password };
}

async function runAuthAction(action) {
  setBusy(true);
  try {
    await action();
  } catch (err) {
    setMessage(err.message || String(err), true);
  } finally {
    setBusy(false);
  }
}

async function setUser(user) {
  currentUser = user;
  currentProfile = null;

  if (user) {
    try {
      await ensureLearnerProfile(user);
      currentProfile = await getLearnerProfile(user.id);
    } catch (err) {
      setMessage(`Signed in, but learner database setup is incomplete: ${err.message || String(err)}`, true);
    }
    loadPreferences(user.id);
    setSignedIn(user);
    setAuthTab("profile");
  } else {
    applyPreferences({ theme: "dark", focusMode: false, compactMode: false });
    setSignedOut("Sign in");
    setAuthTab("signin");
  }

  window.dispatchEvent(new CustomEvent("pystep:auth-changed", {
    detail: { user }
  }));
}

function setSignedIn(user) {
  const label = currentProfile?.display_name || user.user_metadata?.full_name || user.email || "Learner";
  els.accountBtn.textContent = "Account";
  els.accountStatus.textContent = label;
  els.profileDisplayName.value = label;
  els.profileEmail.textContent = user.email || "No email available";
  els.profileProvider.textContent = getProviderLabel(user);
  els.authSignOut.classList.remove("hidden");
  els.profileSave.disabled = false;
  setProfileTabEnabled(true);
}

function setSignedOut(buttonText) {
  els.accountBtn.textContent = buttonText;
  els.accountStatus.textContent = supabase ? "Not signed in" : "Cloud sync off";
  els.profileDisplayName.value = "";
  els.profileEmail.textContent = "Sign in to view account details";
  els.profileProvider.textContent = "Not signed in";
  els.authSignOut.classList.add("hidden");
  els.profileSave.disabled = true;
  setProfileTabEnabled(false);
}

function setBusy(isBusy) {
  [
    els.authSignIn,
    els.authSignUp,
    els.authGoogle,
    els.authGithub,
    els.authSignOut
  ].forEach(button => {
    button.disabled = isBusy;
  });
}

function setMessage(message, isError=false) {
  if (!els.authMessage) return;
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle("error", isError);
}

async function loadExamples() {
  if (!currentUser) return [];
  return listLearningExamples(currentUser.id);
}

async function saveExample(example) {
  if (!currentUser) return null;
  return upsertLearningExample(currentUser.id, example);
}

async function deleteExample(remoteId) {
  if (!currentUser || !remoteId) return;
  await deleteLearningExample(remoteId);
}

async function saveProfile() {
  if (!currentUser) {
    setMessage("Sign in before updating your profile.", true);
    return;
  }

  const displayName = els.profileDisplayName.value.trim();
  if (!displayName) {
    setMessage("Display name cannot be empty.", true);
    return;
  }

  await runAuthAction(async () => {
    currentProfile = await updateLearnerProfile(currentUser.id, { displayName });
    await supabase.auth.updateUser({ data: { full_name: displayName } });
    setSignedIn({ ...currentUser, user_metadata: { ...currentUser.user_metadata, full_name: displayName } });
    setMessage("Profile updated.");
  });
}

function setAuthTab(tabName) {
  if (tabName === "profile" && !currentUser) {
    setMessage("Sign in before opening your profile.", true);
    tabName = "signin";
  }

  const wantsProfile = tabName === "profile";
  els.signInPanel.classList.toggle("hidden", wantsProfile);
  els.profilePanel.classList.toggle("hidden", !wantsProfile);
  els.authTabs.forEach(tab => {
    const active = tab.dataset.authTab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function setProfileTabEnabled(isEnabled) {
  const profileTab = Array.from(els.authTabs).find(tab => tab.dataset.authTab === "profile");
  if (!profileTab) return;
  profileTab.disabled = !isEnabled;
  profileTab.setAttribute("aria-disabled", String(!isEnabled));
}

function getProviderLabel(user) {
  const providers = user.app_metadata?.providers || [];
  if (providers.includes("google")) return "Google";
  if (providers.includes("github")) return "GitHub";
  if (providers.includes("email")) return "Email";
  return providers[0] || "Account";
}

function preferenceKey(userId) {
  return `pystep_preferences_${userId}`;
}

function loadPreferences(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(preferenceKey(userId)) || "{}");
    applyPreferences({ ...preferences, ...parsed });
  } catch {
    applyPreferences(preferences);
  }
}

function setPreference(key, value) {
  const next = { ...preferences, [key]: value };
  applyPreferences(next);

  if (currentUser) {
    localStorage.setItem(preferenceKey(currentUser.id), JSON.stringify(preferences));
  }
}

function applyPreferences(next) {
  preferences = next;
  document.body.classList.toggle("theme-light", preferences.theme === "light");
  document.body.classList.toggle("focus-mode", Boolean(preferences.focusMode));
  document.body.classList.toggle("compact-mode", Boolean(preferences.compactMode));
  els.themeToggle.textContent = preferences.theme === "light" ? "Use dark mode" : "Use light mode";
  els.focusMode.checked = Boolean(preferences.focusMode);
  els.compactMode.checked = Boolean(preferences.compactMode);
}
