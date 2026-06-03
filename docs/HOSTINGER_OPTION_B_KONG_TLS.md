# Option B: Kong terminates HTTPS for `agent-dev` (same IP as `next`)

DNS already points to one VPS IP (`77.37.45.41`). Option B does **not** require a different A record. It requires **port 443 on that server** to present Kong’s certificate via **SNI**, not Hostinger’s old **`dev`** certificate.

You verified Kong is correct internally:

```bash
# Secret + direct Kong proxy → subject=CN = agent-dev.vivancetravels.com
```

Public `openssl` still showed `dev` → something **in front of Kong** on `77.37.45.41:443` is terminating TLS with the wrong cert.

---

## Step 1 — See what owns public port 443

SSH to the VPS:

```bash
sudo ss -tlnp | grep ':443'
```

| What listens on 0.0.0.0:443 | Action |
|-----------------------------|--------|
| **kong** / **docker-proxy** / NodePort backend | Good — fix SNI/default cert at Kong (Step 3) |
| **haproxy** (your VPS) | SNI TCP passthrough → `127.0.0.1:32732` (Step 2b) |
| **nginx**, **openlitespeed**, **apache**, **caddy** (Hostinger stack) | Passthrough or stop SSL on host (Step 2a) |
| Nothing | Open 443 to Kong NodePort (Step 4) |

Kong Service (from your cluster):

```text
kong-kong-proxy   NodePort   443:32732/TCP
```

So Kong HTTPS is on host port **32732** unless something maps **443 → 32732**.

---

## Step 2 — TLS passthrough on the host (recommended if nginx/OLS fronts the VPS)

Do **not** terminate HTTPS for `agent-dev` on the host. Forward **encrypted** traffic to Kong.

### nginx (stream)

Create e.g. `/etc/nginx/stream.d/kong-passthrough.conf`:

```nginx
stream {
    map $ssl_preread_server_name $upstream {
        default kong_tls;
    }

    upstream kong_tls {
        server 127.0.0.1:32732;
    }

    server {
        listen 443;
        proxy_pass kong_tls;
        ssl_preread on;
        proxy_connect_timeout 10s;
    }
}
```

Include it from `nginx.conf`, test, reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Remove or disable any **http {}** `server { listen 443 ssl; server_name agent-dev... }` blocks that use the **dev** certificate.

### OpenLiteSpeed (Hostinger)

Use a **stream proxy** / SSL passthrough template to `127.0.0.1:32732`, or disable the `agent-dev` / catch-all vhost SSL on the panel so that hostname is not bound to the **dev** cert.

### HAProxy (your server: `haproxy` on `0.0.0.0:443`)

HAProxy is terminating TLS today (likely with the **dev** cert as default). For Option B, send **only** `agent-dev` (or all hosts) to Kong **without** decrypting on HAProxy.

**1) Backup and inspect**

```bash
sudo cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.bak.$(date +%F)
sudo grep -nE 'frontend|backend|bind.*443|ssl|sni' /etc/haproxy/haproxy.cfg
```

**2) Add TCP frontend + backend** (Kong NodePort `32732`):

```haproxy
# --- Kong TLS passthrough (agent-dev) — add near top of cfg, adjust names if they clash ---
frontend fe_kong_agent_dev_tls
    bind *:443
    mode tcp
    tcp-request inspect-delay 5s
    tcp-request content accept if { req.ssl_hello_type 1 }

    acl sni_agent_dev req.ssl_sni -i agent-dev.vivancetravels.com
    use_backend be_kong_tls if sni_agent_dev

    # IMPORTANT: keep your existing default for next / dev / other SNIs:
    default_backend be_https_existing

backend be_kong_tls
    mode tcp
    server kong 127.0.0.1:32732 check

# Rename be_https_existing to whatever your current :443 backend is called,
# or replace default_backend with your current ssl_frontend's use_backend chain.
```

If your current config uses one `frontend` that already `bind *:443` with `ssl crt`, you must **merge** SNIs:

- Either move **agent-dev** to `use_backend be_kong_tls` **before** the `ssl crt` HTTP frontend (split into TCP frontend first), or  
- Replace that frontend with **full TCP passthrough** to Kong for **all** hostnames (then Kong must present certs for `next` too).

**Minimal change (agent-dev only):** put this **before** the existing SSL-terminating frontend and use a single shared `bind *:443` only once — HAProxy allows one bind per IP:port per process, so you typically **replace** the existing `frontend ... bind *:443` with the TCP `inspect` frontend above and route non–agent-dev SNIs to a **new** backend that mirrors your old HTTPS target (often another local port or the old `mode http` backend on 127.0.0.1:80).

**3) Validate and reload**

```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
sudo systemctl reload haproxy
```

**4) Verify**

```bash
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
```

**Full passthrough (all SNIs to Kong)** — use when ready to let Kong handle every hostname:

```haproxy
frontend fe_all_tls_passthrough
    bind *:443
    mode tcp
    default_backend be_kong_tls

backend be_kong_tls
    mode tcp
    server kong 127.0.0.1:32732 check
```

Then ensure Kong Ingress has `spec.tls` for each public host (`next`, `agent-dev`, …).

---

## Step 3 — Kong / Ingress (already done)

Keep:

- Certificate `agent-dev-vivancetravels-com` → Secret `agent-dev-vivancetravels-tls`
- Ingress `nextjs-agent-dev-ingress` with:

```yaml
spec:
  tls:
    - hosts:
        - agent-dev.vivancetravels.com
      secretName: agent-dev-vivancetravels-tls
```

```bash
kubectl apply -f nextjs-ingress.yaml
kubectl rollout restart deployment -n kong kong-kong
```

---

## Step 4 — If nothing listens on 443: publish Kong 443 on the host

Pick one:

**A) kubectl patch Service to LoadBalancer** (if your VPS supports it):

```bash
kubectl patch svc -n kong kong-kong-proxy -p '{"spec":{"type":"LoadBalancer"}}'
```

**B) iptables DNAT 443 → 32732** (common on single-node K3s):

```bash
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 32732
# persist per your OS (iptables-save / ufw / firewalld)
```

**C) Helm values** `proxy.hostPort: true` on Kong chart (requires chart upgrade).

---

## Step 5 — Hostinger hPanel (same IP, no new DNS)

1. **Domains → DNS** — leave A records as they are (`77.37.45.41`).
2. **Websites / SSL** — for `agent-dev.vivancetravels.com`:
   - Do **not** attach the old **dev** SSL site, or  
   - Remove `agent-dev` from a site that uses the **dev** certificate, or  
   - Use **DNS only** / no separate “website” SSL for `agent-dev` if the panel offers it.
3. Goal: panel must **not** serve `CN=dev.vivancetravels.com` on 443 for SNI `agent-dev.vivancetravels.com`.

`next.vivancetravels.com` can keep panel SSL if you use **passthrough** (Step 2) for all names, or separate vhosts — passthrough is simplest: one entry point, Kong picks cert per SNI.

---

## Step 6 — Verify (public)

```bash
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject

openssl s_client -connect next.vivancetravels.com:443 -servername next.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
```

Expected for agent-dev:

```text
subject=CN = agent-dev.vivancetravels.com
```

Browser: `https://agent-dev.vivancetravels.com/` — padlock, no strike-through on `https`.

---

## Firewall

```bash
sudo ufw status | grep 443
# allow 443/tcp if needed
```

---

## Summary

| Layer | Option B |
|-------|----------|
| DNS | Unchanged (all → `77.37.45.41`) |
| Host :443 | Passthrough → `127.0.0.1:32732` (Kong), **no** dev cert on host |
| Kong | SNI + `agent-dev-vivancetravels-tls` (already working via port-forward) |
| hPanel | Stop using **dev** SSL for `agent-dev` |

Paste `sudo ss -tlnp | grep ':443'` output if you want the exact nginx/OLS vs iptables steps for your VPS.
