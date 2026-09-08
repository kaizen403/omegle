"use client";

import { RefreshCw, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { PageBody, Section, EmptyState } from "@/components/console";

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
        <PageHeader title="Bot management" />
        <PageBody>
          <Section contentClassName="p-0">
            <EmptyState
              title="You don't have access to this page"
              description="Only super admins can manage bots. Ask a super admin if you need to change bot settings."
            />
          </Section>
        </PageBody>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader
        title="Bot management"
        description="Bot system, AI provider and test chat"
        action={
          <Button
            size="sm"
            onClick={saveConfig}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <RefreshCw className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Save className="size-4" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">Save configuration</span>
            <span className="sm:hidden">Save</span>
          </Button>
        }
      />

      <PageBody>
        {success && (
          <div className="rounded-xl border border-success-line bg-success-surface px-4 py-3 text-sm text-success">
            <p className="min-w-0">{success}</p>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger">
            <p className="min-w-0">{error}</p>
          </div>
        )}

        <BotStatusCards status={status} loading={loading} />

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
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
          </div>

          <SystemPromptEditor
            value={localSystemPrompt}
            onChange={setLocalSystemPrompt}
            resetDialogOpen={resetDialogOpen}
            onResetDialogChange={setResetDialogOpen}
            onReset={resetPrompt}
          />
        </div>

        <ActiveBotsTable bots={bots} loading={loading} onRefresh={fetchData} />

        <BotTestChat token={token} isEnabled={status?.enabled || false} />
      </PageBody>
    </AdminLayout>
  );
}
