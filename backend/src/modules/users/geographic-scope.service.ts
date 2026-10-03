import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '../common/enums';

export interface UserScopeDetails {
  isStatewide: boolean;
  districtId: string | null;
  districtName: string | null;
  panchayats: string[];
}

@Injectable()
export class GeographicScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserScope(userId: string): Promise<UserScopeDetails> {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
        geographicScope: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.role.name === RoleName.ADMIN) {
      return {
        isStatewide: true,
        districtId: null,
        districtName: null,
        panchayats: [],
      };
    }

    if (!user.geographicScope) {
      // If no geographic scope is explicitly configured, check role:
      // Field officers and collection agents require a scope; if none is assigned, default to non-statewide empty scope
      if (user.role.name === RoleName.FIELD_OFFICER || user.role.name === RoleName.COLLECTION_AGENT) {
        return {
          isStatewide: false,
          districtId: null,
          districtName: null,
          panchayats: [],
        };
      }
      return {
        isStatewide: true,
        districtId: null,
        districtName: null,
        panchayats: [],
      };
    }

    let parsedPanchayats: string[] = [];
    if (user.geographicScope.panchayats_json) {
      try {
        parsedPanchayats = JSON.parse(user.geographicScope.panchayats_json);
      } catch {
        parsedPanchayats = [];
      }
    }

    return {
      isStatewide: false,
      districtId: user.geographicScope.district_id,
      districtName: user.geographicScope.district_name,
      panchayats: parsedPanchayats,
    };
  }

  async assertEntityWithinScope(
    userId: string,
    entityDistrictId?: string | null,
    entityPanchayat?: string | null,
  ): Promise<void> {
    const scope = await this.getUserScope(userId);
    if (scope.isStatewide) {
      return;
    }

    if (!scope.districtId) {
      throw new ForbiddenException(
        'Access denied: You have no assigned geographic jurisdiction. Please contact the administrator.',
      );
    }

    if (entityDistrictId && entityDistrictId !== scope.districtId) {
      throw new ForbiddenException(
        `Access denied: Target record (District: ${entityDistrictId}) is outside your assigned geographic scope (District: ${scope.districtName || scope.districtId}).`,
      );
    }

    if (
      scope.panchayats.length > 0 &&
      entityPanchayat &&
      !scope.panchayats.includes(entityPanchayat)
    ) {
      throw new ForbiddenException(
        `Access denied: Target record (Panchayat: ${entityPanchayat}) is outside your assigned panchayats.`,
      );
    }
  }

  async applyScopeFilter(userId: string, whereClause: any = {}): Promise<any> {
    const scope = await this.getUserScope(userId);
    if (scope.isStatewide) {
      return whereClause;
    }

    if (!scope.districtId) {
      // Scoped user with no district assigned cannot see any records
      return {
        ...whereClause,
        district_id: '00000000-0000-0000-0000-000000000000',
      };
    }

    const filteredWhere = {
      ...whereClause,
      district_id: scope.districtId,
    };

    if (scope.panchayats.length > 0) {
      filteredWhere.panchayat_name = { in: scope.panchayats };
    }

    return filteredWhere;
  }
}
