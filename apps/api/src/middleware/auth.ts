import { Request, Response, NextFunction } from 'express';
import { getAdminFromHeaders, AuthAdmin } from '../lib/session';

export type { AuthAdmin };

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await getAdminFromHeaders(req.headers);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session',
      });
    }

    (req as Request & { user: AuthAdmin }).user = admin;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await getAdminFromHeaders(req.headers);
    if (admin) {
      (req as Request & { user: AuthAdmin }).user = admin;
    }
    next();
  } catch {
    next();
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: AuthAdmin }).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}
