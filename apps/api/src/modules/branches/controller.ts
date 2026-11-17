import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { BranchesModel } from "./model";
import { BranchesService } from "./service";

export const branchesController = new Elysia({ name: "branches" })
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Branches"], security: [{ cookieAuth: [] }] },
  })
  .get(
    "/branches/",
    ({ actor, query }) => BranchesService.index(actor, query),
    {
      query: BranchesModel.query,
      response: BranchesModel.list,
      detail: { summary: "List company branches" },
    },
  )
  .post(
    "/branches/",
    ({ actor, body, set }) => {
      set.status = 201;
      return BranchesService.store(actor, body);
    },
    {
      body: BranchesModel.body,
      response: { 201: BranchesModel.branch },
      detail: { summary: "Create a company branch" },
    },
  )
  .get(
    "/branches/:branchUuid",
    ({ actor, params }) => BranchesService.show(actor, params.branchUuid),
    {
      params: BranchesModel.params,
      response: BranchesModel.branch,
      detail: { summary: "Branch details" },
    },
  )
  .patch(
    "/branches/:branchUuid",
    ({ actor, params, body }) =>
      BranchesService.update(actor, params.branchUuid, body),
    {
      params: BranchesModel.params,
      body: BranchesModel.patch,
      response: BranchesModel.branch,
      detail: {
        summary:
          "Edit, deactivate or reactivate a branch; branches are never deleted",
      },
    },
  );
