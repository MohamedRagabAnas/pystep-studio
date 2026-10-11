const authBridge = () => window.pystepAuth || null;

const conceptExamples = [
  {
    title: "Variables & arithmetic",
    tag: "Foundations",
    code: `x = 5
y = 10
total = x + y
print(total)`,
    insight: "Assignment stores references to values. Arithmetic creates a new value, which is then assigned to a variable."
  },
  {
    title: "Changing a variable",
    tag: "Foundations",
    code: `score = 10
bonus = 5
score = score + bonus
bonus = 20
print(score)`,
    insight: "Changing bonus later does not change score. score already received the result of the earlier calculation."
  },
  {
    title: "If / else",
    tag: "Decisions",
    code: `temperature = 18

if temperature >= 20:
    message = "Warm"
else:
    message = "Cool"

print(message)`,
    insight: "Only one branch executes. Watch which assignment actually appears in memory."
  },
  {
    title: "Nested decisions",
    tag: "Decisions",
    code: `score = 83

if score >= 90:
    grade = "A"
elif score >= 70:
    grade = "Pass"
else:
    grade = "Try again"

print(grade)`,
    insight: "Python checks each condition in order and stops at the first branch that is true."
  },
  {
    title: "For loop",
    tag: "Loops",
    code: `total = 0

for i in range(1, 5):
    total = total + i

print(total)`,
    insight: "A loop revisits the same source lines while the values in memory change on each iteration."
  },
  {
    title: "While loop",
    tag: "Loops",
    code: `count = 3

while count > 0:
    print(count)
    count = count - 1

print("Go!")`,
    insight: "A while loop keeps running while its condition is true. The changing count eventually stops the loop."
  },
  {
    title: "List mutation",
    tag: "Data structures",
    code: `numbers = [10, 20, 30]
numbers.append(40)
numbers[0] = 99
print(numbers)`,
    insight: "Lists are mutable. Operations can change the same list object instead of creating a completely independent one."
  },
  {
    title: "List indexing",
    tag: "Data structures",
    code: `colors = ["red", "green", "blue"]
first = colors[0]
last = colors[2]
print(first)
print(last)`,
    insight: "List indexes start at 0, so the first item is at position 0."
  },
  {
    title: "References & aliasing",
    tag: "Memory model",
    code: `a = [1, 2, 3]
b = a
b.append(4)
print(a)
print(b)`,
    insight: "a and b refer to the same list. Mutating through b is therefore visible through a."
  },
  {
    title: "Functions & scope",
    tag: "Functions",
    code: `def add_tax(price, rate):
    tax = price * rate
    return price + tax

result = add_tax(100, 0.2)
print(result)`,
    insight: "Function calls create a local scope. During execution you can see function parameters and local variables appear."
  },
  {
    title: "Function return value",
    tag: "Functions",
    code: `def double(number):
    result = number * 2
    return result

answer = double(6)
print(answer)`,
    insight: "A return statement sends a value back to the place where the function was called."
  },
  {
    title: "Dictionary",
    tag: "Data structures",
    code: `student = {
    "name": "Sara",
    "mark": 72
}

student["mark"] = 78
student["passed"] = True
print(student["name"])`,
    insight: "Dictionaries map keys to values. Updating a key changes the dictionary state in memory."
  }
];

const els = {
  list: document.getElementById("examplesList"),
  libraryTab: document.getElementById("libraryTabBtn"),
  myLearningTab: document.getElementById("myLearningTabBtn"),
  newExample: document.getElementById("newExampleBtn"),
  saveExample: document.getElementById("saveExampleBtn"),
  title: document.getElementById("lessonTitle"),
  editor: document.getElementById("codeEditor"),
  lineNumbers: document.getElementById("lineNumbers"),
  overlay: document.getElementById("activeLineOverlay"),
  run: document.getElementById("runBtn"),
  reset: document.getElementById("resetBtn"),
  next: document.getElementById("nextBtn"),
  prev: document.getElementById("prevBtn"),
  auto: document.getElementById("autoBtn"),
  speed: document.getElementById("speedSlider"),
  counter: document.getElementById("stepCounter"),
  body: document.getElementById("memoryTableBody"),
  memEmpty: document.getElementById("memoryEmpty"),
  memWrap: document.getElementById("memoryTableWrap"),
  output: document.getElementById("consoleOutput"),
  workflowBadge: document.getElementById("workflowBadge"),
  workflowEmpty: document.getElementById("workflowEmpty"),
  workflowCanvas: document.getElementById("workflowCanvas"),
  explanation: document.getElementById("explanation"),
  staticAiNotice: document.getElementById("staticAiNotice"),
  aiExplanation: document.getElementById("aiExplanation"),
  aiChatLog: document.getElementById("aiChatLog"),
  aiQuestionForm: document.getElementById("aiQuestionForm"),
  aiQuestionInput: document.getElementById("aiQuestionInput"),
  aiExplain: document.getElementById("aiExplainBtn"),
  insight: document.getElementById("insightText"),
  scope: document.getElementById("scopeBadge"),
  engine: document.getElementById("engineStatus"),
  dot: document.getElementById("engineDot"),
  toast: document.getElementById("toast")
};

let pyodide = null;
let trace = [];
let stepIndex = -1;
let libraryMode = "concepts";
let currentExample = { source: "concepts", index: 0 };
let myLearningExamples = [];
let activeLearnerId = null;
let autoTimer = null;
let lastError = null;
let lastFinalOutput = "";
let workflowGraph = null;
let jumpAudioContext = null;
let lastJumpSoundStep = null;
let finishSoundPlayed = false;
let aiMessages = [];
const AI_API_URL = window.PYSTEP_AI_API_URL || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "/api/explain" : "");
if (!AI_API_URL) {
  els.staticAiNotice.classList.remove("hidden");
}

const PY_TRACE_CODE = `
import sys, io, json, builtins, traceback, ast

_source = STUDENT_CODE
_snapshots = []
_stdout = io.StringIO()
_old_stdout = sys.stdout
_previous = {}

def _safe(value, depth=0):
    if depth > 2:
        return {"type": type(value).__name__, "repr": "..."}
    t = type(value).__name__
    try:
        if isinstance(value, (int, float, bool)) or value is None:
            rep = repr(value)
        elif isinstance(value, str):
            rep = repr(value if len(value) <= 120 else value[:117] + "...")
        elif isinstance(value, list):
            vals = [_safe(v, depth+1)["repr"] for v in value[:12]]
            rep = "[" + ", ".join(vals) + (", ..." if len(value) > 12 else "") + "]"
        elif isinstance(value, tuple):
            vals = [_safe(v, depth+1)["repr"] for v in value[:12]]
            rep = "(" + ", ".join(vals) + (", ..." if len(value) > 12 else "") + ("," if len(value)==1 else "") + ")"
        elif isinstance(value, dict):
            items = []
            for i, (k, v) in enumerate(value.items()):
                if i >= 10:
                    items.append("...")
                    break
                items.append(f"{repr(k)}: {_safe(v, depth+1)['repr']}")
            rep = "{" + ", ".join(items) + "}"
        elif isinstance(value, set):
            vals = [_safe(v, depth+1)["repr"] for v in list(value)[:12]]
            rep = "{" + ", ".join(vals) + ("..." if len(value) > 12 else "") + "}"
        else:
            rep = repr(value)
            if len(rep) > 180:
                rep = rep[:177] + "..."
    except Exception:
        rep = f"<{t}>"
    return {"type": t, "repr": rep}

def _visible_locals(frame):
    data = {}
    for k, v in frame.f_locals.items():
        if not k.startswith("__") and k not in {"_source", "_snapshots", "_stdout", "_old_stdout", "_previous"}:
            data[k] = _safe(v)
    return data

def _source_label(node):
    try:
        text = ast.get_source_segment(_source, node)
        if text:
            text = " ".join(text.strip().split())
            return text[:110] + ("..." if len(text) > 110 else "")
    except Exception:
        pass
    return type(node).__name__

def _node_base(node, kind, label):
    return {
        "id": f"{kind}-{getattr(node, 'lineno', 0)}-{getattr(node, 'col_offset', 0)}",
        "type": kind,
        "line": getattr(node, "lineno", None),
        "end_line": getattr(node, "end_lineno", getattr(node, "lineno", None)),
        "label": label
    }

def _build_block(statements):
    return [_build_node(stmt) for stmt in statements]

def _build_except_handler(handler):
    if handler.type is None:
        label = "except"
    else:
        try:
            label = "except " + ast.unparse(handler.type)
        except Exception:
            label = "except " + _source_label(handler.type)
    if handler.name:
        label += f" as {handler.name}"
    item = _node_base(handler, "except", label)
    item["body"] = _build_block(handler.body)
    return item

def _build_node(node, elif_mode=False):
    if isinstance(node, ast.If):
        try:
            test = ast.unparse(node.test)
        except Exception:
            test = _source_label(node.test)
        item = _node_base(node, "elif" if elif_mode else "if", ("elif " if elif_mode else "if ") + test)
        item["body"] = _build_block(node.body)
        if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
            item["orelse"] = [_build_node(node.orelse[0], True)]
        else:
            item["orelse"] = _build_block(node.orelse)
        return item

    if isinstance(node, (ast.For, ast.AsyncFor)):
        try:
            label = "for " + ast.unparse(node.target) + " in " + ast.unparse(node.iter)
        except Exception:
            label = _source_label(node)
        item = _node_base(node, "loop", label)
        item["body"] = _build_block(node.body)
        item["orelse"] = _build_block(node.orelse)
        return item

    if isinstance(node, ast.While):
        try:
            label = "while " + ast.unparse(node.test)
        except Exception:
            label = _source_label(node)
        item = _node_base(node, "loop", label)
        item["body"] = _build_block(node.body)
        item["orelse"] = _build_block(node.orelse)
        return item

    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        args = []
        try:
            args = [arg.arg for arg in node.args.args]
        except Exception:
            args = []
        item = _node_base(node, "function", f"def {node.name}(" + ", ".join(args) + ")")
        item["body"] = _build_block(node.body)
        return item

    if isinstance(node, ast.Try):
        item = _node_base(node, "try", "try")
        item["body"] = _build_block(node.body)
        item["handlers"] = [_build_except_handler(handler) for handler in node.handlers]
        item["orelse"] = _build_block(node.orelse)
        item["finalbody"] = _build_block(node.finalbody)
        return item

    if isinstance(node, ast.Return):
        return _node_base(node, "return", _source_label(node))

    return _node_base(node, "statement", _source_label(node))

def _build_workflow():
    try:
        tree = ast.parse(_source)
        return {"type": "program", "body": _build_block(tree.body)}
    except Exception:
        return None

_last_line_by_frame = {}
_line_exceptions = {}

def _snapshot(frame, line):
    return {
        "line": line,
        "scope": frame.f_code.co_name,
        "variables": _visible_locals(frame),
        "output": _stdout.getvalue(),
        "exception": _line_exceptions.pop((id(frame), line), None)
    }

def _trace(frame, event, arg):
    if frame.f_code.co_filename != "<student>":
        return _trace
    fid = id(frame)

    if event == "line":
        prev = _last_line_by_frame.get(fid)
        if prev is not None:
            _snapshots.append(_snapshot(frame, prev))
        _last_line_by_frame[fid] = frame.f_lineno

    elif event == "exception":
        exc_type, exc_value, _tb = arg
        _line_exceptions[(fid, frame.f_lineno)] = {
            "type": exc_type.__name__,
            "message": str(exc_value),
            "line": frame.f_lineno
        }

    elif event == "return":
        prev = _last_line_by_frame.get(fid)
        if prev is not None:
            _snapshots.append(_snapshot(frame, prev))
        _last_line_by_frame.pop(fid, None)

    return _trace

sys.stdout = _stdout
_error = None
try:
    compiled = compile(_source, "<student>", "exec")
    sys.settrace(_trace)
    exec(compiled, {"__name__": "__main__"})
except Exception as e:
    line = None
    code_line = None
    offset = None

    if isinstance(e, SyntaxError):
        line = e.lineno
        offset = e.offset
        code_line = e.text.strip() if e.text else None
    else:
        tb = traceback.extract_tb(e.__traceback__)
        student_frames = [frame for frame in tb if frame.filename == "<student>"]
        if student_frames:
            last = student_frames[-1]
            line = last.lineno
            code_line = last.line

    if line and not code_line:
        parts = _source.splitlines()
        if 1 <= line <= len(parts):
            code_line = parts[line - 1].strip()

    _error = {
        "type": type(e).__name__,
        "message": str(e),
        "line": line,
        "code": code_line,
        "offset": offset
    }
finally:
    sys.settrace(None)
    sys.stdout = _old_stdout

RESULT_JSON = json.dumps({
    "snapshots": _snapshots,
    "error": _error,
    "final_output": _stdout.getvalue(),
    "workflow": _build_workflow()
})
`;

function isSignedIn() {
  return Boolean(authBridge()?.getUser?.());
}

function openSignInDialog() {
  const auth = authBridge();
  if (auth?.openSignIn) auth.openSignIn();
  else document.getElementById("accountBtn")?.click();
}

function requireSignedIn(actionName) {
  if (isSignedIn()) return true;
  showToast(`${actionName} requires a learner account. Please sign in first.`, true);
  openSignInDialog();
  return false;
}

function canUseAi() {
  return Boolean(AI_API_URL && isSignedIn());
}

function updateAccountGatedControls() {
  const signedIn = isSignedIn();
  els.myLearningTab.disabled = !signedIn;
  els.newExample.disabled = false;
  els.saveExample.disabled = !signedIn;
  els.aiExplain.disabled = !canUseAi() || (!lastError && stepIndex < 0);
  els.staticAiNotice.textContent = AI_API_URL
    ? "Sign in with a learner account to use the AI tutor. Step-by-step Python explanations still run locally."
    : "AI tutor is disabled in this deployment. Step-by-step Python explanations still run locally.";
  els.staticAiNotice.classList.toggle("hidden", Boolean(AI_API_URL && signedIn));

  if (!signedIn && libraryMode === "my-learning") {
    setLibraryMode("concepts");
  }
}

function clearLegacyMyLearningCache() {
  localStorage.removeItem("pystep_my_learning_examples");
}

async function syncMyLearningFromAccount() {
  const auth = authBridge();
  const user = auth?.getUser?.();
  if (!user) return;

  try {
    const learnerId = user.id;
    const remoteExamples = await auth.loadExamples();
    if (authBridge()?.getUser?.()?.id !== learnerId) return;
    myLearningExamples = Array.isArray(remoteExamples) ? remoteExamples : [];
    renderExamples();
    showToast("Synced My learning examples.");
  } catch (err) {
    showToast(`Cloud sync failed: ${err.message || String(err)}`, true);
  }
}

function handleAuthChanged(event) {
  const previousLearnerId = activeLearnerId;
  const nextLearnerId = event.detail?.user?.id || null;
  activeLearnerId = nextLearnerId;
  myLearningExamples = [];

  if (currentExample.source === "my-learning") {
    loadExample("concepts", 0);
  } else {
    renderExamples();
  }

  if (!nextLearnerId) {
    updateAccountGatedControls();
    if (previousLearnerId) showToast("Signed out. My learning examples are hidden.");
    return;
  }

  updateAccountGatedControls();
  syncMyLearningFromAccount();
}

function getCurrentExample() {
  if (currentExample.source === "my-learning") {
    return myLearningExamples[currentExample.index] || null;
  }
  return conceptExamples[currentExample.index] || null;
}

function setLibraryMode(mode) {
  if (mode === "my-learning" && !requireSignedIn("My learning")) return;
  libraryMode = mode;
  els.libraryTab.classList.toggle("active", mode === "concepts");
  els.myLearningTab.classList.toggle("active", mode === "my-learning");
  renderExamples();
  updateAccountGatedControls();
}

function renderExamples() {
  els.list.innerHTML = "";
  if (libraryMode === "my-learning") {
    renderMyLearningExamples();
    return;
  }

  const grouped = conceptExamples.reduce((acc, ex, index) => {
    if (!acc[ex.tag]) acc[ex.tag] = [];
    acc[ex.tag].push({ ex, index });
    return acc;
  }, {});

  for (const [concept, items] of Object.entries(grouped)) {
    const group = document.createElement("div");
    group.className = "library-group";
    group.innerHTML = `<div class="concept-label">${escapeHtml(concept)}</div>`;

    for (const { ex, index } of items) {
      const btn = document.createElement("button");
      const active = currentExample.source === "concepts" && index === currentExample.index;
      btn.className = "example-btn" + (active ? " active" : "");
      btn.innerHTML = `${escapeHtml(ex.title)}<small>${escapeHtml(ex.insight)}</small>`;
      btn.onclick = () => loadExample("concepts", index);
      group.appendChild(btn);
    }

    els.list.appendChild(group);
  }
}

function renderMyLearningExamples() {
  if (!isSignedIn()) {
    els.list.innerHTML = `
      <div class="library-empty">
        <strong>Sign in required</strong>
        <span>My learning examples are stored with your learner account.</span>
      </div>
    `;
    return;
  }

  if (!myLearningExamples.length) {
    els.list.innerHTML = `
      <div class="library-empty">
        <strong>No saved examples yet</strong>
        <span>Create or edit code, then save it to My learning.</span>
      </div>
    `;
    return;
  }

  myLearningExamples.forEach((ex, index) => {
    const row = document.createElement("div");
    row.className = "my-example-row";

    const btn = document.createElement("button");
    const active = currentExample.source === "my-learning" && index === currentExample.index;
    btn.className = "example-btn" + (active ? " active" : "");
    btn.innerHTML = `${escapeHtml(ex.title)}<small>${escapeHtml(ex.tag || "My learning")}</small>`;
    btn.onclick = () => loadExample("my-learning", index);

    const del = document.createElement("button");
    del.className = "delete-example-btn";
    del.type = "button";
    del.title = "Delete saved example";
    del.textContent = "×";
    del.onclick = () => deleteMyExample(index);

    row.appendChild(btn);
    row.appendChild(del);
    els.list.appendChild(row);
  });
}

function loadExample(source, index) {
  stopAuto();
  currentExample = { source, index };
  const ex = getCurrentExample();
  if (!ex) return;
  els.title.textContent = ex.title;
  els.editor.value = ex.code;
  els.insight.textContent = ex.insight;
  resetTrace();
  renderExamples();
  renderLineNumbers();
}

function startOwnExample() {
  stopAuto();
  currentExample = { source: "draft", index: -1 };
  els.title.textContent = "Own Python example";
  els.editor.value = `# Write your Python example here
name = "Learner"
print("Hello", name)`;
  els.insight.textContent = isSignedIn()
    ? "This is your own example. Save it to My learning when you want to keep it."
    : "This is a temporary own example. You can run it now, but sign in before saving it to My learning.";
  resetTrace();
  renderExamples();
  renderLineNumbers();
  if (!isSignedIn()) {
    showToast("Own example opened. Sign in only if you want to save it.");
  }
}

function saveCurrentExample() {
  if (!requireSignedIn("Saving to My learning")) return;

  const title = prompt("Save this example as:", getCurrentExample()?.title || "My Python example");
  if (!title) return;

  const existingIndex = currentExample.source === "my-learning" ? currentExample.index : -1;
  const previous = existingIndex >= 0 ? myLearningExamples[existingIndex] : null;
  const saved = {
    remoteId: previous?.remoteId,
    title: title.trim(),
    tag: "My learning",
    code: els.editor.value,
    insight: "Saved by the learner in My learning."
  };

  const auth = authBridge();
  if (auth?.getUser?.()) {
    showToast("Saving to My learning...");
    auth.saveExample(saved)
      .then(remote => {
        if (!remote) return;
        if (existingIndex >= 0) {
          myLearningExamples[existingIndex] = remote;
          currentExample = { source: "my-learning", index: existingIndex };
        } else {
          myLearningExamples.unshift(remote);
          currentExample = { source: "my-learning", index: 0 };
        }
        setLibraryMode("my-learning");
        loadExample("my-learning", currentExample.index);
        showToast("Saved to My learning.");
      })
      .catch(err => showToast(`Could not save to your account: ${err.message || String(err)}`, true));
  }
}

function deleteMyExample(index) {
  const ex = myLearningExamples[index];
  if (!ex || !confirm(`Delete "${ex.title}" from My learning?`)) return;

  myLearningExamples.splice(index, 1);

  const auth = authBridge();
  if (ex.remoteId && auth?.getUser?.()) {
    auth.deleteExample(ex.remoteId)
      .catch(err => showToast(`Deleted locally, but cloud delete failed: ${err.message || String(err)}`, true));
  }

  if (currentExample.source === "my-learning") {
    if (myLearningExamples.length) loadExample("my-learning", Math.min(index, myLearningExamples.length - 1));
    else loadExample("concepts", 0);
  }

  renderExamples();
  showToast("Removed from My learning.");
}

function renderLineNumbers() {
  const count = Math.max(1, els.editor.value.split("\n").length);
  els.lineNumbers.innerHTML = Array.from({length: count}, (_, i) =>
    `<div class="line-num" data-line="${i+1}">${i+1}</div>`
  ).join("");
  syncEditorScroll();
}

function syncEditorScroll() {
  els.lineNumbers.scrollTop = els.editor.scrollTop;
}

function resetTrace() {
  trace = [];
  stepIndex = -1;
  lastError = null;
  lastFinalOutput = "";
  workflowGraph = null;
  lastJumpSoundStep = null;
  finishSoundPlayed = false;
  aiMessages = [];
  els.next.disabled = true;
  els.prev.disabled = true;
  els.auto.disabled = true;
  els.aiExplain.disabled = true;
  els.aiQuestionInput.disabled = true;
  els.aiQuestionForm.classList.add("hidden");
  els.counter.textContent = "Step 0 / 0";
  els.output.textContent = "No output yet.";
  els.workflowBadge.textContent = "Not prepared";
  els.workflowEmpty.textContent = "Prepare execution to see the workflow path.";
  els.workflowEmpty.classList.remove("hidden");
  els.workflowCanvas.classList.add("hidden");
  els.workflowCanvas.innerHTML = "";
  els.explanation.textContent = "Prepare the program to build its execution trace.";
  els.aiExplanation.classList.add("hidden");
  renderAiChat();
  els.scope.textContent = "global";
  els.memEmpty.classList.remove("hidden");
  els.memWrap.classList.add("hidden");
  els.body.innerHTML = "";
  els.overlay.classList.add("hidden");
  document.querySelectorAll(".line-num.active").forEach(el => el.classList.remove("active"));
}

async function initPython() {
  try {
    pyodide = await loadPyodide();
    els.engine.textContent = "Python engine ready";
    els.dot.classList.add("ready");
    els.run.disabled = false;
  } catch (err) {
    els.engine.textContent = "Python engine failed to load";
    els.dot.classList.add("error");
    showToast("Could not load Pyodide. Check your internet connection and reload.", true);
    els.run.disabled = true;
  }
}

async function prepareExecution() {
  if (!pyodide) {
    showToast("Python is still loading.", true);
    return;
  }
  stopAuto();
  resetTrace();
  els.run.disabled = true;
  els.run.textContent = "Preparing…";

  try {
    pyodide.globals.set("STUDENT_CODE", els.editor.value);
    await pyodide.runPythonAsync(PY_TRACE_CODE);
    const raw = pyodide.globals.get("RESULT_JSON");
    const result = JSON.parse(raw);
    trace = result.snapshots || [];
    lastError = result.error || null;
    lastFinalOutput = result.final_output || "";
    workflowGraph = result.workflow || null;

    if (!trace.length) {
      els.output.textContent = result.final_output || "No output.";
      if (result.error) {
        renderError(result.error, result.final_output);
      } else {
        showToast("No executable steps were captured.", true);
      }
      return;
    }

    stepIndex = result.error ? trace.length - 1 : 0;
    renderStep();
    els.next.disabled = Boolean(result.error);
    els.prev.disabled = stepIndex <= 0;
    els.auto.disabled = Boolean(result.error);
    if (result.error) {
      renderError(result.error, result.final_output);
      showToast(`Python stopped at line ${result.error.line || "?"}: ${result.error.type}`, true);
    } else {
      showToast(`Execution trace ready: ${trace.length} steps.`);
    }
  } catch (err) {
    showToast(String(err), true);
  } finally {
    els.run.disabled = false;
    els.run.textContent = "▶ Prepare execution";
  }
}

function renderError(error, finalOutput="") {
  stopAuto();
  if (error.line) highlightLine(error.line);
  els.output.textContent = finalOutput || "No output before the error.";
  els.explanation.innerHTML = explainError(error);
  els.counter.textContent = error.line ? `Error at line ${error.line}` : "Error";
  els.scope.textContent = "error";
  els.next.disabled = true;
  els.auto.disabled = true;
  els.aiExplain.disabled = !canUseAi();
  renderWorkflow();
  resetAiChatForContext();
  showToast(`Python stopped: ${error.type}${error.line ? ` on line ${error.line}` : ""}`, true);
}

function renderStep() {
  if (isWorkflowFinished()) {
    renderFinishedStep();
    return;
  }

  const snap = trace[stepIndex];
  if (!snap) return;

  const previous = stepIndex > 0 ? trace[stepIndex - 1] : null;
  els.counter.textContent = `Step ${stepIndex + 1} / ${trace.length}`;
  els.scope.textContent = snap.scope === "<module>" ? "global" : snap.scope;
  els.output.textContent = snap.output || "No output yet.";

  highlightLine(snap.line);
  renderMemory(snap.variables || {}, previous?.variables || {});
  els.explanation.innerHTML = explainStep(snap, previous);
  renderWorkflow();
  playJumpSoundForStep();

  els.prev.disabled = stepIndex <= 0;
  els.next.disabled = false;
  els.auto.disabled = false;
  els.aiExplain.disabled = !canUseAi();
  resetAiChatForContext();
}

function renderFinishedStep() {
  const previous = trace[trace.length - 1] || null;
  els.counter.textContent = `Finished · ${trace.length} step${trace.length === 1 ? "" : "s"}`;
  els.scope.textContent = "finished";
  els.output.textContent = lastFinalOutput || previous?.output || "No output.";
  els.explanation.innerHTML = `Program finished after <strong>${trace.length}</strong> executed step${trace.length === 1 ? "" : "s"}.`;

  if (previous) {
    highlightLine(previous.line);
    renderMemory(previous.variables || {}, trace[trace.length - 2]?.variables || {});
  }

  renderWorkflow();
  playJumpSoundForStep();

  els.prev.disabled = trace.length === 0;
  els.next.disabled = true;
  els.auto.disabled = true;
  els.aiExplain.disabled = !canUseAi();
  resetAiChatForContext();
}

function resetAiChatForContext() {
  aiMessages = [];
  els.aiQuestionInput.value = "";
  els.aiQuestionInput.disabled = !canUseAi();
  els.aiQuestionForm.classList.toggle("hidden", !canUseAi());
  els.aiExplanation.classList.add("hidden");
  renderAiChat();
}

function playJumpSoundForStep() {
  const snap = trace[stepIndex];
  const stepKey = isWorkflowFinished()
    ? `finished:${trace.length}`
    : (snap ? `${stepIndex}:${snap.line}:${snap.scope}` : "");
  if (!stepKey || stepKey === lastJumpSoundStep) return;
  lastJumpSoundStep = stepKey;

  if (isWorkflowFinished()) {
    if (!finishSoundPlayed) {
      finishSoundPlayed = true;
      playFinishSound();
    }
    return;
  }

  finishSoundPlayed = false;
  playJumpSound();
}

function playJumpSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    jumpAudioContext = jumpAudioContext || new AudioContextClass();
    if (jumpAudioContext.state === "suspended") {
      jumpAudioContext.resume();
    }

    const now = jumpAudioContext.currentTime;
    const gain = jumpAudioContext.createGain();
    const oscillator = jumpAudioContext.createOscillator();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.055);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    oscillator.connect(gain);
    gain.connect(jumpAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (err) {
    // Browsers may block audio until a user gesture; the visual jump still works.
  }
}

function playFinishSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    jumpAudioContext = jumpAudioContext || new AudioContextClass();
    if (jumpAudioContext.state === "suspended") {
      jumpAudioContext.resume();
    }

    const now = jumpAudioContext.currentTime;
    const gain = jumpAudioContext.createGain();
    const first = jumpAudioContext.createOscillator();
    const second = jumpAudioContext.createOscillator();

    first.type = "sine";
    second.type = "triangle";
    first.frequency.setValueAtTime(660, now);
    first.frequency.exponentialRampToValueAtTime(990, now + 0.12);
    second.frequency.setValueAtTime(880, now + 0.09);
    second.frequency.exponentialRampToValueAtTime(1320, now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.025);
    gain.gain.setValueAtTime(0.03, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    first.connect(gain);
    second.connect(gain);
    gain.connect(jumpAudioContext.destination);
    first.start(now);
    first.stop(now + 0.16);
    second.start(now + 0.08);
    second.stop(now + 0.3);
  } catch (err) {
    // Browsers may block audio until a user gesture; the visual finish state still works.
  }
}

async function explainWithAi(question="Explain what Python is doing right now.") {
  if (!AI_API_URL) {
    showToast("AI tutor is disabled on the free GitHub Pages version.", true);
    return;
  }
  if (!requireSignedIn("AI tutor")) {
    return;
  }

  const context = buildAiContext();
  if (!context) {
    showToast("Prepare execution first.", true);
    return;
  }

  els.aiExplain.disabled = true;
  els.aiExplain.textContent = "Thinking...";
  els.aiQuestionInput.disabled = true;
  els.aiExplanation.classList.remove("hidden");
  aiMessages.push({ role: "user", content: question });
  renderAiChat(true);

  try {
    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        context,
        messages: aiMessages
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "The AI request failed.");
    }

    const text = data.text;
    aiMessages.push({ role: "assistant", content: text || "AI did not return an explanation." });
    renderAiChat();
  } catch (err) {
    aiMessages.push({ role: "assistant", content: `AI explanation unavailable: ${err.message || String(err)}`, error: true });
    renderAiChat();
    showToast("AI explanation failed.", true);
  } finally {
    els.aiExplain.disabled = !canUseAi();
    els.aiExplain.textContent = "Ask AI";
    els.aiQuestionInput.disabled = !canUseAi();
    els.aiQuestionInput.focus();
  }
}

function renderAiChat(isLoading=false) {
  els.aiChatLog.innerHTML = "";

  if (!aiMessages.length && !isLoading) {
    return;
  }

  for (const message of aiMessages) {
    const item = document.createElement("div");
    item.className = `ai-message ${message.role === "user" ? "user" : "assistant"}${message.error ? " error-card" : ""}`;
    item.innerHTML = `
      <div class="ai-message-role">${message.role === "user" ? "You" : "AI tutor"}</div>
      <div>${formatAiText(message.content)}</div>
    `;
    els.aiChatLog.appendChild(item);
  }

  if (isLoading) {
    const item = document.createElement("div");
    item.className = "ai-message assistant loading";
    item.innerHTML = `
      <div class="ai-message-role">AI tutor</div>
      <div>Thinking with the current line, memory state, output, and error details...</div>
    `;
    els.aiChatLog.appendChild(item);
  }

  els.aiChatLog.scrollTop = els.aiChatLog.scrollHeight;
}

function buildAiContext() {
  const source = els.editor.value;
  const lines = source.split("\n");
  const current = getCurrentExample();

  if (lastError) {
    return {
      mode: "error",
      task: "Answer as a Python tutor. Explain the current error and answer the learner's question using only this code and execution state.",
      source,
      error: lastError,
      current_example: current ? { title: current.title, concept: current.tag || "My learning" } : null,
      current_line_number: lastError.line,
      current_line_code: lastError.code || (lastError.line ? lines[lastError.line - 1] || "" : ""),
      output_before_error: lastFinalOutput,
      last_snapshot_before_error: trace[trace.length - 1] || null
    };
  }

  const snap = trace[stepIndex];
  if (!snap) return null;
  const previous = stepIndex > 0 ? trace[stepIndex - 1] : null;

  return {
    mode: "step",
    task: "Answer as a Python tutor. Python has just executed the current line. Explain or answer the learner's question using only this code and execution state.",
    source,
    current_example: current ? { title: current.title, concept: current.tag || "My learning" } : null,
    step_number: stepIndex + 1,
    total_steps: trace.length,
    current_line_number: snap.line,
    current_line_code: lines[snap.line - 1] || "",
    current_scope: snap.scope === "<module>" ? "global" : snap.scope,
    previous_variables: previous?.variables || {},
    variables_after_line: snap.variables || {},
    output_so_far: snap.output || ""
  };
}

function formatAiText(text) {
  const normalized = normalizeAiMarkdown(text);
  const blocks = normalized.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);

  return blocks.map(block => {
    if (/^[-*]\s+/m.test(block)) {
      const items = block
        .split(/\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^[-*]\s+/, ""))
        .map(line => `<li>${formatInlineMarkdown(line)}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }

    return `<p>${formatInlineMarkdown(block).replaceAll("\n", "<br>")}</p>`;
  }).join("");
}

function normalizeAiMarkdown(text) {
  return String(text || "")
    .replace(/\\([*_`[\]()#+\-.!])/g, "$1")
    .replace(/\\\r?\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function formatInlineMarkdown(text) {
  const placeholders = [];
  let safe = escapeHtml(text);

  safe = safe.replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@CODE${placeholders.length}@@`;
    placeholders.push(`<code>${code}</code>`);
    return token;
  });

  safe = safe.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  safe = safe
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  placeholders.forEach((html, i) => {
    safe = safe.replaceAll(`@@CODE${i}@@`, html);
  });

  return safe;
}

function renderMemory(vars, prevVars) {
  const entries = Object.entries(vars).filter(([name]) =>
    !name.startsWith("_") && !["builtins"].includes(name)
  );

  if (!entries.length) {
    els.memEmpty.classList.remove("hidden");
    els.memWrap.classList.add("hidden");
    return;
  }

  els.memEmpty.classList.add("hidden");
  els.memWrap.classList.remove("hidden");
  els.body.innerHTML = "";

  for (const [name, info] of entries) {
    const row = document.createElement("tr");
    row.className = "memory-row";
    if (!(name in prevVars)) row.classList.add("new");
    else if (JSON.stringify(info) !== JSON.stringify(prevVars[name])) row.classList.add("changed");

    row.innerHTML = `
      <td class="var-name">${escapeHtml(name)}</td>
      <td><span class="type-pill">${escapeHtml(info.type)}</span></td>
      <td class="value-cell">${escapeHtml(info.repr)}</td>
    `;
    els.body.appendChild(row);
  }
}

function renderWorkflow() {
  if (!trace.length && !lastError) {
    els.workflowBadge.textContent = "Not prepared";
    els.workflowEmpty.textContent = "Prepare execution to see the workflow path.";
    els.workflowEmpty.classList.remove("hidden");
    els.workflowCanvas.classList.add("hidden");
    els.workflowCanvas.innerHTML = "";
    return;
  }

  const lineCounts = trace.reduce((acc, snap) => {
    acc[snap.line] = (acc[snap.line] || 0) + 1;
    return acc;
  }, {});
  const scopeCount = new Set(trace.map(snap => snap.scope)).size;
  els.workflowBadge.textContent = trace.length
    ? `${trace.length} step${trace.length === 1 ? "" : "s"} · ${scopeCount} scope${scopeCount === 1 ? "" : "s"}`
    : "Error before first step";
  els.workflowEmpty.classList.add("hidden");
  els.workflowCanvas.classList.remove("hidden");
  els.workflowCanvas.innerHTML = "";

  const chart = document.createElement("div");
  chart.className = "flowchart";
  chart.appendChild(renderFlowTerminus("Start", "Program begins"));

  const body = workflowGraph?.body?.length ? workflowGraph.body : buildFallbackWorkflow();
  chart.appendChild(renderWorkflowBlock(body, lineCounts));

  if (lastError) {
    chart.appendChild(renderWorkflowErrorNode());
  } else {
    chart.appendChild(renderFlowTerminus("End", "Program finishes", isWorkflowFinished()));
  }

  els.workflowCanvas.appendChild(chart);

  const active = els.workflowCanvas.querySelector(".current-step");
  if (active) {
    els.workflowCanvas.scrollLeft = active.offsetLeft - (els.workflowCanvas.clientWidth - active.clientWidth) / 2;
  }
}

function renderWorkflowBlock(nodes, lineCounts) {
  const block = document.createElement("div");
  block.className = "flow-block";

  if (!nodes.length) {
    const empty = document.createElement("div");
    empty.className = "flow-empty-path";
    empty.textContent = "No statements on this path";
    block.appendChild(empty);
    return block;
  }

  nodes.forEach((node, index) => {
    if (index > 0) block.appendChild(renderFlowConnector());
    block.appendChild(renderWorkflowNode(node, lineCounts));
  });

  return block;
}

function renderWorkflowNode(node, lineCounts) {
  if (node.type === "if" || node.type === "elif") return renderDecisionNode(node, lineCounts);
  if (node.type === "loop") return renderLoopNode(node, lineCounts);
  if (node.type === "function") return renderFunctionNode(node, lineCounts);
  if (node.type === "try") return renderTryNode(node, lineCounts);
  if (node.type === "except") return renderExceptNode(node, lineCounts);
  return renderStatementNode(node, lineCounts);
}

function renderDecisionNode(node, lineCounts) {
  const wrap = document.createElement("div");
  wrap.className = `decision-card ${nodeStatusClass(node)} ${currentStepClass(node)}`;
  wrap.appendChild(renderDiamond(node, lineCounts));

  const lanes = document.createElement("div");
  lanes.className = "branch-lanes";
  lanes.appendChild(renderBranchLane("True path", node.body || [], lineCounts, branchWasTaken(node.body || [])));
  lanes.appendChild(renderBranchLane(node.orelse?.[0]?.type === "elif" ? "Else / elif" : "False path", node.orelse || [], lineCounts, branchWasTaken(node.orelse || [])));
  wrap.appendChild(lanes);

  return wrap;
}

function renderDiamond(node, lineCounts) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "decision-diamond";
  btn.disabled = !hasTraceForLine(node.line);
  btn.onclick = () => jumpToLine(node.line);
  btn.innerHTML = `
    <span class="decision-content">
      <span>${escapeHtml(node.type === "elif" ? "elif" : "if")}</span>
      <strong>${escapeHtml(node.label.replace(/^(if|elif)\s+/, ""))}</strong>
      ${renderExecutionBadge(node, lineCounts)}
    </span>
  `;
  return btn;
}

function renderLoopNode(node, lineCounts) {
  const wrap = document.createElement("div");
  wrap.className = `loop-card ${nodeStatusClass(node)} ${currentStepClass(node)}`;

  const header = document.createElement("button");
  header.type = "button";
  header.className = "loop-header";
  header.disabled = !hasTraceForLine(node.line);
  header.onclick = () => jumpToLine(node.line);
  header.innerHTML = `
    <span class="loop-icon">↺</span>
    <span>
      <strong>${escapeHtml(node.label)}</strong>
      <small>Loop body repeats while this condition or iterator continues</small>
    </span>
    ${renderLoopBadge(node, lineCounts)}
  `;

  const body = document.createElement("div");
  body.className = "loop-body";
  body.appendChild(renderWorkflowBlock(node.body || [], lineCounts));

  const back = document.createElement("div");
  back.className = "loop-back";
  back.textContent = "Back to loop check";

  wrap.appendChild(header);
  wrap.appendChild(body);
  wrap.appendChild(back);

  if (node.orelse?.length) {
    wrap.appendChild(renderBranchLane("Loop else", node.orelse, lineCounts, branchWasTaken(node.orelse)));
  }

  return wrap;
}

function renderFunctionNode(node, lineCounts) {
  const wrap = document.createElement("div");
  wrap.className = `function-card ${nodeStatusClass(node)} ${currentStepClass(node)}`;
  wrap.appendChild(renderStatementNode(node, lineCounts));
  const body = document.createElement("div");
  body.className = "function-body";
  body.appendChild(renderWorkflowBlock(node.body || [], lineCounts));
  wrap.appendChild(body);
  return wrap;
}

function renderTryNode(node, lineCounts) {
  const wrap = document.createElement("div");
  wrap.className = `try-card ${nodeStatusClass(node)} ${currentStepClass(node)}`;
  wrap.appendChild(renderStatementNode(node, lineCounts));

  const lanes = document.createElement("div");
  lanes.className = "try-lanes";
  lanes.appendChild(renderBranchLane("Try body", node.body || [], lineCounts, branchWasTaken(node.body || [])));

  (node.handlers || []).forEach(handler => {
    lanes.appendChild(renderBranchLane(handler.label || "except", [handler], lineCounts, branchWasTaken([handler])));
  });

  if (node.orelse?.length) {
    lanes.appendChild(renderBranchLane("Else path", node.orelse, lineCounts, branchWasTaken(node.orelse)));
  }

  if (node.finalbody?.length) {
    lanes.appendChild(renderBranchLane("Finally", node.finalbody, lineCounts, branchWasTaken(node.finalbody)));
  }

  wrap.appendChild(lanes);
  return wrap;
}

function renderExceptNode(node, lineCounts) {
  const wrap = document.createElement("div");
  wrap.className = `except-card ${nodeStatusClass(node)} ${currentStepClass(node)}`;
  wrap.appendChild(renderStatementNode(node, lineCounts));
  const body = document.createElement("div");
  body.className = "except-body";
  body.appendChild(renderWorkflowBlock(node.body || [], lineCounts));
  wrap.appendChild(body);
  return wrap;
}

function renderStatementNode(node, lineCounts) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `flow-node ${node.type || "statement"} ${nodeStatusClass(node)} ${currentStepClass(node)}`;
  btn.disabled = !hasTraceForLine(node.line);
  btn.onclick = () => jumpToLine(node.line);
  btn.innerHTML = `
    <span class="flow-node-kind">${escapeHtml(flowKindLabel(node.type))}</span>
    <span class="flow-node-line">Line ${escapeHtml(node.line || "?")}</span>
    <code>${escapeHtml(node.label || getSourceLine(node.line).trim() || "(statement)")}</code>
    ${renderExecutionBadge(node, lineCounts)}
  `;
  return btn;
}

function renderBranchLane(title, nodes, lineCounts, taken) {
  const lane = document.createElement("div");
  lane.className = `branch-lane ${taken ? "taken" : "not-taken"}`;
  lane.innerHTML = `<div class="branch-title">${escapeHtml(title)}<span>${taken ? "taken" : "not taken"}</span></div>`;
  lane.appendChild(renderWorkflowBlock(nodes, lineCounts));
  return lane;
}

function renderFlowConnector() {
  const connector = document.createElement("div");
  connector.className = "flow-connector";
  return connector;
}

function renderFlowTerminus(title, subtitle, isCurrent=false) {
  const node = document.createElement("div");
  node.className = `flow-terminus ${isCurrent ? "current-step finished" : ""}`;
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span>`;
  return node;
}

function renderWorkflowErrorNode() {
  const errorNode = document.createElement("div");
  errorNode.className = "flow-node error active";
  errorNode.innerHTML = `
    <span class="flow-node-kind">Stopped</span>
    <span class="flow-node-line">${lastError.line ? `Line ${lastError.line}` : "Error"}</span>
    <code>${escapeHtml(lastError.code || lastError.message || "Python stopped")}</code>
    <span class="execution-badge error">${escapeHtml(lastError.type || "Error")}</span>
  `;
  return errorNode;
}

function renderExecutionBadge(node, lineCounts) {
  const count = ownExecutionCount(node, lineCounts);
  if (!count) return `<span class="execution-badge muted">0 runs</span>`;
  return `<span class="execution-badge">${count} run${count === 1 ? "" : "s"}</span>`;
}

function renderLoopBadge(node, lineCounts) {
  const checks = ownExecutionCount(node, lineCounts);
  const iterations = loopIterationCount(node, lineCounts);
  if (!checks && !iterations) {
    return `<span class="execution-badge muted">0 iterations</span>`;
  }

  return `
    <span class="execution-badge loop-badge">
      <strong>${iterations}</strong> iteration${iterations === 1 ? "" : "s"}
      <small>${checks} check${checks === 1 ? "" : "s"}</small>
    </span>
  `;
}

function nodeStatusClass(node) {
  if (isCurrentNode(node)) return "active";
  if (executionCountForNode(node) > 0) return "visited";
  return "skipped";
}

function currentStepClass(node) {
  const current = trace[stepIndex];
  if (isWorkflowFinished()) return "";
  return current && node.line === current.line ? "current-step" : "";
}

function isWorkflowFinished() {
  return !lastError && trace.length > 0 && stepIndex >= trace.length;
}

function isCurrentNode(node) {
  const current = trace[stepIndex];
  if (!current || !node.line) return false;
  return current.line >= node.line && current.line <= (node.end_line || node.line);
}

function branchWasTaken(nodes) {
  return nodes.some(node => executionCountForNode(node) > 0);
}

function ownExecutionCount(node, lineCounts=null) {
  const counts = lineCounts || trace.reduce((acc, snap) => {
    acc[snap.line] = (acc[snap.line] || 0) + 1;
    return acc;
  }, {});
  return counts[node.line] || 0;
}

function loopIterationCount(node, lineCounts=null) {
  const counts = lineCounts || trace.reduce((acc, snap) => {
    acc[snap.line] = (acc[snap.line] || 0) + 1;
    return acc;
  }, {});

  return Math.max(
    ...collectBodyLines(node.body || []).map(line => counts[line] || 0),
    0
  );
}

function collectBodyLines(nodes) {
  const lines = [];
  for (const node of nodes) {
    if (node.line) lines.push(node.line);
    lines.push(...collectBodyLines(node.body || []));
    lines.push(...collectBodyLines(node.orelse || []));
    lines.push(...collectBodyLines(node.handlers || []));
    lines.push(...collectBodyLines(node.finalbody || []));
  }
  return lines;
}

function executionCountForNode(node, lineCounts=null) {
  const counts = lineCounts || trace.reduce((acc, snap) => {
    acc[snap.line] = (acc[snap.line] || 0) + 1;
    return acc;
  }, {});
  let total = counts[node.line] || 0;
  for (const child of [...(node.body || []), ...(node.orelse || [])]) {
    total += executionCountForNode(child, counts);
  }
  for (const handler of node.handlers || []) {
    total += executionCountForNode(handler, counts);
  }
  for (const child of node.finalbody || []) {
    total += executionCountForNode(child, counts);
  }
  return total;
}

function hasTraceForLine(line) {
  return trace.some(snap => snap.line === line);
}

function jumpToLine(line) {
  const index = trace.findIndex(snap => snap.line === line);
  if (index < 0) return;
  stopAuto();
  stepIndex = index;
  renderStep();
}

function buildFallbackWorkflow() {
  const uniqueLines = [...new Set(trace.map(snap => snap.line))];
  return uniqueLines.map(line => ({
    id: `line-${line}`,
    type: "statement",
    line,
    end_line: line,
    label: getSourceLine(line).trim() || "(statement)"
  }));
}

function flowKindLabel(type) {
  const labels = {
    try: "Try",
    except: "Except",
    function: "Function",
    return: "Return",
    statement: "Step"
  };
  return labels[type] || "Step";
}

function getSourceLine(lineNumber) {
  return els.editor.value.split("\n")[lineNumber - 1] || "";
}

function explainStep(snap, previous) {
  const lines = els.editor.value.split("\n");
  const code = (lines[snap.line - 1] || "").trim();
  const before = previous?.variables || {};
  const after = snap.variables || {};

  const newVars = Object.keys(after).filter(k => !(k in before));
  const changed = Object.keys(after).filter(k => k in before && JSON.stringify(after[k]) !== JSON.stringify(before[k]));

  let text = `Python executed line <strong>${snap.line}</strong>: <code>${escapeHtml(code || "(blank / block transition)")}</code>. `;

  if (newVars.length) {
    text += `New variable${newVars.length > 1 ? "s" : ""} created: <strong>${newVars.map(escapeHtml).join(", ")}</strong>. `;
  }
  if (changed.length) {
    text += `Updated: <strong>${changed.map(escapeHtml).join(", ")}</strong>. `;
  }
  if (!newVars.length && !changed.length) {
    text += `No visible variable changed at this step. `;
  }

  if (snap.exception) {
    text += `This line raised <strong>${escapeHtml(snap.exception.type)}</strong>: ${escapeHtml(snap.exception.message || "")}. Python then looked for an exception handler. `;
  }

  if (snap.scope !== "<module>") {
    text += `This step is inside the function <strong>${escapeHtml(snap.scope)}</strong>.`;
  }

  return text;
}

function explainError(error) {
  const type = error.type || "Error";
  const message = error.message || "Python could not finish running this code.";
  const line = error.line ? `line <strong>${error.line}</strong>` : "your code";
  const code = error.code ? `<code>${escapeHtml(error.code)}</code>` : "<code>(Python could not point to one line)</code>";

  return `
    <div class="error-card">
      <div class="error-kicker">Python stopped at ${line}</div>
      <div class="error-title">${escapeHtml(type)}: ${escapeHtml(message)}</div>
      <div class="error-code">${code}</div>
      <p>${simpleErrorExplanation(type, message)}</p>
      <p class="error-hint">${errorHint(type)}</p>
    </div>
  `;
}

function simpleErrorExplanation(type, message) {
  const lower = message.toLowerCase();
  const explanations = {
    SyntaxError: "Python could not understand the shape of this line. This usually means something is missing, extra, or indented in a way Python does not expect.",
    IndentationError: "Python uses indentation to know which lines belong together. This line is spaced in a way that does not match the surrounding block.",
    NameError: "Python saw a name it does not know yet. That usually means the variable was not created before this line, or its name is spelled differently.",
    TypeError: "This line tried to use a value in a way that does not fit its type, such as adding unlike things or calling something that is not a function.",
    ValueError: "The type of value is allowed here, but this specific value is not something Python can use for the operation.",
    IndexError: "This line asked for a list position that does not exist.",
    KeyError: "This line asked for a dictionary key that is not in the dictionary.",
    ZeroDivisionError: "This line tried to divide by zero, which Python cannot do.",
    AttributeError: "This line tried to use a method or property that this value does not have.",
    ImportError: "Python could not import something requested by this line.",
    ModuleNotFoundError: "Python could not find the module this line tried to import."
  };

  if (type === "NameError" && lower.includes("is not defined")) {
    return "Python reached this line and found a variable or function name that has not been made yet.";
  }
  if (type === "SyntaxError" && lower.includes("expected ':'")) {
    return "Python expected a colon at the end of a statement like if, else, for, while, or def.";
  }
  return explanations[type] || "Python ran the program with the real interpreter and stopped when this line caused a problem.";
}

function errorHint(type) {
  const hints = {
    SyntaxError: "Check punctuation, brackets, quotes, colons, and whether the line before this one is complete.",
    IndentationError: "Make sure lines inside the same block start with the same number of spaces.",
    NameError: "Check the spelling, then make sure the name is assigned before this line runs.",
    TypeError: "Look at the values on this line and ask whether the operation makes sense for their types.",
    ValueError: "Check the actual value being converted or passed into the operation.",
    IndexError: "Remember that list indexes start at 0, and the last index is one less than the list length.",
    KeyError: "Check the available dictionary keys, or test whether the key exists before reading it.",
    ZeroDivisionError: "Make sure the number on the right side of the division is not zero.",
    AttributeError: "Check the value's type and the spelling of the method or property.",
    ImportError: "This browser Python environment may not include every installed package.",
    ModuleNotFoundError: "This browser Python environment may not include that module."
  };
  return hints[type] || "Read the highlighted line first, then compare it with the values shown from the steps before it.";
}

function highlightLine(line) {
  document.querySelectorAll(".line-num.active").forEach(el => el.classList.remove("active"));
  const lineEl = document.querySelector(`.line-num[data-line="${line}"]`);
  if (lineEl) lineEl.classList.add("active");

  const lineHeight = 22.75;
  const topPadding = 18;
  els.overlay.style.top = `${topPadding + (line - 1) * lineHeight - els.editor.scrollTop}px`;
  els.overlay.classList.remove("hidden");

  const desired = topPadding + (line - 1) * lineHeight;
  const viewportTop = els.editor.scrollTop;
  const viewportBottom = viewportTop + els.editor.clientHeight - 40;
  if (desired < viewportTop || desired > viewportBottom) {
    els.editor.scrollTop = Math.max(0, desired - els.editor.clientHeight / 2);
    syncEditorScroll();
    els.overlay.style.top = `${topPadding + (line - 1) * lineHeight - els.editor.scrollTop}px`;
  }
}

function nextStep() {
  if (stepIndex < trace.length) {
    stepIndex++;
    renderStep();
  } else {
    stopAuto();
  }
}

function prevStep() {
  stopAuto();
  if (stepIndex > 0) {
    stepIndex--;
    renderStep();
  }
}

function toggleAuto() {
  if (autoTimer) {
    stopAuto();
    return;
  }
  els.auto.textContent = "Ⅱ Pause";
  const tick = () => {
    if (stepIndex >= trace.length) {
      stopAuto();
      return;
    }
    nextStep();
    autoTimer = setTimeout(tick, Number(els.speed.value));
  };
  autoTimer = setTimeout(tick, Number(els.speed.value));
}

function stopAuto() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  els.auto.textContent = "▶ Auto";
}

function showToast(message, isError=false) {
  els.toast.textContent = message;
  els.toast.className = "toast" + (isError ? " error" : "");
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.editor.addEventListener("input", () => {
  stopAuto();
  renderLineNumbers();
  resetTrace();
});
els.editor.addEventListener("scroll", () => {
  syncEditorScroll();
  if (stepIndex >= 0 && trace[stepIndex]) highlightLine(trace[stepIndex].line);
});
els.editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = els.editor.selectionStart;
    const end = els.editor.selectionEnd;
    els.editor.value = els.editor.value.substring(0, start) + "    " + els.editor.value.substring(end);
    els.editor.selectionStart = els.editor.selectionEnd = start + 4;
    renderLineNumbers();
  }
});

els.run.addEventListener("click", prepareExecution);
els.reset.addEventListener("click", () => {
  stopAuto();
  resetTrace();
  const ex = getCurrentExample();
  if (ex) {
    els.editor.value = ex.code;
    els.insight.textContent = ex.insight;
  }
  renderLineNumbers();
});
els.libraryTab.addEventListener("click", () => setLibraryMode("concepts"));
els.myLearningTab.addEventListener("click", () => setLibraryMode("my-learning"));
els.newExample.addEventListener("click", startOwnExample);
els.saveExample.addEventListener("click", saveCurrentExample);
els.next.addEventListener("click", nextStep);
els.prev.addEventListener("click", prevStep);
els.auto.addEventListener("click", toggleAuto);
els.aiExplain.addEventListener("click", () => explainWithAi());
els.aiQuestionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = els.aiQuestionInput.value.trim();
  if (!question) return;
  els.aiQuestionInput.value = "";
  explainWithAi(question);
});
window.addEventListener("pystep:auth-changed", handleAuthChanged);

clearLegacyMyLearningCache();
renderExamples();
loadExample("concepts", 0);
updateAccountGatedControls();
els.run.disabled = true;
initPython();
