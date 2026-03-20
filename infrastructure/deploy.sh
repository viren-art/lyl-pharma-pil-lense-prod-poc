#!/bin/bash
# PIL Lens GCP Cloud Run Deployment Script
# Deploys monitoring, SLO, and Cloud Run service

set -e

PROJECT_ID=${GCP_PROJECT_ID:-"your-project-id"}
REGION="asia-southeast1"
SERVICE_NAME="pil-lens"

echo "🚀 Deploying PIL Lens to GCP Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Step 1: Create uptime check
echo "📊 Creating uptime check..."
gcloud monitoring uptime create pil-lens-health-check \
  --project=$PROJECT_ID \
  --display-name="PIL Lens Health Check (Business Hours)" \
  --resource-type=uptime-url \
  --host="$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app" \
  --path="/api/health" \
  --check-interval=60s \
  --timeout=10s \
  --selected-regions=ASIA_PACIFIC \
  --content-matcher='{"status":"healthy"}' \
  --matcher-type=CONTAINS_STRING

# Step 2: Create notification channel (email)
echo "📧 Creating notification channel..."
CHANNEL_ID=$(gcloud alpha monitoring channels create \
  --project=$PROJECT_ID \
  --display-name="PIL Lens Alerts" \
  --type=email \
  --channel-labels=email_address=alerts@lotus-pharma.com \
  --format="value(name)")

# Step 3: Deploy alert policies
echo "🔔 Deploying alert policies..."
sed "s/PROJECT_ID/$PROJECT_ID/g; s/CHANNEL_ID/$CHANNEL_ID/g" infrastructure/monitoring.yaml | \
  gcloud alpha monitoring policies create --project=$PROJECT_ID --policy-from-file=-

# Step 4: Deploy SLO
echo "📈 Deploying SLO..."
sed "s/PROJECT_ID/$PROJECT_ID/g" infrastructure/slo.yaml | \
  gcloud alpha monitoring slos create --project=$PROJECT_ID --slo-from-file=-

# Step 5: Deploy Cloud Run service
echo "☁️ Deploying Cloud Run service..."
gcloud run services replace infrastructure/cloudrun.yaml \
  --project=$PROJECT_ID \
  --region=$REGION

echo "✅ Deployment complete!"
echo "Service URL: https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app"
echo "Health Check: https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app/api/health"
echo "SLA Metrics: https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app/api/health/sla"