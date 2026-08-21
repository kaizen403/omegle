"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Power, RefreshCw, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  BotStatusCards,
  BotControls,
  ProviderConfig,
  SystemPromptEditor,
  ActiveBotsTable,
  BotTestChat,
  useBotManagement,
} from "@/components/bots";

export default function BotsPage() {
  const { token, logout, admin: currentAdmin } = useAuth();
  const isSuperAdmin = currentAdmin?.role === "super-admin";

  const {
    status,
    config,
    bots,
    loading,
    saving,
    testing,
    toggling,
    error,
    success,
    hasChanges,
    localMaxBots,
    localSystemPrompt,
    providerState,
    resetDialogOpen,
    fetchData,
    toggleBots,
    testProvider,
    saveConfig,
    resetPrompt,
    setLocalMaxBots,
    setLocalSystemPrompt,
    setSelectedProvider,
    setApiKey,
    setRegion,
    setModelId,
    setEndpoint,
    setDeploymentName,
    setApiVersion,
    setBaseUrl,
    setResetDialogOpen,
  } = useBotManagement({ token });

  if (!isSuperAdmin) {
    return (
      <AdminLayout onLogout={logout}>
        <PageHeader title="Bot Management" />
        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-gray-500">
                  You don&apos;t have permission to access this page. Only super
                  admins can manage bots.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Bot Management" />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-emerald-300"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Cards */}
        <BotStatusCards status={status} loading={loading} />

        {/* Configuration Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Toggle & Settings */}
          <div>
            <Card className="bg-zinc-900/50 border-zinc-800 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Power className="h-5 w-5" />
                  Bot Controls
                </CardTitle>
                <CardDescription>
                  Enable or disable bots and configure their settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <BotControls
                  status={status}
                  loading={loading}
                  toggling={toggling}
                  localMaxBots={localMaxBots}
                  onToggle={toggleBots}
                  onMaxBotsChange={setLocalMaxBots}
                />

                <ProviderConfig
                  status={status}
                  config={config}
                  providerState={providerState}
                  testing={testing}
                  onProviderChange={setSelectedProvider}
                  onApiKeyChange={setApiKey}
                  onRegionChange={setRegion}
                  onModelIdChange={setModelId}
                  onEndpointChange={setEndpoint}
                  onDeploymentNameChange={setDeploymentName}
                  onApiVersionChange={setApiVersion}
                  onBaseUrlChange={setBaseUrl}
                  onTestConnection={testProvider}
                />

                {/* Save Button */}
                <motion.div
                  whileHover={{ scale: hasChanges ? 1.02 : 1 }}
                  whileTap={{ scale: hasChanges ? 0.98 : 1 }}
                >
                  <Button
                    onClick={saveConfig}
                    disabled={!hasChanges || saving}
                    className="w-full bg-purple-600 hover:bg-purple-700 transition-all"
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </div>

          {/* System Prompt */}
          <SystemPromptEditor
            value={localSystemPrompt}
            onChange={setLocalSystemPrompt}
            resetDialogOpen={resetDialogOpen}
            onResetDialogChange={setResetDialogOpen}
            onReset={resetPrompt}
          />
        </div>

        {/* Active Bots Table */}
        <ActiveBotsTable bots={bots} loading={loading} onRefresh={fetchData} />

        {/* Test Chat */}
        <BotTestChat token={token} isEnabled={status?.enabled || false} />
      </div>
    </AdminLayout>
  );
}
