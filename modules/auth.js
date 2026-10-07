import { getSupabase, isSupabaseConfigured } from "./supabaseClient.js";
import {
  deleteLearningExample,
  ensureLearnerProfile,
  listLearningExamples,
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
  authMessage: document.getElementById("authMessage")
};

const supabase = getSupabase();
let currentUser = null;

window.pystepAuth = {
  isConfigured: isSupabaseConfigured,
  getUser: () => currentUser,
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
    setMessage("Signed out. This browser can still save examples locally.");
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

  if (user) {
    try {
      await ensureLearnerProfile(user);
    } catch (err) {
      setMessage(`Signed in, but learner database setup is incomplete: ${err.message || String(err)}`, true);
    }
    setSignedIn(user);
  } else {
    setSignedOut("Sign in");
  }

  window.dispatchEvent(new CustomEvent("pystep:auth-changed", {
    detail: { user }
  }));
}

function setSignedIn(user) {
  const label = user.email || user.user_metadata?.full_name || "Learner";
  els.accountBtn.textContent = "Account";
  els.accountStatus.textContent = label;
  els.authSignOut.classList.remove("hidden");
}

function setSignedOut(buttonText) {
  els.accountBtn.textContent = buttonText;
  els.accountStatus.textContent = supabase ? "Not signed in" : "Cloud sync off";
  els.authSignOut.classList.add("hidden");
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
