import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
