import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { RecipesModel } from "./model";
import { RecipeService } from "./service";

export const recipesController = new Elysia({ name: "recipes" })
  .use(authPlugin)
  .guard({
    tenant: true,
    detail: { tags: ["Recipes"], security: [{ cookieAuth: [] }] },
  })
  .get("/recipes/", ({ actor, query }) => RecipeService.index(actor, query), {
    query: RecipesModel.query,
    response: RecipesModel.list,
    detail: {
      summary:
        "List company templates and branch-local recipes, or the effective recipe catalog of the request branch",
    },
  })
  .post(
    "/recipes/",
    ({ actor, body, set }) => {
      set.status = 201;
      return RecipeService.store(actor, body);
    },
    {
      body: RecipesModel.body,
      response: { 201: RecipesModel.detail },
      detail: {
        summary:
          "Create a company recipe template or a branch-local recipe with its ingredients",
      },
    },
  )
  .get(
    "/recipes/:recipeUuid",
    ({ actor, params }) => RecipeService.show(actor, params.recipeUuid),
    {
      params: RecipesModel.params,
      response: RecipesModel.detail,
      detail: {
        summary: "Effective recipe details with ingredients and provenance",
      },
    },
  )
  .patch(
    "/recipes/:recipeUuid",
    ({ actor, params, body }) =>
      RecipeService.update(actor, params.recipeUuid, body),
    {
      params: RecipesModel.params,
      body: RecipesModel.patch,
      response: RecipesModel.detail,
      detail: {
        summary:
          "Update a company template, a branch-local recipe, or a branch customization",
      },
    },
  )
  .delete(
    "/recipes/:recipeUuid",
    ({ actor, params, query }) =>
      RecipeService.destroy(actor, params.recipeUuid, query.version),
    {
      params: RecipesModel.params,
      query: RecipesModel.deleteQuery,
      response: RecipesModel.success,
      detail: {
        summary:
          "Delete a company template or a branch-local recipe with its ingredient lines",
      },
    },
  )
  .put(
    "/recipes/:recipeUuid/activation",
    ({ actor, params, body }) =>
      RecipeService.setActivation(actor, params.recipeUuid, body),
    {
      params: RecipesModel.params,
      body: RecipesModel.activation,
      response: RecipesModel.detail,
      detail: {
        summary:
          "Activate or deactivate a company recipe in the request branch",
      },
    },
  )
  .post(
    "/recipes/:recipeUuid/customize",
    ({ actor, params, body, set }) => {
      set.status = 201;
      return RecipeService.customize(actor, params.recipeUuid, body);
    },
    {
      params: RecipesModel.params,
      body: RecipesModel.customize,
      response: { 201: RecipesModel.detail },
      detail: {
        summary:
          "Create a full branch customization of a company recipe pinned at its source version",
      },
    },
  )
  .post(
    "/recipes/:recipeUuid/reset",
    ({ actor, params, body }) =>
      RecipeService.reset(actor, params.recipeUuid, body),
    {
      params: RecipesModel.params,
      body: RecipesModel.reset,
      response: RecipesModel.detail,
      detail: {
        summary:
          "Reset a branch customization and follow the company recipe again, keeping branch activation",
      },
    },
  );
