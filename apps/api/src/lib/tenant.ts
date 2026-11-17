export type TenantActor = {
  userId: string;
  organizationId: string;
  branchId: number | null;
  branchUuid: string | null;
};

/**
 * Actor narrowed to one resolved branch. Use `BranchesService.requireActor`
 * inside the write transaction to obtain it; `branchId` never leaves the API.
 */
export type BranchActor = TenantActor & {
  branchId: number;
  branchUuid: string;
  branch: {
    id: number;
    uuid: string;
    name: string;
    active: boolean;
    version: number;
  };
};

export const ORGANIZATION_HEADER = "x-organization-id";
export const BRANCH_HEADER = "x-branch-id";
