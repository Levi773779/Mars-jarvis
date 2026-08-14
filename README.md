# MARS JARVIS — Phase 1: Foundation

A browser-based personal AI operating system, inspired by Tony Stark's Jarvis.
Phase 1 is pure HTML/CSS/vanilla JS — **no backend, no database, no framework**.
All persistent data lives in a single `jarvis-data.json` file in *your own* Google Drive.

## What's in Phase 1

- **Dashboard UI** — dark glassmorphism, animated HUD "reactor" core, sidebar nav, fully responsive.
- **Sections** — Home, Memory, Tasks, Voice Console, Settings.
- **Voice assistant** — Web Speech API: wake word ("jarvis"), continuous listening, push-to-talk, mute, spoken responses, command history.
- **Google Sign-In + Drive** — connect your account, authorize Drive access.
- **Memory system** — `jarvis-data.json` on Drive: `notes`, `tasks`, `research`, `settings`, `conversations`. Save / load / edit / delete.
- **Notes** — create, edit, delete, search. Try saying: *"Jarvis, note blockchain idea"* → *"I have saved your note."*
- **Tasks** — add, complete, delete, priority (low/medium/high).

## One-time setup (required — Google won't let a static page use your Drive without this)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Enable the **Google Drive API** (APIs & Services → Library).
3. Configure the **OAuth consent screen** (External is fine for personal use; add yourself as a test user).
4. Create credentials:
   - **OAuth 2.0 Client ID** (Application type: Web application). Add the URL you'll serve this app from (e.g. `http://localhost:5500` or your GitHub Pages URL) under **Authorized JavaScript origins**.
   - **API key** (APIs & Services → Credentials → Create Credentials → API key).
5. Open Mars Jarvis → **Settings** → paste the Client ID and API Key → **Save Credentials**.
6. Click **Connect Google Drive** and approve access.

Mars Jarvis requests only the `drive.file` scope — it can only see/create files it made itself, never your whole Drive.

## Running it

This is fully static. Serve the folder with any static server (it must be `http://` or `https://`, not `file://`, for Google Sign-In to work):

```bash
npx serve .
# or
python3 -m http.server 5500
```

Then open the served URL and add that exact origin to your OAuth Client ID's Authorized JavaScript origins.

## File structure

```
mars-jarvis/
├── index.html
├── style.css
├── README.md
└── js/
    ├── config.js     # credential storage (localStorage only)
    ├── auth.js       # Google Identity Services sign-in + token
    ├── drive.js       # find/create/read/write jarvis-data.json
    ├── memory.js      # notes/tasks/conversations CRUD, persists to Drive
    ├── voice.js       # Web Speech API: recognition + synthesis
    ├── commands.js    # transcript → action + spoken reply
    ├── ui.js          # DOM rendering, no business logic
    └── app.js         # wires everything together
```

## Voice commands (Phase 1)

| Say | Effect |
|---|---|
| "jarvis note **X**" / "jarvis save note **X**" / "jarvis remember **X**" | Saves a note, replies "I have saved your note." |
| "jarvis show notes" | Reads back how many notes you have + the most recent |
| "jarvis search notes **X**" | Searches notes for X |
| "jarvis delete note **X**" | Deletes the closest-matching note |
| "jarvis add task **X** priority **high/medium/low**" | Adds a task |
| "jarvis complete task **X**" | Marks the closest-matching task done |
| "jarvis delete task **X**" | Deletes the closest-matching task |
| "jarvis show tasks" | Reads back open task count |
| "jarvis help" | Lists what Jarvis can do |

## Roadmap (future phases, not built yet)

- Phase 2: Research module (web lookups, summarization)
- Phase 3: Smarter NLU / LLM-backed command understanding
- Phase 4: Automations, reminders, calendar integration
- Phase 5: Multi-modal HUD (camera, ambient sensors)

This README will be extended as later phases land.
