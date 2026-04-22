output "service_url" {
  description = "Public Cloud Run URL."
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository path."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "meal_images_bucket" {
  description = "Bucket used for meal images."
  value       = google_storage_bucket.meal_images.name
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name."
  value       = google_sql_database_instance.main.connection_name
}

output "runtime_service_account" {
  description = "Cloud Run runtime service account email."
  value       = google_service_account.app_runtime.email
}
