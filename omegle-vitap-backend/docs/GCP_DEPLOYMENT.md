# GCP Deployment Guide

## Prerequisites

- GCP Project with billing enabled
- `gcloud` CLI installed and authenticated
- Auth project configured
- Docker installed (for local testing)

## 1. Setup GCP Services

### Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  redis.googleapis.com \
  container.googleapis.com \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sqladmin.googleapis.com
```

### Set Environment Variables

```bash
export PROJECT_ID="omgle-vitap-prod"
export REGION="asia-south1"
export SERVICE_NAME="omegle-vitap-backend"
export REDIS_INSTANCE="omegle-redis"
export TURN_HOST="turn.example.com"

gcloud config set project $PROJECT_ID
```

## 2. Deploy Redis (Memorystore)

### Create Redis Instance

```bash
gcloud redis instances create $REDIS_INSTANCE \
  --size=5 \
  --region=$REGION \
  --tier=standard \
  --redis-version=redis_7_0 \
  --network=default \
  --connect-mode=private-service-access \
  --enable-auth \
  --display-name="Omegle VITAP Redis"
```

### Get Redis Connection Details

```bash
gcloud redis instances describe $REDIS_INSTANCE \
  --region=$REGION \
  --format="get(host,port)"
```

Save the host and port for later use.

## 3. Setup Secret Manager

### Create Secrets

```bash
# TURN host (public IP or DNS of the coturn box)
echo -n "YOUR_TURN_HOST" | \
  gcloud secrets create turn-host --data-file=-

# Coturn REST-auth secret (must match coturn --static-auth-secret)
echo -n "YOUR_TURN_AUTH_SECRET" | \
  gcloud secrets create turn-auth-secret --data-file=-

echo -n "3478" | \
  gcloud secrets create turn-port --data-file=-

# API Key
echo -n "YOUR_API_KEY" | \
  gcloud secrets create api-key --data-file=-

# Auth Service Account (from JSON file)
gcloud secrets create better-auth-secret \
  --data-file=./service-account-key.json

# Redis Host
echo -n "10.x.x.x" | \
  gcloud secrets create redis-host --data-file=-

# Redis Port
echo -n "6379" | \
  gcloud secrets create redis-port --data-file=-

# BigDataCloud API Keys (for IP geolocation)
echo -n "YOUR_API_KEY_1" | \
  gcloud secrets create bigdatacloud-api-key-1 --data-file=-
# Repeat for keys 2-5...
```

### Grant Cloud Run Access to Secrets

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding turn-auth-secret \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all secrets...
```

## 4. Deploy coturn (TURN)

Video is 1:1 P2P. Run coturn on the same nights-only VM or apply manifests in `k8s/`. `TURN_HOST` must be the public IP or DNS advertised in ICE candidates.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/loadbalancer.yaml
```

Open UDP/TCP **3478** and UDP **49160-49259**. An Elastic IP on a stopped instance still bills.

## 5. Build and Deploy Backend (Cloud Run)

### Create VPC Connector (for Redis access)

```bash
gcloud compute networks vpc-access connectors create redis-connector \
  --region=$REGION \
  --network=default \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=10
```

### Build Docker Image

```bash
cd omeagle-vitap-backend

# Build with Cloud Build
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
```

### Deploy to Cloud Run

```bash
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --region=$REGION \
  --platform managed \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080 \
  --vpc-connector redis-connector \
  --vpc-egress private-ranges-only \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --set-secrets \
TURN_HOST=turn-host:latest,\
TURN_AUTH_SECRET=turn-auth-secret:latest,\
TURN_PORT=turn-port:latest,\
API_KEY=api-key:latest,\
BETTER_AUTH_SECRET_KEY=better-auth-secret:latest,\
REDIS_HOST=redis-host:latest,\
REDIS_PORT=redis-port:latest,\
BIGDATACLOUD_API_KEY_1=bigdatacloud-api-key-1:latest,\
BIGDATACLOUD_API_KEY_2=bigdatacloud-api-key-2:latest,\
BIGDATACLOUD_API_KEY_3=bigdatacloud-api-key-3:latest,\
BIGDATACLOUD_API_KEY_4=bigdatacloud-api-key-4:latest,\
BIGDATACLOUD_API_KEY_5=bigdatacloud-api-key-5:latest \
  --allow-unauthenticated
```

### Get Cloud Run URL

```bash
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(status.url)"
```

## 6. Setup Custom Domain (Optional)

### Create Managed SSL Certificate

```bash
gcloud compute ssl-certificates create omegle-ssl \
  --domains=api.vitap.in \
  --global
```

### Map Custom Domain

```bash
gcloud run domain-mappings create \
  --service $SERVICE_NAME \
  --domain api.vitap.in \
  --region $REGION
```

### Update DNS Records

Add DNS records from the mapping command output to your domain registrar.

## 7. Deploy Frontend (CDN hosting)

### Install Auth Tools

```bash
npm install -g frontend-hosting-cli
# sign in to hosting provider
```

### Configure CDN hosting

```bash
# Main App
cd omegle-vitap
# configure frontend hosting

# Select options:
# - Use existing project: omgle-vitap-prod
# - Public directory: out (Next.js export)
# - Configure as single-page app: Yes
# - Setup automatic builds: No

# Build and deploy
npm run build
# deploy user frontend
```

### Deploy Admin Panel

```bash
cd ../admin-omegle-vitap
# configure frontend hosting

# Use a different site for admin panel
# clone admin hosting target

# Build and deploy
pnpm run build
# deploy admin frontend
```

## 8. Setup Cloud Armor (WAF)

### Create Security Policy

```bash
gcloud compute security-policies create omegle-waf \
  --description "WAF for Omegle VITAP"

# Block specific countries (optional)
gcloud compute security-policies rules create 1000 \
  --security-policy omegle-waf \
  --expression "origin.region_code == 'CN' || origin.region_code == 'RU'" \
  --action deny-403

# Rate limiting rule
gcloud compute security-policies rules create 2000 \
  --security-policy omegle-waf \
  --expression "true" \
  --action rate-based-ban \
  --rate-limit-threshold-count 1000 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600

# Default rule (allow all)
gcloud compute security-policies rules create 2147483647 \
  --security-policy omegle-waf \
  --action allow
```

### Attach to Backend Service

```bash
# Get backend service name
gcloud compute backend-services list

# Attach policy
gcloud compute backend-services update YOUR_BACKEND_SERVICE \
  --security-policy omegle-waf \
  --global
```

## 9. Setup Monitoring & Alerting

### Create Alerting Policies

```bash
# High error rate alert
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --metric-type="run.googleapis.com/request_count" \
  --metric-filter='resource.type="cloud_run_revision" AND metric.response_code_class="5xx"'

# High CPU usage
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="High CPU Usage" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --metric-type="run.googleapis.com/container/cpu/utilizations"
```

### Setup Uptime Checks

```bash
gcloud monitoring uptime create YOUR_CHECK \
  --resource-type=uptime-url \
  --resource-labels=host=api.vitap.in,path=/health \
  --display-name="Backend Health Check" \
  --period=60 \
  --timeout=10s
```

## 10. Continuous Deployment with Cloud Build

### Create cloudbuild.yaml

```yaml
steps:
  # Install dependencies
  - name: 'node:20'
    entrypoint: npm
    args: ['ci']

  # Run tests
  - name: 'node:20'
    entrypoint: npm
    args: ['run', 'test:ci']

  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/omegle-vitap-backend:$SHORT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/omegle-vitap-backend:latest'
      - '.'

  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/omegle-vitap-backend:$SHORT_SHA'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'omegle-vitap-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/omegle-vitap-backend:$SHORT_SHA'
      - '--region'
      - 'asia-south1'
      - '--platform'
      - 'managed'

images:
  - 'gcr.io/$PROJECT_ID/omegle-vitap-backend:$SHORT_SHA'
  - 'gcr.io/$PROJECT_ID/omegle-vitap-backend:latest'

options:
  machineType: 'N1_HIGHCPU_8'
  timeout: '1200s'
```

### Setup Build Trigger

```bash
gcloud builds triggers create github \
  --repo-name=omegle-vitap \
  --repo-owner=rudra-sah00 \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

## 11. Backup & Recovery

### Setup Neon backups

```bash
echo skip-legacy-export gs://omgle-vitap-prod-backups/$(date +%Y%m%d) \
  --async
```

Create a Cloud Scheduler job for daily backups:

```bash
gcloud scheduler jobs create app-engine daily-neon-backup \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="https://sqladmin.googleapis.com/v1/projects/omgle-vitap-prod/databases/(default):exportDocuments" \
  --http-method=POST \
  --message-body='{"outputUriPrefix":"gs://omgle-vitap-prod-backups"}' \
  --oauth-service-account-email=$SERVICE_ACCOUNT
```

### Setup Redis Snapshots

Redis Memorystore Standard tier automatically creates daily backups.

To manually create a snapshot:

```bash
gcloud redis instances export $REDIS_INSTANCE \
  --region=$REGION \
  --destination=gs://omgle-vitap-prod-backups/redis/$(date +%Y%m%d).rdb
```

## 12. Cost Optimization

### Setup Budget Alerts

```bash
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Omegle VITAP Monthly Budget" \
  --budget-amount=500USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100
```

### Configure Autoscaling

```bash
# Update Cloud Run with optimized settings
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --cpu-throttling \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80
```

## Troubleshooting

### View Logs

```bash
# Cloud Run logs
gcloud run logs read $SERVICE_NAME --region=$REGION --limit=50

# Real-time logs
gcloud run logs tail $SERVICE_NAME --region=$REGION

# Filter errors
gcloud run logs read $SERVICE_NAME --region=$REGION --filter="severity>=ERROR"
```

### Check Redis Connection

```bash
# Connect to Redis via bastion host
gcloud compute ssh bastion-host --zone=asia-south1-a

# Inside bastion
redis-cli -h <REDIS_HOST> -p 6379
AUTH <YOUR_AUTH_STRING>
PING
```

### Debug Cloud Run

```bash
# Get service details
gcloud run services describe $SERVICE_NAME --region=$REGION

# Check revisions
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION

# View metrics
gcloud monitoring time-series list \
  --filter='resource.type="cloud_run_revision" AND metric.type="run.googleapis.com/request_count"' \
  --format=json
```

## Security Checklist

- [ ] All secrets stored in Secret Manager
- [ ] Cloud Armor WAF configured
- [ ] VPC connector for Redis (no public IP)
- [ ] IAM roles configured with least privilege
- [ ] SSL certificates configured
- [ ] Neon schema applied
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Automated backups enabled
- [ ] Budget alerts configured

## Maintenance

### Update Secrets

```bash
# Update a secret
echo -n "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=-

# Deploy new revision
gcloud run services update $SERVICE_NAME --region=$REGION
```

### Scale Services

```bash
# Manually scale
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --min-instances=2 \
  --max-instances=20

# During high traffic events
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --min-instances=5 \
  --max-instances=50 \
  --cpu-boost
```

### Rolling Updates

```bash
# Deploy with gradual traffic migration
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --image=gcr.io/$PROJECT_ID/$SERVICE_NAME:new-version \
  --no-traffic

# Gradually shift traffic
gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --to-revisions=new-revision=25

# Monitor and complete
gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --to-latest
```

---

**Last Updated**: December 2025  
**Version**: 1.0  
**Platform**: Google Cloud Platform
