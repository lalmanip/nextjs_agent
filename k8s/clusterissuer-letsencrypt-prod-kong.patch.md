# Fix letsencrypt-prod for Kong (not Traefik)

If `kubectl describe challenge` shows:

```text
Solver:
  http01:
    Ingress:
      Class: traefik
Reason: wrong status code '404', expected '200'
```

Update the ClusterIssuer once for the whole cluster:

```bash
kubectl get clusterissuer letsencrypt-prod -o yaml > letsencrypt-prod-backup.yaml
kubectl edit clusterissuer letsencrypt-prod
```

Under `spec.acme.solvers`, set HTTP-01 ingress class to **kong**:

```yaml
spec:
  acme:
    solvers:
      - http01:
          ingress:
            class: kong
```

(cert-manager v1.18+ may use `ingressClassName: kong` instead of `class: kong` — match your CRD.)

Then re-issue the certificate:

```bash
kubectl delete certificate agent-dev-vivancetravels-com -n default
kubectl delete challenge --all -n default  # optional, cert-manager recreates
kubectl apply -f agent-dev-certificate.yaml
```

Verify solver ingress uses Kong:

```bash
kubectl get ingress -n default | grep acme
kubectl get ingress cm-acme-http-solver-xxxxx -o yaml | grep -E 'ingressClassName|class'
```
