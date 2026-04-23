locals {
  sanitized_service_name = replace(var.service_name, "_", "-")
  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com"
  ])
  openai_api_key_enabled = nonsensitive(var.openai_api_key) != ""
}

resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "random_password" "generated_jwt_secret" {
  length  = 48
  special = false
}

locals {
  meal_images_bucket_name = var.bucket_name != "" ? var.bucket_name : "${local.sanitized_service_name}-${random_id.bucket_suffix.hex}-meal-images"
}

resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = var.artifact_repository_id
  description   = "Container images for the health fitness coach app."
  format        = "DOCKER"

  depends_on = [google_project_service.required]
}

resource "google_service_account" "app_runtime" {
  account_id   = "${substr(local.sanitized_service_name, 0, 24)}-run"
  display_name = "Health Fitness Coach runtime"

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "meal_images" {
  name                        = local.meal_images_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
  public_access_prevention    = "enforced"

  depends_on = [google_project_service.required]
}

resource "google_sql_database_instance" "main" {
  name                = "${local.sanitized_service_name}-db"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = var.deletion_protection

  settings {
    tier      = var.db_tier
    disk_size = var.sql_disk_size_gb
    disk_type = "PD_SSD"

    ip_configuration {
      ipv4_enabled = true
    }

    backup_configuration {
      enabled = true
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

locals {
  database_url     = "postgresql://${var.db_user}:${urlencode(random_password.db_password.result)}@localhost/${var.db_name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
  jwt_secret_value = var.jwt_secret != "" ? var.jwt_secret : random_password.generated_jwt_secret.result
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.sanitized_service_name}-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = local.database_url
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.sanitized_service_name}-jwt-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = local.jwt_secret_value
}

resource "google_secret_manager_secret" "openai_api_key" {
  count     = local.openai_api_key_enabled ? 1 : 0
  secret_id = "${local.sanitized_service_name}-openai-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "openai_api_key" {
  count       = local.openai_api_key_enabled ? 1 : 0
  secret      = google_secret_manager_secret.openai_api_key[0].id
  secret_data = var.openai_api_key
}

resource "google_project_iam_member" "runtime_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app_runtime.email}"
}

resource "google_project_iam_member" "runtime_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app_runtime.email}"
}

resource "google_storage_bucket_iam_member" "runtime_bucket_admin" {
  bucket = google_storage_bucket.meal_images.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app_runtime.email}"
}

resource "google_cloud_run_v2_service" "app" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.app_runtime.email
    timeout         = "300s"

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    volumes {
      name = "cloudsql"

      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      image = var.app_image

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "STORAGE_DRIVER"
        value = "gcs"
      }

      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.meal_images.name
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.app_base_url != "" ? { base = var.app_base_url } : {}
        content {
          name  = "APP_BASE_URL"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.app_base_url != "" ? { base = var.app_base_url } : {}
        content {
          name  = "FRONTEND_ORIGIN"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.openai_api_key_enabled ? { enabled = true } : {}
        content {
          name = "OPENAI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.openai_api_key[0].secret_id
              version = "latest"
            }
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.app,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.jwt_secret,
    google_project_iam_member.runtime_cloudsql_client,
    google_project_iam_member.runtime_secret_accessor,
    google_storage_bucket_iam_member.runtime_bucket_admin
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
