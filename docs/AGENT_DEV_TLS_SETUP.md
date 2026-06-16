# TLS for `agent-dev.vivancetravels.com` (cert-manager)

`https://next.vivancetravels.com/` already has a certificate. Repeat the same pattern for **`agent-dev.vivancetravels.com`**.

Agent login URL (no `/agent` path): **`https://agent-dev.vivancetravels.com/`**

---

## Step 0 — Discover how `next` TLS is done today

On the VPS:

```bash
# ClusterIssuers
kubectl get clusterissuer

# Existing certificates (find next.vivancetravels.com)
kubectl get certificate -A
kubectl get certificate -A -o wide | grep -i vivance

# TLS secrets
kubectl get secret -A | grep -i tls

# Ingress TLS on main site
kubectl get ingress nextjs-ingress -o yaml | grep -A20 tls
kubectl get ingress nextjs-ingress -o yaml | grep cert-manager
```

Note the **ClusterIssuer name** (often `letsencrypt-prod`) and whether you use a **Certificate** CR or only Ingress annotations.

---

## Step 1 — DNS (you already did this)

| Type | Name | Value |
|------|------|--------|
| A | `agent-dev` | `77.37.45.41` (same IP as `next` if same Kong entry) |

Check propagation:

```bash
dig +short agent-dev.vivancetravels.com
# should return 77.37.45.41
```

---

## Step 2 — HTTP Ingress must work before HTTPS

cert-manager **HTTP-01** needs port **80** reachable for `agent-dev.vivancetravels.com`.

```bash
curl -sI "http://agent-dev.vivancetravels.com/" | head -5
# expect HTTP/1.1 200 or 30x from your app/Kong — not connection refused
```

Apply routing first (no TLS block is OK for a minute):

```bash
kubectl apply -f k8s/nextjs-agent-agent-dev-ingress.example.yaml
# temporarily remove the tls: section if cert does not exist yet, apply, then add tls back
```

---

## Step 3 — Create Certificate (recommended)

Edit `k8s/agent-dev-certificate.yaml` if your issuer is **not** `letsencrypt-prod`, then:

```bash
kubectl apply -f k8s/agent-dev-certificate.yaml
```

Watch issuance (1–3 minutes):

```bash
kubectl describe certificate agent-dev-vivancetravels-com -n default
kubectl get certificaterequest,order,challenge -n default
```

Success looks like:

```text
Ready: True
```

Secret created:

```bash
kubectl get secret agent-dev-vivancetravels-tls -n default
# type kubernetes.io/tls
```

---

## Step 4 — Ingress references that secret

Full manifest: `k8s/nextjs-agent-agent-dev-ingress.example.yaml`

Important parts:

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - agent-dev.vivancetravels.com
      secretName: agent-dev-vivancetravels-tls
```

Apply:

```bash
kubectl apply -f k8s/nextjs-agent-agent-dev-ingress.example.yaml
```

---

## Step 5 — Kong must use the TLS secret

Depending on your Kong setup:

**A) Kong Ingress Controller** — usually picks up `Ingress.spec.tls` automatically after the secret exists.

**B) Kong manually terminates TLS** — you may need a Kong `Certificate` / SNI plugin pointing at the same secret. Check how `next.vivancetravels.com` is wired:

```bash
kubectl get ingress -A -o yaml | grep -B5 -A15 "next.vivancetravels.com"
```

If `nextjs-ingress` has **no** `tls:` section but HTTPS still works, TLS may terminate at **Hostinger / outer proxy** — replicate that for `agent-dev` (add host + certificate in the same panel).

---

## Step 6 — Verify HTTPS

```bash
curl -sI "https://agent-dev.vivancetravels.com/" | head -5
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null | openssl x509 -noout -subject -dates
```

Browser: `https://agent-dev.vivancetravels.com/` (gradient login).

---

## Troubleshooting

### Certificate stays `Ready: False`

```bash
kubectl describe challenge -n default
kubectl describe order -n default
```

| Error | Fix |
|--------|-----|
| `wrong status code '404'` and Challenge solver `Class: traefik` | Your ingress uses **Kong**. Patch ClusterIssuer `letsencrypt-prod` HTTP-01 solver to `class: kong`, or set Certificate annotation `cert-manager.io/acme-http01-ingress-class: kong` (see `k8s/agent-dev-certificate.yaml`) |
| 404 on `/.well-known/acme-challenge/` | Solver Ingress must use `ingressClassName: kong`; verify `kubectl get ingress cm-acme-http-solver-* -o yaml` |
| DNS wrong | Fix A record |
| Rate limit | Use staging issuer first: `letsencrypt-staging` |
| Wrong issuer name | `kubectl get clusterissuer` and fix `issuerRef.name` |

### HTTPS works on `next` but not `agent-dev`

- Compare: `kubectl get ingress -A`
- Ensure **only** `nextjs-agent-svc` backs `agent-dev` host
- Ensure Kong listener has SNI for `agent-dev.vivancetravels.com`

### Ingress references `next-vivancetravels-tls` but secret does not exist

If `kubectl get secret next-vivancetravels-tls` is **NotFound** while `nextjs-ingress` has `spec.tls.secretName: next-vivancetravels-tls`, Kong may fail SNI for **other** hosts (including agent-dev). Fix:

```bash
kubectl apply -f k8s/vivance-combined-ingress.no-next-tls.example.yaml
kubectl rollout restart deployment -n kong -l app.kubernetes.io/name=kong
```

Re-add `spec.tls` on `nextjs-ingress` only after `next-vivancetravels-tls` exists.

### next Certificate: ACME order `errored` / "No order for ID"

Transient Let's Encrypt / stale Order object. Clean and re-issue:

```bash
kubectl delete certificate next-vivancetravels-com -n default
kubectl delete certificaterequest -n default -l cert-manager.io/certificate-name=next-vivancetravels-com
kubectl delete order -n default -l acme.cert-manager.io/certificate-name=next-vivancetravels-com
kubectl delete challenge -n default -l acme.cert-manager.io/certificate-name=next-vivancetravels-com
kubectl apply -f k8s/next-vivancetravels-certificate.yaml
kubectl describe certificate next-vivancetravels-com -n default
```

If `next` HTTPS already works via Hostinger, you can skip in-cluster next cert and use `vivance-combined-ingress.no-next-tls.example.yaml`.

### openssl shows `subject=CN = dev.vivancetravels.com` for agent-dev (wrong cert)

```bash
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
# BAD:  subject=CN = dev.vivancetravels.com
# GOOD: subject=CN = agent-dev.vivancetravels.com
```

Kong is serving the **old dev** Let's Encrypt cert as default/wrong SNI — not `agent-dev-vivancetravels-tls`. Fix:

```bash
# Remove legacy dev ingress (still on cluster from earlier kubectl get ingress)
kubectl delete ingress vivance-ingress agent-ingress -n default

# List anything else on dev host
kubectl get ingress,certificate,secret -n default | grep -i dev

# Optional: delete unused dev cert objects (only if nothing should use dev host)
# kubectl delete certificate <dev-cert-name> -n default
# kubectl delete secret <dev-tls-secret> -n default

kubectl rollout restart deployment -n kong kong-kong
kubectl rollout status deployment -n kong kong-kong

openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
```

Also ensure `nextjs-ingress` does **not** reference missing `next-vivancetravels-tls` (use `vivance-combined-ingress.no-next-tls.example.yaml`).

### Ingress TLS correct but openssl still shows `CN = dev.vivancetravels.com`

Ingress has `spec.tls` and `PORTS 80,443`, secret exists, but public `openssl` still shows **dev** → TLS is probably **not** terminated at Kong.

**A) Confirm the Kubernetes secret is correct**

```bash
kubectl get secret agent-dev-vivancetravels-tls -n default -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -subject
# expect: subject=CN = agent-dev.vivancetravels.com
```

**B) Hit Kong inside the cluster (bypass Hostinger / outer proxy)**

```bash
kubectl get svc -n kong
# find HTTPS port on kong-kong-proxy (often 443)

kubectl port-forward -n kong svc/kong-kong-proxy 18443:443 &
sleep 2
openssl s_client -connect 127.0.0.1:18443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject
kill %1 2>/dev/null
```

| Port-forward subject | Public openssl subject | Cause |
|----------------------|------------------------|--------|
| `agent-dev.vivancetravels.com` | `dev.vivancetravels.com` | **Hostinger / panel SSL** — add `agent-dev` to SSL or use Full (strict) to Kong |
| `dev.vivancetravels.com` | `dev.vivancetravels.com` | **Kong SNI** — check KIC logs, Kong SNIs (below) |

**C) Kong SNIs (if B points to Kong)**

```bash
KONG_POD=$(kubectl get pod -n kong -l app.kubernetes.io/name=kong -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n kong "$KONG_POD" -c proxy -- wget -qO- http://127.0.0.1:8001/snis 2>/dev/null | head -c 2000
```

**D) Hostinger (most common when `next` HTTPS works, `agent-dev` does not)**

In hPanel → Domains → SSL: ensure **`agent-dev.vivancetravels.com`** is covered (or use a cert that includes it), not only `next` or `dev`. Or point subdomain DNS directly to Kong with **no** panel HTTPS in front.

Compare DNS:

```bash
dig +short next.vivancetravels.com
dig +short agent-dev.vivancetravels.com
```

### Certificate `Ready: True` but browser shows "Not secure"

cert-manager only proves the **Secret** exists in Kubernetes. The browser needs the **same certificate** on whatever terminates **port 443** for `agent-dev.vivancetravels.com`.

**1) Compare cert in Secret vs cert on the public internet**

```bash
# In-cluster (should mention agent-dev.vivancetravels.com)
kubectl get secret agent-dev-vivancetravels-tls -n default
kubectl get secret agent-dev-vivancetravels-tls -n default -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -subject -issuer -dates

# What clients actually receive on :443
openssl s_client -connect agent-dev.vivancetravels.com:443 -servername agent-dev.vivancetravels.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

If the two **subject** lines differ, Kong (or an outer proxy) is **not** using `agent-dev-vivancetravels-tls`.

**2) Confirm Ingress TLS references that secret**

```bash
kubectl get ingress nextjs-agent-dev-ingress -n default -o yaml | grep -A6 '^  tls:'
# secretName must be: agent-dev-vivancetravels-tls
# host must be: agent-dev.vivancetravels.com
```

**3) Kong Ingress Controller**

```bash
kubectl get ingressclass
kubectl get ingress -n default nextjs-agent-dev-ingress -o wide
# If Kong CRDs exist:
kubectl get kongcertificate -A 2>/dev/null || true
```

After the Secret exists, re-apply ingress so KIC re-syncs TLS:

```bash
kubectl apply -f nextjs-agent-dev-ingress.yaml
kubectl rollout restart deployment -n kong -l app=ingress-kong 2>/dev/null || \
  kubectl rollout restart deployment -n kong kong-kong 2>/dev/null || true
```

**4) Outer proxy (Hostinger / panel SSL)**

If `https://next.vivancetravels.com/` is valid but `agent-dev` is not, TLS may terminate **outside** the cluster. Add **`agent-dev.vivancetravels.com`** to the same SSL certificate / auto-SSL list in the hosting panel, or terminate only at Kong (DNS → Kong LB :443, not a proxy without the subdomain cert).

**5) Do not confuse with `agent.vivancetravels.com`**

A pending challenge for `agent.vivancetravels.com` (`agent-portal-tls`) is unrelated to `agent-dev`. Fix or delete that separate Certificate if it is stuck.

**6) Optional: remove duplicate cert-manager on Ingress**

If you use a standalone `Certificate` CR (`agent-dev-certificate.yaml`), you can remove `cert-manager.io/cluster-issuer` from the Ingress metadata to avoid ingress-shim fighting the same `secretName` (usually harmless, but keeps one issuance path).

### You use only Ingress annotation (no Certificate CR)

Alternative — annotation-only (ingress-shim creates Certificate automatically):

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - agent-dev.vivancetravels.com
      secretName: agent-dev-vivancetravels-tls
```

Do **not** apply both a manual `Certificate` with the same `secretName` and ingress-shim unless you know they won't conflict; prefer **one** method.

---

## Optional: redirect HTTP → HTTPS

On Kong, enable SSL redirect in annotations (match your `next` ingress policy) once the cert is `Ready`.

---

## URLs after success

| | URL |
|--|-----|
| Login | `https://agent-dev.vivancetravels.com/` |
| Signup | `https://agent-dev.vivancetravels.com/signup` |
| B2C | `https://next.vivancetravels.com/` |

Do **not** use `https://agent-dev.vivancetravels.com/agent` — that path redirects to `/` on the agent host.
