import { MediaFilesService } from "@/modules/media/service";
import { mediaPurpose } from "@/modules/media/model";
import type { TenantActor } from "@/lib/tenant";

/**
 * Item image upload/read adapter. Validation, metadata, binding and storage
 * live in the central media module; this keeps the existing route contract.
 */
export abstract class ItemImagesService {
  static async store(
    actor: TenantActor,
    file: File,
  ): Promise<{ image: string }> {
    return {
      image: await MediaFilesService.storeTemporaryImage(
        actor,
        mediaPurpose.itemImage,
        file,
      ),
    };
  }

  static show(
    actor: TenantActor,
    fileName: string,
  ): Promise<{ path: string; contentType: string }> {
    return MediaFilesService.serveImage(
      actor,
      mediaPurpose.itemImage,
      fileName,
    );
  }
}
