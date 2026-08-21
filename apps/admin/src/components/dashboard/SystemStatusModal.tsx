"use client";

interface SystemStatusModalProps {
  isOpen: boolean;
  pendingStatus: boolean | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function SystemStatusModal({
  isOpen,
  pendingStatus,
  onClose,
  onConfirm,
}: SystemStatusModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full overflow-hidden">
        <div
          className={`p-6 border-b border-zinc-800 ${
            pendingStatus ? "bg-green-900/20" : "bg-red-900/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                pendingStatus ? "bg-green-600" : "bg-red-600"
              }`}
            >
              <span className="text-2xl">{pendingStatus ? "🟢" : "🔴"}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {pendingStatus ? "Turn System ON" : "Turn System OFF"}
              </h3>
              <p className="text-sm text-zinc-400">Confirm your action</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-zinc-300 mb-4">
            {pendingStatus
              ? "Users will be able to connect and use the service normally."
              : "The service will stop accepting new user connections. Existing users will be disconnected."}
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold transition-colors ${
                pendingStatus
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
