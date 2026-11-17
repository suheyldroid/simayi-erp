import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { UsersService } from "../users/service";
import { SystemPreferencesModel } from "./model";
import { SystemPreferencesService } from "./service";

/**
 * Global system preferences. Reading needs only an authenticated account so
 * business screens can resolve the fixed currency without an active
 * organization; the one-time write is restricted to the verified platform
 * administrator role.
 */
export const systemPreferencesController = new Elysia({
  name: "system-preferences",
})
  .use(authPlugin)
  .guard({
    auth: true,
    detail: {
      tags: ["System preferences"],
      security: [{ cookieAuth: [] }],
    },
  })
  .get("/system-preferences", () => SystemPreferencesService.show(), {
    response: SystemPreferencesModel.preference,
    detail: { summary: "Read system preferences" },
  })
  .patch(
    "/system-preferences",
    ({ user, body }) => {
      UsersService.requireAdministrator(user.role);
      return SystemPreferencesService.configure(body);
    },
    {
      body: SystemPreferencesModel.body,
      response: SystemPreferencesModel.preference,
      detail: { summary: "Configure the system currency once" },
    },
  );
