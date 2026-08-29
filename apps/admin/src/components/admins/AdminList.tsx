import { Admin, AdminSession } from "@/types/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Power, Trash2, Shield, User } from "lucide-react";
import { motion } from "framer-motion";

interface AdminListProps {
  admins: Admin[];
  sessions: AdminSession[];
  loading: boolean;
  onEdit: (admin: Admin) => void;
  onDelete: (adminId: string) => void;
  onRevokeSession: (adminId: string, adminName: string) => void;
}

export function AdminList({
  admins,
  sessions,
  loading,
  onEdit,
  onDelete,
  onRevokeSession,
}: AdminListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Loading admins...</p>
        </CardContent>
      </Card>
    );
  }

  if (admins.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">No admins found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {admins.map((admin) => (
        <motion.div
          key={admin.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-white border border-sky-100 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-4 rounded-full ${
                      admin.role === "super-admin"
                        ? "bg-gradient-to-br from-purple-600 to-purple-700 ring-2 ring-purple-400/50"
                        : "bg-gradient-to-br from-sky-500 to-[#0084d1] ring-2 ring-blue-400/50"
                    }`}
                  >
                    {admin.role === "super-admin" ? (
                      <Shield className="text-purple-100" size={24} />
                    ) : (
                      <User className="text-blue-100" size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-100">
                      {admin.name}
                    </h3>
                    <p className="text-sm text-gray-400">{admin.email}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge
                        variant={
                          admin.role === "super-admin" ? "secondary" : "default"
                        }
                        className={
                          admin.role === "super-admin"
                            ? "bg-purple-600/20 text-purple-300 border-purple-500/50"
                            : "bg-blue-600/20 text-blue-300 border-blue-500/50"
                        }
                      >
                        {admin.role}
                      </Badge>
                      <Badge
                        variant={admin.isActive ? "default" : "destructive"}
                        className={
                          admin.isActive
                            ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/50"
                            : "bg-red-600/20 text-red-300 border-red-500/50"
                        }
                      >
                        {admin.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {sessions.some((s) => s.adminId === admin.id) && (
                        <Badge
                          variant="outline"
                          className="bg-green-600/20 text-green-300 border-green-500/50"
                        >
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse" />
                          Online (
                          {
                            sessions.filter((s) => s.adminId === admin.id)
                              .length
                          }
                          )
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(admin)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  {sessions.some((s) => s.adminId === admin.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-600 hover:text-orange-700"
                      onClick={() => onRevokeSession(admin.id, admin.name)}
                    >
                      <Power className="mr-2 h-4 w-4" />
                      Revoke Sessions
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onDelete(admin.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
