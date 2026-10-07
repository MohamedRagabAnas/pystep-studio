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
- Optional learner accounts with Supabase Auth
- Optional cloud database for each learner's My learning examples
- Responsive dark professional UI

## Free deployment: GitHub Pages

GitHub Pages is the recommended free deployment for students. It hosts the app as a static site, so the Python visualizer, examples library, My learning, tracing, output, and local explanations all work without a backend or paid service.

The AI tutor is disabled automatically on GitHub Pages unless `ai-config.js` points to a backend proxy. For a free setup, deploy `cloudflare-worker.js` as a Cloudflare Worker and store your AI key as a Worker secret.

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

## Optional free AI for GitHub Pages

GitHub Pages cannot hide API keys because it only serves static files. To enable AI without exposing your key, use the included Cloudflare Worker proxy.

Cloudflare Workers has a free plan with a daily request allowance, so it is a practical free backend for a classroom trial.

### Deploy the Worker

1. Create a free Cloudflare account.
2. Go to **Workers & Pages -> Create Worker**.
3. Paste the contents of `cloudflare-worker.js`.
4. Add these Worker variables/secrets:

```text
AI_API_KEY=your_provider_key
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://openrouter.ai/api/v1/chat/completions
AI_MODEL=openrouter/free
AI_APP_URL=https://mohamedragabanas.github.io/pystep-studio/
AI_APP_TITLE=PyStep Studio
ALLOWED_ORIGIN=https://mohamedragabanas.github.io
```

For Gemini, use:

```text
AI_PROVIDER=gemini
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models
AI_MODEL=gemini-2.0-flash
```

5. Deploy the Worker and copy its URL.
6. Edit `ai-config.js`:

```js
window.PYSTEP_AI_API_URL = "https://YOUR_WORKER_NAME.YOUR_SUBDOMAIN.workers.dev/api/explain";
```

7. Commit and push `ai-config.js` to GitHub. GitHub Pages will then use the Worker for AI explanations.

## Optional learner accounts and database

Use Supabase for free-tier learner accounts and a small Postgres database. The app supports email/password, Google, and GitHub sign-in when Supabase is configured. Without Supabase, the app still works and stores My learning examples in the browser.

### Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `database/schema.sql`.
3. Open **Authentication -> Providers**.
4. Enable **Email**.
5. Enable **Google** and **GitHub** if you want social sign-in, then add each provider's client ID/secret inside Supabase.
6. Open **Authentication -> URL Configuration** and add your GitHub Pages URL as the site URL and redirect URL:

```text
https://mohamedragabanas.github.io/pystep-studio/
```

7. Copy the project URL and anon public key into `supabase-config.js`:

```js
window.PYSTEP_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
window.PYSTEP_SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
```

The anon key is safe to publish in a frontend app when Row Level Security is enabled. Do not put provider secrets or service-role keys in this file.

## Notes

The app records Python execution using `sys.settrace` and creates snapshots after executed lines. It is intended for beginner-level examples and classroom demonstrations.

The current version intentionally avoids `input()` because browser-based interactive stdin needs a dedicated UI workflow. This can be added next.
