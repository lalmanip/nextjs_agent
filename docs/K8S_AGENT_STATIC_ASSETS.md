# Agent login unstyled on server (Kong / dual Next.js routing)

## Symptom

- `https://next.vivancetravels.com/agent` shows plain HTML (no gradient, default button).
- Local `localhost:3005/agent` looks correct.

## Root cause (verified)

Two different Next.js pods answer the **same host**:

| Request | Pod | Build |
|---------|-----|--------|
| `/` | `nextjs` | `buildId: "development"` (dev server) |
| `/agent` | `nextjs-agent` | production (`buildId: bEUsbo2jZOp0ok3Yq5CSc`) |
| `/_next/static/css/b8b7da5099e11430.css` | `nextjs` | **404** — file exists only on `nextjs-agent` |
| `/_next/static/css/app/layout.css?v=...` | `nextjs` | **200** — dev CSS |

The browser loads HTML from `nextjs-agent` but CSS/JS from `/_next/static/...` hit `nextjs`, so styles and client bundles never load.

## Confirm on the VPS

```bash
# 1) Production asset from agent HTML -> should be 404 today
curl -sI "https://next.vivancetravels.com/_next/static/css/b8b7da5099e11430.css" | head -1

# 2) Dev asset from homepage -> 200
curl -sI "https://next.vivancetravels.com/_next/static/css/app/layout.css?v=1" | head -1

# 3) Hit the agent pod directly (bypass Kong) — should be 200 if the image is correct
kubectl port-forward deployment/nextjs-agent 13005:3005 &
sleep 2
curl -sI "http://127.0.0.1:13005/_next/static/css/b8b7da5099e11430.css" | head -1
kill %1 2>/dev/null
```

If (3) is **200** and (1) is **404**, fix **ingress/Kong**, not the Docker image.

## Fix (choose one)

### A) Single app on `next.vivancetravels.com` (recommended for agent repo)

Point **all paths** (`/`, `/agent`, `/_next`, `/api`, …) to Service `nextjs-agent` port **3005** only.

- Remove or repoint the `nextjs` upstream on this host in Kong / Ingress.
- See `k8s/nextjs-agent-ingress.example.yaml`.

After change:

```bash
kubectl rollout status deployment/nextjs-agent
curl -sI "https://next.vivancetravels.com/_next/static/css/b8b7da5099e11430.css" | head -1
# expect HTTP/1.1 200
```

### B) Dedicated host for agent app

Example: `agent-next.vivancetravels.com` → only `nextjs-agent`.

Update DNS + Kong route + tell agents to use that URL (no conflict with `nextjs`).

### C) Keep B2C on `nextjs` and agent on another host

Do **not** serve `/agent` on the same host as the dev `nextjs` pod unless `/_next` also goes to `nextjs-agent`.

## Kong checklist

- One `Service` upstream per hostname, **or**
- Path routes that still send `/_next` to the **same** deployment that rendered the page.
- Avoid: `/agent` → `nextjs-agent`, default `/` → `nextjs` (breaks static assets).

## Pods on cluster

```
nextjs-agent   # this repo (CI: vivance/nextjs-agent-app)
nextjs         # separate B2C/dev deployment — must not own /_next for agent HTML
agent-portal   # legacy app on agent.vivancetravels.com
```
