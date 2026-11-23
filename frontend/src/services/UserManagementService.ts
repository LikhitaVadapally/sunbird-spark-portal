import { getClient, ApiResponse } from '../lib/http-client';

export interface UserRoleInfo {
  role: string;
  scope: Array<{ organisationId: string }>;
  createdDate: string;
  updatedDate: string | null;
  userId: string;
}

export interface UserSearchResult {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  maskedEmail: string;
  maskedPhone: string | null;
  status: number;
  isDeleted: boolean;
  roles: UserRoleInfo[];
  rootOrgName: string;
  rootOrgId: string;
  channel: string;
}

export interface RoleItem {
  id: string;
  name: string;
  actionGroups: Array<{ name: string; id: string; actions: any[] }>;
}

export interface OrganisationOption {
  organisationId: string;
  orgName: string;
}

export type RoleOperation = 'add' | 'update' | 'remove';

export class UserManagementService {
  async searchUser(userName: string): Promise<ApiResponse<any>> {
    return getClient().post('/user/v3/search', {
      request: { filters: { userName } },
    });
  }

  /** Finds users by exact email or username. lern encrypts an `email` filter before matching. */
  async findUsers(filters: { email: string } | { userName: string }): Promise<ApiResponse<{ response?: { content?: unknown[] } }>> {
    return getClient().post('/user/v3/search', {
      request: { filters, fields: ['id', 'userId', 'firstName', 'lastName', 'userName', 'maskedEmail'], limit: 2 },
    });
  }

  async getRoles(): Promise<ApiResponse<any>> {
    return getClient().get('/data/v1/role/read');
  }

  async assignRole(
    userId: string,
    roleId: string,
    organisationId: string,
    operation: RoleOperation
  ): Promise<ApiResponse<any>> {
    return getClient().post('/user/v2/role/assign', {
      request: {
        userId,
        roles: [
          {
            role: roleId,
            operation,
            scope: [{ organisationId }],
          },
        ],
      },
    });
  }
}

export const userManagementService = new UserManagementService();
