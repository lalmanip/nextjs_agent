# Setup `agent-next.vivancetravels.com`

Use this host **only** for deployment `nextjs-agent`. Keep `next.vivancetravels.com` on the `nextjs` pod if you still need B2C dev there.

## What you change (summary)

| Layer | Action |
|--------|--------|
| DNS | `agent-next.vivancetravels.com` → same public IP as Kong / ingress |
| Kong or Ingress | New route: host `agent-next.vivancetravels.com`, path `/`, upstream **only** `nextjs-agent:3005` |
| TLS | Certificate for `agent-next.vivancetravels.com` |
| App repo | **No deploy required** for routing only; optional env if you hard-code old host in secrets |
| Agents | Open `https://agent-next.vivancetravels.com/agent` (or `/` after login redirect) |

Server-side APIs already use in-cluster URLs from `nextjs-ui-env` ConfigMap (`MT_API_BASE_URL`, `USER_API_BASE_URL`, etc.). Browser calls `/api/*` on the **same** host, so they work on `agent-next` without changing `next.vivancetravels.com` API paths.

## URLs after setup

| Purpose | URL |
|---------|-----|
| Agent login | `https://agent-next.vivancetravels.com/agent` |
| Agent signup | `https://agent-next.vivancetravels.com/agent/signup` |
| B2C home (after login) | `https://agent-next.vivancetravels.com/` |

## Verify (run on VPS)

```bash
# 1. HTML from new host
curl -sI "https://agent-next.vivancetravels.com/agent" | head -5

# 2. Extract CSS href from HTML, then (must be 200, not 404):
curl -s "https://agent-next.vivancetravels.com/agent" | grep -o '/_next/static/css/[^"]*' | head -1
# curl -sI "https://agent-next.vivancetravels.com<path-from-above>"

# 3. buildId should NOT be "development"
curl -s "https://agent-next.vivancetravels.com/agent" | grep -o 'buildId":"[^"]*"' | head -1
```

## Kong (if not using nginx Ingress)

Create **one** route per host:

- **Hosts:** `agent-next.vivancetravels.com`
- **Paths:** `/` (or regex `.*`)
- **Service upstream:** `nextjs-agent` Kubernetes service, port **3005**
- **Do not** load-balance this host with the `nextjs` service

## Optional app / env tweaks

Only if something still points at the old UI host:

- `k8s/agent_secret.yaml` — `NEXT_PUBLIC_API_BASE_URL` can stay `https://next.vivancetravels.com` **only if** APIs are still published there; otherwise set to `https://agent-next.vivancetravels.com` or use relative `/api` (preferred).
- CORS on Java APIs: allow `https://agent-next.vivancetravels.com` if browsers call APIs directly (most flows use Next `/api` proxy).

## What to send for exact commands

Paste outputs of:

```bash
kubectl get svc nextjs-agent nextjs -o wide
kubectl get deploy nextjs-agent -o jsonpath='{.spec.template.spec.containers[0].ports}{"\n"}'
kubectl get ingress -A
kubectl get pods -l app=nextjs-agent -o wide 2>/dev/null || kubectl get pods | grep nextjs-agent
```

If Kong is configured outside Kubernetes, also share:

- Kong **Service** name + upstream URL for `nextjs-agent`
- Kong **Route** list for `next.vivancetravels.com` and any new route for `agent-next`

Example manifest: `k8s/nextjs-agent-agent-next-ingress.example.yaml`
