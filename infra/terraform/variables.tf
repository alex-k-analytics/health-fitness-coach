variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Primary Google Cloud region."
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "health-fitness-coach"
}

variable "artifact_repository_id" {
  description = "Artifact Registry repository ID for application images."
  type        = string
  default     = "health-fitness-coach"
}

variable "deployer_service_account_email" {
  description = "Existing GitHub Actions deployer service account email."
  type        = string
  default     = "github-actions-service-account@akalish-software.iam.gserviceaccount.com"
}

variable "app_image" {
  description = "Container image reference deployed to Cloud Run."
  type        = string
}

variable "db_name" {
  description = "Application database name."
  type        = string
  default     = "coach"
}

variable "db_user" {
  description = "Application database user."
  type        = string
  default     = "coach"
}

variable "db_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-f1-micro"
}

variable "sql_disk_size_gb" {
  description = "Cloud SQL disk size in GB."
  type        = number
  default     = 20
}

variable "bucket_name" {
  description = "Optional override for the meal image bucket name."
  type        = string
  default     = ""
}

variable "app_base_url" {
  description = "Public application URL used for invite links and CORS."
  type        = string
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key stored in Secret Manager."
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "JWT signing secret. Leave blank to have Terraform generate one."
  type        = string
  sensitive   = true
  default     = ""
}

variable "min_instances" {
  description = "Minimum Cloud Run instances."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum Cloud Run instances."
  type        = number
  default     = 1
}

variable "deletion_protection" {
  description = "Enable deletion protection on Cloud SQL."
  type        = bool
  default     = false
}
