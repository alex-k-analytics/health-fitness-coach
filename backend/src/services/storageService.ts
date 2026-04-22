import { Storage } from "@google-cloud/storage";
import type { MealImageKind } from "@prisma/client";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";

export interface UploadableMealImage {
  buffer: Buffer;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  kind: MealImageKind;
}

const sanitizeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export class StorageService {
  private readonly gcsBucket =
    config.storageDriver === "gcs" && config.gcsBucketName
      ? new Storage().bucket(config.gcsBucketName)
      : null;

  async saveMealImage(input: {
    householdId: string;
    memberId: string;
    mealEntryId: string;
    image: UploadableMealImage;
  }) {
    const safeName = sanitizeFileName(input.image.originalName || "meal-image.jpg") || "meal-image.jpg";
    const storageKey = path.posix.join(
      "households",
      input.householdId,
      "members",
      input.memberId,
      "meals",
      input.mealEntryId,
      `${randomUUID()}-${safeName}`
    );

    if (this.gcsBucket) {
      const file = this.gcsBucket.file(storageKey);
      await file.save(input.image.buffer, {
        resumable: false,
        contentType: input.image.contentType,
        metadata: {
          cacheControl: "private, max-age=0, no-cache"
        }
      });
    } else {
      const fullPath = path.join(config.uploadDir, storageKey);
      await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
      await fsPromises.writeFile(fullPath, input.image.buffer);
    }

    return {
      storageKey,
      originalFileName: input.image.originalName,
      contentType: input.image.contentType,
      sizeBytes: input.image.sizeBytes,
      kind: input.image.kind
    };
  }

  createReadStream(storageKey: string) {
    if (this.gcsBucket) {
      return this.gcsBucket.file(storageKey).createReadStream();
    }

    return fs.createReadStream(path.join(config.uploadDir, storageKey));
  }
}

export const storageService = new StorageService();
