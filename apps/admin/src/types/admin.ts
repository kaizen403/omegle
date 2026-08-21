export interface Admin {
  id: string;
  email: string;
  name: string;
  role: "super-admin" | "admin";
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface AdminSession {
  socketId: string;
  adminId: string;
  connectedAt: number;
  address: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface CreateAdminData {
  email: string;
  password: string;
  name: string;
  role: "super-admin" | "admin";
}

export interface UpdateAdminData {
  name: string;
  role: "super-admin" | "admin";
  isActive: boolean;
}
