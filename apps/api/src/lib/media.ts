import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import createError from "http-errors";
import env from "@/lib/env";

/**
 * The private media root. `MEDIA_ROOT` is an absolute operator setting and the
 * only place files are stored; relative keys below are resolved under it.
 */
const root = path.resolve(env.MEDIA_ROOT);

/**
 * Low-level disk storage for every binary object. Keys are server-generated
 * relative names (`<purpose>/<uuid>.<ext>` or the existing feature defaults);
 * no client string ever becomes a path, and a key that resolves outside the
 * root is rejected instead of being clamped to it.
 */
export abstract class MediaService {
  static location(relative: string): string {
    if (relative.includes("\0") || path.isAbsolute(relative))
      throw new createError.UnprocessableEntity("Invalid stored file");
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(`${root}${path.sep}`))
      throw new createError.UnprocessableEntity("Invalid stored file");
    return full;
  }

  static async save(relative: string, bytes: Uint8Array): Promise<void> {
    const full = MediaService.location(relative);
    await mkdir(path.dirname(full), { recursive: true });
    // Write beside the destination and rename on success, so a failed or
    // interrupted write never leaves a partial file under the logical key.
    // Stored keys are unique per upload, so one deterministic staging name per
    // key is enough and `remove` can always clear it.
    const staging = `${full}.part`;
    try {
      await writeFile(staging, bytes);
      await rename(staging, full);
    } catch (error) {
      await rm(staging, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  static async read(relative: string): Promise<Uint8Array> {
    return readFile(MediaService.location(relative));
  }

  static async remove(relative: string): Promise<void> {
    const full = MediaService.location(relative);
    await rm(full, { force: true });
    await rm(`${full}.part`, { force: true });
  }
}
