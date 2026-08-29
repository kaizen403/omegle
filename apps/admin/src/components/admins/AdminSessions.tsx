import { AdminSession } from "@/types/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Power, User } from "lucide-react";

interface AdminSessionsProps {
  sessions: AdminSession[];
  loading: boolean;
  onRevokeSession: (adminId: string, adminName: string) => void;
}

export function AdminSessions({
  sessions,
  loading,
  onRevokeSession,
}: AdminSessionsProps) {
  return (
    <Card className="mb-6 bg-white border border-sky-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Power className="h-5 w-5 text-green-600" />
          Active Admin Sessions {sessions.length > 0 && `(${sessions.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-gray-500 py-4">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-center text-gray-500 py-4">
            No other admin sessions active
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.socketId}
                className="flex items-center justify-between p-4 border border-green-500/30 bg-green-950/20 rounded-lg hover:bg-green-950/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-gray-900 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-100">
                      {session.name || session.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-300">
                        {session.email}
                      </span>
                      <span className="text-gray-500">•</span>
                      <Badge
                        variant="outline"
                        className="text-xs bg-gray-800 text-gray-200 border-gray-600"
                      >
                        {session.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Connected{" "}
                      {new Date(session.connectedAt).toLocaleTimeString()} • IP:{" "}
                      {session.address}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    onRevokeSession(
                      session.adminId,
                      session.name || session.email || "admin",
                    )
                  }
                >
                  <Power className="mr-2 h-4 w-4" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
