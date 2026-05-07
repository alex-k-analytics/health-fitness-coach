locals {
  deployer_member  = "serviceAccount:${var.deployer_service_account_email}"
  bootstrap_member = "serviceAccount:${var.bootstrap_service_account_email}"
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

resource "google_project_iam_member" "deployer_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = local.deployer_member
}

resource "google_project_iam_member" "deployer_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = local.deployer_member
}

resource "google_service_account_iam_member" "deployer_runtime_user" {
  service_account_id = google_service_account.app_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = local.deployer_member
}

# Allow the bootstrap identity to provision and update the VPC resources needed
# for the internal Cloud Run scraper path.
resource "google_project_iam_member" "bootstrap_compute_network_admin" {
  project = var.project_id
  role    = "roles/compute.networkAdmin"
  member  = local.bootstrap_member
}

resource "google_project_iam_member" "bootstrap_vpcaccess_admin" {
  project = var.project_id
  role    = "roles/vpcaccess.admin"
  member  = local.bootstrap_member
}

resource "google_project_iam_member" "bootstrap_serviceusage_admin" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = local.bootstrap_member
}
