locals {
  deployer_member = "serviceAccount:${var.deployer_service_account_email}"
}

# Allow the existing GitHub Actions deployer identity to push images and roll
# new Cloud Run revisions after the platform has been bootstrapped once.
resource "google_project_iam_member" "deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = local.deployer_member
}

resource "google_project_iam_member" "deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = local.deployer_member
}

resource "google_service_account_iam_member" "deployer_runtime_user" {
  service_account_id = google_service_account.app_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = local.deployer_member
}
