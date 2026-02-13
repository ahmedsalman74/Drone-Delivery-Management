import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class JwtPayload {
  sub!: string;
  name!: string;
  type!: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user[data] : user;
  },
);
