# PyStep Studio

A polished web-based Python execution visualizer for beginner learners.

## Features

- Real Python 3 execution in the browser using Pyodide
- Step-by-step execution trace
- Current-line highlighting
- Previous / Next / Auto execution
- Variable memory table with type and value
- Highlights new and changed variables
- Function-scope display
- Console output synchronized with each step
- Beginner-friendly explanation panel
- Built-in examples for variables, decisions, loops, lists, references, functions, and dictionaries
- Learner examples saved locally in the browser
- Responsive dark professional UI

## Free deployment: GitHub Pages

GitHub Pages is the recommended free deployment for students. It hosts the app as a static site, so the Python visualizer, examples library, My learning, tracing, output, and local explanations all work without a backend or paid service.

The AI tutor is disabled automatically on GitHub Pages because there is no secure backend for an API key.

### Deploy

1. Push this project to a GitHub repository.
2. In GitHub, open **Settings -> Pages**.
3. Under **Build and deployment**, choose **GitHub Actions**.
4. Push to the `main` branch.
5. The workflow in `.github/workflows/pages.yml` publishes the site.

Your site will be available at a URL like:

```text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
```

## Run locally without AI

Because Pyodide is loaded from a CDN, serve the folder through a local web server rather than double-clicking `index.html`.

```bash
cd pystep-studio
python3 -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/
```

## Optional local AI mode

The local Node server can enable AI explanations with an API key in `.env`. This is optional and not needed for GitHub Pages.

```bash
cd pystep-studio
cp .env.example .env
node server.js
```

Open:

```text
http://127.0.0.1:8000/
```

Example `.env`:

```bash
AI_API_KEY=your_key_here
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://openrouter.ai/api/v1/chat/completions
AI_MODEL=openrouter/free
```

## Free/Limited AI Options

- OpenRouter: use `AI_MODEL=openrouter/free` with the default `AI_BASE_URL`.
- Groq: use `AI_BASE_URL=https://api.groq.com/openai/v1/chat/completions` and a model available to your account.
- Google Gemini: use the Gemini adapter below.

### Groq `.env`

```bash
AI_API_KEY=your_groq_key
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.groq.com/openai/v1/chat/completions
AI_MODEL=openai/gpt-oss-20b
```

### Gemini `.env`

```bash
AI_API_KEY=your_gemini_key
AI_PROVIDER=gemini
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models
AI_MODEL=gemini-2.0-flash
```

Restart `node server.js` after changing `.env`.

## Notes

The app records Python execution using `sys.settrace` and creates snapshots after executed lines. It is intended for beginner-level examples and classroom demonstrations.

The current version intentionally avoids `input()` because browser-based interactive stdin needs a dedicated UI workflow. This can be added next.
