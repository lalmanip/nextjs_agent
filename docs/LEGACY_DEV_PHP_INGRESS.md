# Legacy `dev.vivancetravels.com` / `php-app-service` ingress

## What it was

`vivance-ingress` with host **`dev.vivancetravels.com`** was the **old PHP** staging site:

| Piece | Role |
|--------|------|
| `dev.vivancetravels.com` | Dev hostname (not used after Next.js migration) |
| `php-app-service` | PHP app pods |
| `konghq.com/upstream-host: dev.vivancetravels.com` | Told Kong to send that `Host` header to PHP |
| `konghq.com/proxy-redirect-from/to` | PHP URL rewrites |

That ingress has **nothing to do** with issuing TLS for `agent-dev.vivancetravels.com`. cert-manager only needs HTTP-01 reachable on the host named in the **Certificate** CR (`agent-dev.vivancetravels.com`).

## What you use now

| Host | App | Kubernetes service (typical) |
|------|-----|------------------------------|
| `next.vivancetravels.com` | B2C Next.js | `nextjs` / `nextjs-svc` |
| `agent-dev.vivancetravels.com` | Agent login & signup | `nextjs-agent-svc` |

Backend paths on **`next`** (not PHP) stay on the same ingress:

- `/vivapi-user` → `vivance-user-api-service`
- `/vivapi-mt` → `vivance-api-service`
- `/hdfc-pgw/api` → `hdfc-payment-service`

Do **not** route `/agent` on `next` to PHP; agent UI lives on **`agent-dev`** only.

## Cleanup on the VPS (when ready)

Example cluster inventory:

| Ingress | Host | Action |
|---------|------|--------|
| `nextjs-ingress` | `next.vivancetravels.com` | **Keep** — point `/` to `nextjs-svc:80`, add `tls` if PORTS shows only `80` |
| `nextjs-agent-dev-ingress` | `agent-dev.vivancetravels.com` | **Keep** — `nextjs-agent-svc:80` |
| `vivance-ingress` | `dev.vivancetravels.com` | **Delete** — PHP (`php-app-service`) |
| `agent-ingress` | `dev.vivancetravels.com` | **Delete** — duplicate dev host |
| `agent-portal-ingress` | `agent.vivancetravels.com` | **Delete** if unused — cert often stuck; use `agent-dev` |

```bash
kubectl get ingress -A -o wide
kubectl get secret -n default | grep -i tls

# After next + agent-dev work:
kubectl delete ingress vivance-ingress agent-ingress agent-portal-ingress
kubectl delete ingress cm-acme-http-solver-sg2vz 2>/dev/null   # leftover ACME solver
# Optional: kubectl delete certificate agent-portal-tls -n default
```

## Replacement manifest

Use **`k8s/vivance-combined-ingress.example.yaml`** (Next.js + agent-dev, no `dev` host).

Confirm service names before apply:

```bash
kubectl get svc -n default | grep -E 'nextjs|vivance|hdfc'
```
