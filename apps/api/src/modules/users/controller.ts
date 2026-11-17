import { Elysia } from "elysia";
import { authPlugin } from "../auth/plugin";
import { UsersModel } from "./model";
import { UsersService } from "./service";

export const usersController = new Elysia({ name: "users-controller" })
  .use(authPlugin)
  .get("/users/", ({ actor, query }) => UsersService.index(query, actor), {
    tenant: true,
    query: UsersModel.listQuery,
    response: UsersModel.listResponse,
    detail: {
      tags: ["Users"],
      security: [{ cookieAuth: [] }],
      summary: "List users in the active organization",
    },
  })
  .get(
    "/users/:id",
    ({ actor, params }) => UsersService.get(params.id, actor),
    {
      tenant: true,
      params: UsersModel.params,
      response: UsersModel.user,
      detail: {
        tags: ["Users"],
        security: [{ cookieAuth: [] }],
        summary: "Organization member details",
      },
    },
  )
  .patch(
    "/users/:id",
    ({ user, params, body, request }) => {
      UsersService.requireAdministrator(user.role);
      return UsersService.updateProfile(params.id, body, request.headers);
    },
    {
      auth: true,
      params: UsersModel.params,
      body: UsersModel.profileBody,
      response: UsersModel.user,
      detail: {
        tags: ["Users"],
        security: [{ cookieAuth: [] }],
        summary: "Update native account profile (platform administrator)",
      },
    },
  )
  .patch(
    "/users/:id/status",
    ({ user, params, body, request }) => {
      UsersService.requireAdministrator(user.role);
      return UsersService.setStatus(params.id, body, request.headers);
    },
    {
      auth: true,
      params: UsersModel.params,
      body: UsersModel.statusBody,
      response: UsersModel.user,
      detail: {
        tags: ["Users"],
        security: [{ cookieAuth: [] }],
        summary: "Update account status (platform administrator)",
      },
    },
  )
  .post(
    "/users/members/",
    ({ actor, body, request, set }) => {
      set.status = 201;
      return UsersService.addMember(actor, body, request.headers);
    },
    {
      tenant: true,
      body: UsersModel.memberBody,
      response: { 201: UsersModel.member },
      detail: {
        tags: ["Members"],
        security: [{ cookieAuth: [] }],
        summary: "Add an existing account to the active organization",
      },
    },
  )
  .patch(
    "/users/members/:memberId",
    ({ actor, params, body, request }) =>
      UsersService.updateMemberRole(
        actor,
        params.memberId,
        body,
        request.headers,
      ),
    {
      tenant: true,
      params: UsersModel.memberParams,
      body: UsersModel.memberRoleBody,
      response: UsersModel.member,
      detail: {
        tags: ["Members"],
        security: [{ cookieAuth: [] }],
        summary: "Update an organization member's roles",
      },
    },
  );
