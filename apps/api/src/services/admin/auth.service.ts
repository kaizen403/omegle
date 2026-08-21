import { auth } from '../../lib/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { IncomingHttpHeaders } from 'http';
import adminService from './admin.service';
import { getAdminFromHeaders } from '../../lib/session';

export class AdminAuthService {
  async getCurrentAdmin(headers: IncomingHttpHeaders) {
    const admin = await getAdminFromHeaders(headers);
    if (!admin) {
      throw new Error('Invalid authentication token');
    }

    try {
      await adminService.updateLastLogin(admin.uid);
    } catch (error) {
      console.error('Failed to update last login:', error);
    }

    return {
      id: admin.uid,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      photoURL: admin.photoURL,
      isActive: admin.isActive,
      mfaEnabled: admin.twoFactorEnabled,
    };
  }

  async logoutAdmin(headers: IncomingHttpHeaders) {
    await auth.api.signOut({
      headers: fromNodeHeaders(headers),
    });
    return {
      message: 'Logged out successfully',
    };
  }

  async revokeUserTokens(uid: string) {
    return adminService.revokeUserSessions(uid);
  }
}

export default new AdminAuthService();
