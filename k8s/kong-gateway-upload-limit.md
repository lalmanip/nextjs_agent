# Agent signup document uploads — HTTP 413 troubleshooting
#
# Upload path: browser → nextjs-agent `/api/agent/documents/upload` → vivance-user-api
#   `/vivapi-user/user/agent/documents/upload`
#
# If port-forward to nextjs-agent (bypassing Kong) still returns 413, the limit is NOT Kong-only.
# Check vivance-user-api multipart/Tomcat limits and redeploy user-api + nextjs-agent.
#
# ── Kong (public URL only) ──
# KIC does NOT support per-Ingress client_max_body_size annotations.
# Set the limit on the kong-gateway Deployment (namespace kong):
#
#   kubectl set env deployment/kong-gateway -n kong KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=10m
#   kubectl rollout status deployment/kong-gateway -n kong
#
# Verify:
#   kubectl get deployment kong-gateway -n kong \
#     -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.value}{"\n"}{end}' \
#     | grep -i client_max
#
# Also check no global plugin caps size below 10m:
#   kubectl get kongplugin,kongclusterplugin -A
#
# ── Diagnose where 413 originates ──
#
# 1) Confirm nextjs-agent calls user-api in-cluster (not via public Kong):
#   kubectl exec -n vivancetravels deploy/nextjs-agent -- printenv USER_API_BASE_URL
#   # Expected: http://vivance-user-api-service:8082/vivapi-user
#
# 2) Bypass Kong — direct to nextjs-agent (use POST with -F, not -I):
#   dd if=/dev/zero of=/tmp/test2mb.bin bs=1M count=2 2>/dev/null
#   kubectl port-forward -n vivancetravels svc/nextjs-agent-svc 13005:80
#   curl -s -w "\nHTTP:%{http_code}\n" -X POST \
#     "http://127.0.0.1:13005/api/agent/documents/upload" \
#     -F "userId=1" -F "documentType=ID_PROOF" -F "file=@/tmp/test2mb.bin"
#
# 3) Bypass nextjs — direct to user-api (isolates Spring/Tomcat limits):
#   kubectl port-forward -n vivancetravels svc/vivance-user-api-service 18082:8082
#   curl -s -w "\nHTTP:%{http_code}\n" -X POST \
#     "http://127.0.0.1:18082/vivapi-user/user/agent/documents/upload" \
#     -F "userId=1" -F "documentType=ID_PROOF" -F "file=@/tmp/test2mb.bin"
#
# If (3) returns 413 → redeploy vivance-user-api with updated application.yml
# (spring.servlet.multipart + server.tomcat.max-http-form-post-size).
# If (3) succeeds but (2) fails → redeploy nextjs-agent (middleware/body-size fix).
# If only public URL fails → apply Kong env above and restart kong-gateway.
