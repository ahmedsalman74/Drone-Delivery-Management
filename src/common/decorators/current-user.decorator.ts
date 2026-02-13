import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class JwtPayload {
  sub!: string;
  name!: string;
  type!: string;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext,
  ): JwtPayload | string => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;
    return data ? user[data] : user;
  },
);
