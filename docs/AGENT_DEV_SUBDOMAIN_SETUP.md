# `agent-dev.vivancetravels.com` — agent portal (no `/agent` in URL)

## Architecture

| Host | Deployment | Purpose |
|------|------------|---------|
| `next.vivancetravels.com` | `nextjs` | B2C (flights, hotels, …) |
| `agent-dev.vivancetravels.com` | `nextjs-agent` | Agent login & signup only |

## Public URLs (after deploy)

| Action | URL |
|--------|-----|
| Login | `https://agent-dev.vivancetravels.com/` |
| Signup | `https://agent-dev.vivancetravels.com/signup` |
| B2C app (after login) | `https://next.vivancetravels.com/` |

Legacy paths on the B2C host redirect to the agent portal:

- `next.vivancetravels.com/agent` → `agent-dev.vivancetravels.com/`
- `next.vivancetravels.com/agent/signup` → `agent-dev.vivancetravels.com/signup`

## Session across subdomains

Login sets a cookie on `.vivancetravels.com` plus `localStorage`, so after sign-in on `agent-dev`, opening `next.vivancetravels.com` keeps the session.

## Environment (ConfigMap / deployment env)

Add to `nextjs-agent` container:

```yaml
NEXT_PUBLIC_AGENT_PORTAL_URL: "https://agent-dev.vivancetravels.com"
NEXT_PUBLIC_B2C_APP_URL: "https://next.vivancetravels.com"
AGENT_PORTAL_HOSTS: "agent-dev.vivancetravels.com"
```

## Kong / Ingress

One route per host — **do not** share `/_next` between `nextjs` and `nextjs-agent`.

- `agent-dev.vivancetravels.com` → Service `nextjs-agent` port `3005` (all paths)
- `next.vivancetravels.com` → Service `nextjs` (unchanged)

Example: `k8s/nextjs-agent-agent-dev-ingress.example.yaml`

## Verify

```bash
curl -sI "https://agent-dev.vivancetravels.com/" | head -3
curl -s "https://agent-dev.vivancetravels.com/" | grep -o 'agent-auth-screen' | head -1
curl -sI "https://agent-dev.vivancetravels.com/_next/static/css/$(curl -s https://agent-dev.vivancetravels.com/ | grep -o '/_next/static/css/[^\"]*' | head -1 | sed 's|^.*/_next|/_next|')" | head -1
# Last line should be HTTP/1.1 200
```

## Local dev

- `localhost:3005/agent` — still works (no middleware host match).
- To mimic prod: add `127.0.0.1 agent-dev.vivancetravels.com` to hosts file and open `http://agent-dev.vivancetravels.com:3005/`.
