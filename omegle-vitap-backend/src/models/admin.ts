export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super-admin';
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  photoURL?: string;
}

export interface AdminSession {
  adminId: string;
  email: string;
  name: string;
  role: string;
  socketId: string;
  connectedAt: Date;
}
