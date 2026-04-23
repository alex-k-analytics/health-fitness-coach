terraform {
  required_version = ">= 1.6.0"

  backend "gcs" {
    bucket = "akalish-software-tfstate-698032141114"
    prefix = "health-fitness-coach/prod"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.45"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
