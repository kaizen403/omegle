import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { SocketIOManager } from '../../handlers/socketio';
import { db } from '../../db';
import { account, session, user } from '../../db/schema';
import { Admin } from '../../models/admin';

function toAdmin(row: typeof user.$inferSelect): Admin {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === 'super-admin' ? 'super-admin' : 'admin',
    isActive: row.isActive,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin ?? undefined,
    photoURL: row.image ?? undefined,
  };
}

export class AdminService {
  private socketIOManager: SocketIOManager | null = null;

  setSocketIOManager(manager: SocketIOManager) {
    this.socketIOManager = manager;
  }

  getSocketIOManager(): SocketIOManager | null {
    return this.socketIOManager;
  }

  async getAdminById(uid: string): Promise<Admin | null> {
    const rows = await db.select().from(user).where(eq(user.id, uid)).limit(1);
    return rows[0] ? toAdmin(rows[0]) : null;
  }

  async getAdminByEmail(email: string): Promise<Admin | null> {
    const rows = await db.select().from(user).where(eq(user.email, email)).limit(1);
    return rows[0] ? toAdmin(rows[0]) : null;
  }

  async verifySuperAdmin(uid: string): Promise<boolean> {
    const admin = await this.getAdminById(uid);
    return Boolean(admin && (admin.role === 'admin' || admin.role === 'super-admin'));
  }

  async createAdmin(data: {
    email: string;
    password: string;
    name: string;
    role: 'super-admin' | 'admin';
    createdBy: string;
  }) {
    const { email, password, name, role } = data;
    const existing = await this.getAdminByEmail(email);
    if (existing) {
      const error = new Error('Email already exists') as Error & { code: string };
      error.code = 'auth/email-already-exists';
      throw error;
    }

    const id = randomUUID();
    const now = new Date();
    await db.insert(user).values({
      id,
      email,
      name,
      role,
      isActive: true,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      email,
      name,
      role,
    };
  }

  async updateAdmin(uid: string, data: { name: string; role: string; isActive: boolean }) {
    const { name, role, isActive } = data;
    await db
      .update(user)
      .set({
        name,
        role,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(user.id, uid));

    if (!isActive) {
      await db.delete(session).where(eq(session.userId, uid));
    }

    return { uid, name, role, isActive };
  }

  async deleteAdmin(uid: string) {
    await db.delete(user).where(eq(user.id, uid));
  }

  async getAllAdmins() {
    const rows = await db.select().from(user);
    return rows.map(toAdmin);
  }

  async updateLastLogin(uid: string): Promise<void> {
    await db
      .update(user)
      .set({ lastLogin: new Date(), updatedAt: new Date() })
      .where(eq(user.id, uid));
  }

  async revokeUserSessions(uid: string) {
    const admin = await this.getAdminById(uid);
    if (!admin) {
      throw new Error('Admin not found');
    }
    await db.delete(session).where(eq(session.userId, uid));
    return {
      uid,
      email: admin.email,
      tokensValidAfterTime: new Date().toISOString(),
    };
  }

  getActiveSessions() {
    if (!this.socketIOManager) {
      throw new Error('Socket service not available');
    }
    return this.socketIOManager.getAdminHandler().getActiveSessions();
  }

  async getActiveSessionsWithDetails(excludeAdminId?: string) {
    const sessions = this.getActiveSessions();
    const filteredSessions = excludeAdminId
      ? sessions.filter((item) => item.adminId !== excludeAdminId)
      : sessions;

    const enrichedSessions = await Promise.all(
      filteredSessions.map(async (item) => {
        const admin = await this.getAdminById(item.adminId);
        return {
          ...item,
          email: admin?.email || 'Unknown',
          name: admin?.name || 'Unknown Admin',
          role: admin?.role || 'admin',
        };
      })
    );

    return enrichedSessions;
  }

  async revokeAdminSessions(targetUid: string) {
    if (!this.socketIOManager) {
      throw new Error('Socket service not available');
    }

    const targetAdmin = await this.getAdminById(targetUid);
    if (!targetAdmin) {
      throw new Error('Admin not found');
    }

    if (!targetAdmin.isActive) {
      throw new Error('Cannot revoke sessions for inactive admin');
    }

    const revokedCount = this.socketIOManager.getAdminHandler().revokeAdminSessions(targetUid);
    await db.delete(session).where(eq(session.userId, targetUid));

    return {
      adminId: targetUid,
      email: targetAdmin.email,
      revokedSessions: revokedCount,
      message:
        revokedCount === 0 ? 'No active sessions found' : `${revokedCount} session(s) revoked`,
    };
  }

  validateCreateData(data: { email?: string; password?: string; name?: string; role?: string }) {
    const { email, password, name, role } = data;

    if (!email || !password || !name || !role) {
      throw new Error('Email, password, name, and role are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (!['super-admin', 'admin'].includes(role)) {
      throw new Error('Invalid role. Must be either "super-admin" or "admin"');
    }
  }

  validateUpdateData(data: { name?: string; role?: string; isActive?: unknown }) {
    const { name, role, isActive } = data;

    if (!name || !role || typeof isActive !== 'boolean') {
      throw new Error('Name, role, and isActive status are required');
    }

    if (!['super-admin', 'admin'].includes(role)) {
      throw new Error('Invalid role');
    }
  }

  isSelfModification(requesterId: string, targetId: string): boolean {
    return requesterId === targetId;
  }
}

export default new AdminService();
