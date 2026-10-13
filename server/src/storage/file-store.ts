import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { isUuid } from "../domain/car-fields.js";

/** Car photos on local disk. The public URL never contains the plate. */
export interface FileStore {
  saveCarPhoto(carId: string, photoId: string, bytes: Uint8Array): Promise<void>;
  readCarPhoto(carId: string, photoId: string): Promise<Uint8Array>;
  deleteCarPhoto(carId: string, photoId: string): Promise<void>;
  savePrivatePhoto(photoId: string, bytes: Uint8Array): Promise<void>;
  readPrivatePhoto(photoId: string): Promise<Uint8Array>;
}

function photoPath(root: string, carId: string, photoId: string): string {
  if (!isUuid(carId) || !isUuid(photoId)) throw new Error("Photo path must be two ids");
  return path.join(root, "cars", carId, photoId);
}

/** Writes under `uploads/cars`. Missing files throw so the route can answer 404. */
export class DiskFileStore implements FileStore {
  constructor(private readonly root: string) {}

  async saveCarPhoto(carId: string, photoId: string, bytes: Uint8Array): Promise<void> {
    const file = photoPath(this.root, carId, photoId);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }

  async readCarPhoto(carId: string, photoId: string): Promise<Uint8Array> {
    const bytes = await readFile(photoPath(this.root, carId, photoId));
    return new Uint8Array(bytes);
  }

  async deleteCarPhoto(carId: string, photoId: string): Promise<void> {
    await rm(photoPath(this.root, carId, photoId), { force: true });
  }

  async savePrivatePhoto(photoId: string, bytes: Uint8Array): Promise<void> {
    const file = privatePath(this.root, photoId);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }

  async readPrivatePhoto(photoId: string): Promise<Uint8Array> {
    const bytes = await readFile(privatePath(this.root, photoId));
    return new Uint8Array(bytes);
  }
}

function privatePath(root: string, photoId: string): string {
  if (!isUuid(photoId)) throw new Error("Photo path must be an id");
  return path.join(root, "private", photoId);
}

/** Photo bytes kept in the test process. */
export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, Uint8Array>();

  saveCarPhoto(carId: string, photoId: string, bytes: Uint8Array): Promise<void> {
    this.files.set(`${carId}/${photoId}`, bytes);
    return Promise.resolve();
  }

  readCarPhoto(carId: string, photoId: string): Promise<Uint8Array> {
    const bytes = this.files.get(`${carId}/${photoId}`);
    if (bytes === undefined) return Promise.reject(new Error("Photo file is missing"));
    return Promise.resolve(bytes);
  }

  deleteCarPhoto(carId: string, photoId: string): Promise<void> {
    this.files.delete(`${carId}/${photoId}`);
    return Promise.resolve();
  }

  savePrivatePhoto(photoId: string, bytes: Uint8Array): Promise<void> {
    this.files.set(`private/${photoId}`, bytes);
    return Promise.resolve();
  }

  readPrivatePhoto(photoId: string): Promise<Uint8Array> {
    const bytes = this.files.get(`private/${photoId}`);
    if (bytes === undefined) return Promise.reject(new Error("Photo file is missing"));
    return Promise.resolve(bytes);
  }
}
