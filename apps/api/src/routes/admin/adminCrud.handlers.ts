import { Request, Response } from 'express';
import { adminService } from '../../services/admin';

export async function listAdmins(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can view admin list',
      });
    }
    const admins = await adminService.getAllAdmins();
    return res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error('List admins error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
    });
  }
}

export async function createAdmin(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { email, password, name, role } = req.body;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can create admins',
      });
    }
    adminService.validateCreateData({ email, password, name, role });
    const newAdmin = await adminService.createAdmin({
      email,
      password,
      name,
      role,
      createdBy: user.uid,
    });
    return res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: newAdmin,
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }
    if (error instanceof Error && !(error as { code?: string }).code) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin',
    });
  }
}

export async function updateAdmin(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { uid } = req.params;
    const { name, role, isActive } = req.body;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can update admins',
      });
    }
    if (adminService.isSelfModification(user.uid, uid)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify your own account',
      });
    }
    adminService.validateUpdateData({ name, role, isActive });
    await adminService.updateAdmin(uid, { name, role, isActive });
    return res.json({
      success: true,
      message: 'Admin updated successfully',
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update admin',
    });
  }
}

export async function deleteAdmin(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { uid } = req.params;
    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can delete admins',
      });
    }
    if (adminService.isSelfModification(user.uid, uid)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }
    await adminService.deleteAdmin(uid);
    return res.json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete admin',
    });
  }
}
