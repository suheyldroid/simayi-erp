import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { UsersService } from "../users/service";
import { UnitsModel } from "./model";
import { UnitsService } from "./service";

/**
 * Global unit catalog. Reads need only an authenticated account, so item and
 * recipe forms work without an active organization; writes are restricted to
 * verified platform administrators (the native `user.role`, never an
 * organization role) and never depend on a selected tenant.
 */
export const unitsController = new Elysia({ name: "units" })
  .use(authPlugin)
  .guard({
    auth: true,
    detail: { tags: ["Units"], security: [{ cookieAuth: [] }] },
  })
  .get("/units/", ({ query }) => UnitsService.index(query), {
    query: UnitsModel.query,
    response: UnitsModel.list,
    detail: { summary: "List units" },
  })
  .get("/units/:uuid", ({ params }) => UnitsService.show(params.uuid), {
    params: UnitsModel.params,
    response: UnitsModel.unit,
    detail: { summary: "Unit details" },
  })
  .post(
    "/units/",
    ({ user, body, set }) => {
      UsersService.requireAdministrator(user.role);
      set.status = 201;
      return UnitsService.store(body);
    },
    {
      body: UnitsModel.body,
      response: { 201: UnitsModel.unit },
      detail: { summary: "Create a unit" },
    },
  )
  .patch(
    "/units/:uuid",
    ({ user, params, body }) => {
      UsersService.requireAdministrator(user.role);
      return UnitsService.update(params.uuid, body);
    },
    {
      params: UnitsModel.params,
      body: UnitsModel.patch,
      response: UnitsModel.unit,
      detail: { summary: "Update a unit" },
    },
  )
  .delete(
    "/units/:uuid",
    ({ user, params }) => {
      UsersService.requireAdministrator(user.role);
      return UnitsService.destroy(params.uuid);
    },
    {
      params: UnitsModel.params,
      response: UnitsModel.success,
      detail: { summary: "Delete a unit" },
    },
  );
