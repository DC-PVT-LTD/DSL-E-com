import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * AdminAuthGuard strictly protects management endpoints until the full
 * Authentication and Authorization module (JWT / Session) is implemented.
 * This prevents public exposure of write operations without fake authentication.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException(
        'Authentication required. Management write endpoints are protected pending AuthModule implementation.'
      );
    }

    // In this phase, auth tokens are not yet minted by a backend auth service.
    // Explicitly reject until full AuthModule is active.
    throw new UnauthorizedException(
      'Authentication service pending implementation. Write access is currently deferred.'
    );
  }
}
