# Kubernetes deployment (Docker Desktop)

These manifests deploy the five Node.js services and one single-node Kafka broker
into the `microservices` namespace. Neon PostgreSQL and S3-compatible storage
remain external.

## Important before deploying

1. The previously shared credentials must be rotated. Do not reuse them.
2. The deployments use a locally built `v3` image with `IfNotPresent`, for the
   Docker Desktop Kubernetes cluster.
3. These images were built with the current development Dockerfile and run the
   `dev:*` scripts. This is suitable for local learning, not production.
4. Verify each app listens on `0.0.0.0` rather than only `127.0.0.1`.
5. The TCP probes only verify that a port accepts connections, not that its
   dependencies are healthy.

## Create the Kubernetes Secret

From the repository root in PowerShell:

```powershell
Copy-Item .\k8s\secrets.env.example .\k8s\secrets.env
notepad .\k8s\secrets.env
```

Fill in the new/rotated credentials. Then create the Secret:

```powershell
kubectl create secret generic microservices-secrets `
  --from-env-file=.\k8s\secrets.env `
  --namespace=microservices
```

If you need to recreate it after changing values:

```powershell
kubectl delete secret microservices-secrets -n microservices
kubectl create secret generic microservices-secrets `
  --from-env-file=.\k8s\secrets.env `
  --namespace=microservices
```

Keep `k8s/secrets.env` out of Git. Add this line to the repository `.gitignore`:

```gitignore
k8s/secrets.env
```

## Deploy

Run these commands from the repository root:

```powershell
docker build -t gauravsarang/nodejs-microservices:v3 .
kubectl apply -f .\k8s\00-config.yaml
kubectl apply -f .\k8s\01-kafka.yaml
kubectl apply -f .\k8s\02-app-services.yaml
```

The Docker build excludes `k8s/secrets.env`. Do not push old images that may
contain that file to a registry; remove any such published image and rotate its
credentials.

Kafka starts separately; wait for it before checking app logs:

```powershell
kubectl rollout status statefulset/kafka -n microservices --timeout=180s
kubectl get pods -n microservices -w
```

In another terminal, inspect deployments:

```powershell
kubectl get deployments -n microservices
kubectl get services -n microservices
kubectl get pods -n microservices -o wide
```

## Access the API Gateway locally

```powershell
kubectl port-forward service/api-gateway 3000:3000 -n microservices
```

Keep that terminal open, then access `http://localhost:3000`.

## Troubleshooting

```powershell
kubectl get pods -n microservices
kubectl get events -n microservices --sort-by='.lastTimestamp'
kubectl describe pod <pod-name> -n microservices
kubectl logs deployment/api-gateway -n microservices
kubectl logs statefulset/kafka -n microservices
```

If a pod reports `CreateContainerConfigError`, verify the Secret exists:

```powershell
kubectl get secret microservices-secrets -n microservices
```

If Kafka is not Ready, inspect its logs and PVC:

```powershell
kubectl describe pod kafka-0 -n microservices
kubectl get pvc -n microservices
kubectl logs kafka-0 -n microservices
```

## PostgreSQL connectivity and dual-stack DNS

Neon resolves over both IPv4 and IPv6. Some local Kubernetes environments using Docker Desktop or similar CNI layers can fail when Node attempts the IPv6 route first, which shows up as PostgreSQL `ETIMEDOUT` errors from the app pod even though the external database is reachable from the host.

The shared PostgreSQL pool sets IPv4-first DNS ordering and disables Node's
automatic address-family selection immediately before creating a pool. This
avoids the IPv6-only failure mode in local Kubernetes clusters while keeping
the behavior centralized for every service using PostgreSQL. These are
process-wide Node networking defaults in those database-using services; the API
gateway does not initialize the pool. The pool also keeps its timeouts explicit
and enforces TLS verification for non-local database hosts.

## Internal DNS

All app services are `ClusterIP` services and communicate through Kubernetes DNS:

- `http://api-gateway:3000`
- `http://auth-service:3001`
- `http://task-service:3002`
- `http://media-service:3003`
- `http://workflow-service:3004`
- Kafka: `kafka:9092`

Do not use `localhost` for service-to-service calls inside different pods.

## Cleanup

```powershell
kubectl delete -f .\k8s\02-app-services.yaml
kubectl delete -f .\k8s\01-kafka.yaml
kubectl delete -f .\k8s\00-config.yaml
```

PVC data is retained when the StatefulSet is deleted. Delete PVCs explicitly only
if you intentionally want to remove Kafka's persisted local data.
