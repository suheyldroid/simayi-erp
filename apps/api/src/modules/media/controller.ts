import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { UsersService } from "../users/service";
import { MediaFilesModel } from "./model";
import { MediaFilesService } from "./service";

/** Private media bytes: same-origin credentials, never a shared cache. */
function privateMediaResponse(file: {
  path: string;
  contentType: string;
}): Response {
  return new Response(Bun.file(file.path), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Global media for account avatars and organization logos. Uploads and
 * previews need only a session; logo reads authorize against live membership of
 * the owning organization, while attached avatars are readable by any active
 * signed-in account. Neither uses the active organization.
 */
export const mediaController = new Elysia({
  name: "media",
  prefix: "/media",
})
  .use(authPlugin)
  .guard({
    auth: true,
    detail: { tags: ["Media"], security: [{ cookieAuth: [] }] },
  })
  .post(
    "/temporary-logo",
    ({ user, body, set }) => {
      set.status = 201;
      return MediaFilesService.storeTemporaryLogo(user.id, body.image);
    },
    {
      body: MediaFilesModel.upload,
      response: { 201: MediaFilesModel.uploaded },
      detail: { summary: "Upload a temporary organization logo" },
    },
  )
  .get(
    "/temporary-logo/:uuid",
    async ({ user, params }) => {
      const file = await MediaFilesService.serveTemporaryLogo(
        user.id,
        params.uuid,
      );
      return privateMediaResponse(file);
    },
    {
      params: MediaFilesModel.params,
      detail: { summary: "Preview your temporary organization logo" },
    },
  )
  .post(
    "/temporary-avatar",
    ({ user, body, set }) => {
      set.status = 201;
      return MediaFilesService.storeTemporaryAvatar(user.id, body.image);
    },
    {
      body: MediaFilesModel.avatarUpload,
      response: { 201: MediaFilesModel.avatarUploaded },
      detail: { summary: "Upload a temporary account avatar" },
    },
  )
  .post(
    "/temporary-avatar/:userId",
    ({ user, params, body, set }) => {
      UsersService.requireAdministrator(user.role);
      set.status = 201;
      return MediaFilesService.storeTemporaryAvatarForTarget(
        params.userId,
        body.image,
      );
    },
    {
      params: MediaFilesModel.targetParams,
      body: MediaFilesModel.avatarUpload,
      response: { 201: MediaFilesModel.avatarUploaded },
      detail: {
        summary:
          "Upload a temporary avatar for a native account (platform administrator)",
      },
    },
  )
  .get(
    "/avatars/:uuid",
    async ({ user, params }) => {
      const file = await MediaFilesService.serveAvatar(
        user.id,
        params.uuid,
        UsersService.isAdministrator(user.role),
      );
      return privateMediaResponse(file);
    },
    {
      params: MediaFilesModel.params,
      detail: { summary: "Read an account avatar" },
    },
  )
  .get(
    "/:uuid",
    async ({ user, params }) => {
      const file = await MediaFilesService.serveLogo(user.id, params.uuid);
      return privateMediaResponse(file);
    },
    {
      params: MediaFilesModel.params,
      detail: { summary: "Read an organization logo" },
    },
  );
