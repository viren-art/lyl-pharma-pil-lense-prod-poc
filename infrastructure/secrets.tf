# Terraform configuration for GCP Secret Manager
# Manages API credentials for PIL Lens application

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP Project ID for PIL Lens deployment"
  type        = string
}

variable "region" {
  description = "GCP region for Secret Manager"
  type        = string
  default     = "asia-southeast1"
}

variable "google_docai_api_key" {
  description = "Google Document AI API key (sensitive)"
  type        = string
  sensitive   = true
}

variable "claude_api_key" {
  description = "Claude API key (sensitive)"
  type        = string
  sensitive   = true
}

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  project = var.project_id
  service = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# Google Document AI API Key Secret
resource "google_secret_manager_secret" "google_docai_api_key" {
  project   = var.project_id
  secret_id = "google-docai-api-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  labels = {
    app         = "pil-lens"
    environment = "production"
    managed_by  = "terraform"
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "google_docai_api_key" {
  secret      = google_secret_manager_secret.google_docai_api_key.id
  secret_data = var.google_docai_api_key
}

# Claude API Key Secret
resource "google_secret_manager_secret" "claude_api_key" {
  project   = var.project_id
  secret_id = "claude-api-key"
  
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }

  labels = {
    app         = "pil-lens"
    environment = "production"
    managed_by  = "terraform"
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "claude_api_key" {
  secret      = google_secret_manager_secret.claude_api_key.id
  secret_data = var.claude_api_key
}

# Service Account for Cloud Run
resource "google_service_account" "pil_lens" {
  project      = var.project_id
  account_id   = "pil-lens-sa"
  display_name = "PIL Lens Cloud Run Service Account"
  description  = "Service account for PIL Lens application with Secret Manager access"
}

# Grant Secret Manager Secret Accessor role to service account
resource "google_secret_manager_secret_iam_member" "google_docai_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.google_docai_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.pil_lens.email}"
}

resource "google_secret_manager_secret_iam_member" "claude_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.claude_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.pil_lens.email}"
}

# Grant Cloud Run Invoker role for public access (internal trusted network)
resource "google_cloud_run_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  service  = "pil-lens"
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_account_email" {
  description = "Email of the PIL Lens service account"
  value       = google_service_account.pil_lens.email
}

output "google_docai_secret_name" {
  description = "Full resource name of Google Document AI secret"
  value       = google_secret_manager_secret.google_docai_api_key.name
}

output "claude_secret_name" {
  description = "Full resource name of Claude API secret"
  value       = google_secret_manager_secret.claude_api_key.name
}