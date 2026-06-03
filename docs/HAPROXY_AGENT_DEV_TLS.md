# HAProxy TLS for `agent-dev` (your `haproxy.cfg`)

Your VPS uses:

```text
frontend https_front
    bind *:443 ssl crt /etc/haproxy/certs/vivancetravels.pem
    default_backend kong_backend
```

HAProxy **decrypts** HTTPS, then sends plain HTTP to Kong (`kong_backend`). The browser cert is chosen from **`vivancetravels.pem`**, not from Kubernetes. That is why `openssl` on the public IP showed `CN = dev.vivancetravels.com` even though the cluster secret is correct.

---

## Fix A (recommended): add `agent-dev` cert to HAProxy

Keeps your current design (terminate at HAProxy → Kong :80). HAProxy picks the cert by **SNI** when multiple `.pem` files are in one directory.

### 1) Export cert from the cluster

```bash
kubectl get secret agent-dev-vivancetravels-tls -n default \
  -o go-template='{{index .data "tls.crt"}}' | base64 -d | sudo tee /etc/haproxy/certs/agent-dev.vivancetravels.com.crt >/dev/null

kubectl get secret agent-dev-vivancetravels-tls -n default \
  -o go-template='{{index .data "tls.key"}}' | base64 -d | sudo tee /etc/haproxy/certs/agent-dev.vivancetravels.com.key >/dev/null

sudo bash -c 'cat /etc/haproxy/certs/agent-dev.vivancetravels.com.crt /etc/haproxy/certs/agent-dev.vivancetravels.com.key > /etc/haproxy/certs/agent-dev.vivancetravels.com.pem'
sudo chmod 600 /etc/haproxy/certs/agent-dev.vivancetravels.com.pem

# Directory bind loads every file — remove loose .crt/.key or HAProxy looks for *.crt.key:
sudo rm -f /etc/haproxy/certs/agent-dev.vivancetravels.com.crt /etc/haproxy/certs/agent-dev.vivancetravels.com.key
# Keep only combined .pem files in /etc/haproxy/certs/ (e.g. vivancetravels.pem, agent-dev.vivancetravels.com.pem)
```

### 2) Use a cert **directory** on the frontend bind

Edit `/etc/haproxy/haproxy.cfg` line ~15:

```haproxy
# was:
# bind *:443 ssl crt /etc/haproxy/certs/vivancetravels.pem

# use:
bind *:443 ssl crt /etc/haproxy/certs/ alpn h2,http/1.1
```

Ensure `/etc/haproxy/certs/` contains:

- `vivancetravels.pem` (for `next` / `dev` — whatever SANs it already has)
- `agent-dev.vivancetravels.com.pem` (new)

### 3) Reload

```bash
sudo haproxy -c -f /etc/haproxy/haproxy.cfg
sudo systemctl reload haproxy
```

### 4) Verify

```bash
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
```

Expected: `subject=CN = agent-dev.vivancetravels.com`

### `openssl` OK but Chrome still says "Not secure"

**1) You opened HTTP, not HTTPS**  
Address bar shows `agent-dev.vivancetravels.com` with no `https://` → Chrome labels plain HTTP as "Not secure".  
Open explicitly: `https://agent-dev.vivancetravels.com/`

**2) Force HTTP → HTTPS on port 80** (in `frontend http_front`):

```haproxy
redirect scheme https code 301 if !{ ssl_fc }
```

**3) Incomplete certificate chain** — rebuild PEM with full chain from the secret:

```bash
kubectl get secret agent-dev-vivancetravels-tls -n default -o go-template='{{index .data "tls.crt"}}' | base64 -d | sudo tee /tmp/agent-dev.crt >/dev/null
kubectl get secret agent-dev-vivancetravels-tls -n default -o go-template='{{index .data "tls.key"}}' | base64 -d | sudo tee /tmp/agent-dev.key >/dev/null
sudo bash -c 'cat /tmp/agent-dev.crt /tmp/agent-dev.key > /etc/haproxy/certs/agent-dev.vivancetravels.com.pem'
sudo chmod 600 /etc/haproxy/certs/agent-dev.vivancetravels.com.pem
sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl reload haproxy
```

Check chain depth:

```bash
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com -showcerts </dev/null 2>/dev/null | grep -c "BEGIN CERTIFICATE"
# expect at least 2 (leaf + issuer)
```

**4) Browser cache** — incognito or clear site data for `agent-dev.vivancetravels.com`.

**5) Verify trust:**

```bash
curl -vI "https://agent-dev.vivancetravels.com/" 2>&1 | grep -E 'SSL|subject|expire|HTTP/'
```

---

## Fix B (Option B): TCP passthrough to Kong :443 only for `agent-dev`

Kong terminates TLS (`127.0.0.1:32732`). Other hostnames keep terminate-at-HAProxy on an internal port.

Replace `frontend https_front` / add backends like this (adjust names to match your file):

```haproxy
frontend https_front
    bind *:443
    mode tcp
    tcp-request inspect-delay 5s
    tcp-request content accept if { req.ssl_hello_type 1 }

    acl sni_agent_dev req.ssl_sni -i agent-dev.vivancetravels.com
    use_backend kong_tls_passthrough if sni_agent_dev
    default_backend haproxy_ssl_loopback

backend kong_tls_passthrough
    mode tcp
    server kong 127.0.0.1:32732 check

backend haproxy_ssl_loopback
    mode tcp
    server ssl_term 127.0.0.1:8443

frontend https_internal
    bind 127.0.0.1:8443 ssl crt /etc/haproxy/certs/vivancetravels.pem alpn h2,http/1.1
    mode http
    default_backend kong_backend

backend kong_backend
    # keep your existing server line (e.g. 127.0.0.1:31081)
```

Only use Fix B if you do **not** want agent-dev certs on HAProxy. Fix A is simpler for your current setup.

---

## Check `kong_backend` port

```bash
sudo sed -n '/backend kong_backend/,/^backend/p' /etc/haproxy/haproxy.cfg
```

Should point at Kong HTTP NodePort (often `127.0.0.1:31081` for `kong-kong-proxy` port 80).
