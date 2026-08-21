"use client";

import { ReactNode, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  TestTube,
  Cloud,
  Key,
  Globe,
  Settings2,
  Bot,
  Cpu,
  CheckCircle2,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIProvider, BotConfig, BotStatus, ProviderConfigState } from "./types";

interface ProviderConfigProps {
  status: BotStatus | null;
  config: BotConfig | null;
  providerState: ProviderConfigState;
  testing: boolean;
  onProviderChange: (provider: AIProvider) => void;
  onApiKeyChange: (key: string) => void;
  onRegionChange: (region: string) => void;
  onModelIdChange: (modelId: string) => void;
  onEndpointChange: (endpoint: string) => void;
  onDeploymentNameChange: (name: string) => void;
  onApiVersionChange: (version: string) => void;
  onBaseUrlChange: (url: string) => void;
  onTestConnection: () => void;
}

function getProviderIcon(provider: AIProvider): ReactNode {
  switch (provider) {
    case "bedrock":
      return <Cloud className="h-4 w-4" />;
    case "openai":
      return <Cpu className="h-4 w-4" />;
    case "azure":
      return <Globe className="h-4 w-4" />;
    case "anthropic":
      return <Bot className="h-4 w-4" />;
  }
}

const tabContentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Component for API Key field with edit mode
function ApiKeyField({
  hasExistingKey,
  value,
  onChange,
  placeholder,
  isCurrentProvider,
}: {
  hasExistingKey: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isCurrentProvider: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  // Show edit mode if user is entering a new key or wants to change
  const showInput = !hasExistingKey || isEditing || value.length > 0;

  return (
    <div className="space-y-2">
      <Label className="text-sm flex items-center gap-2">
        <Key className="h-3 w-3" />
        API Key
      </Label>

      {hasExistingKey && !showInput && isCurrentProvider ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 p-2 bg-zinc-800 border border-zinc-700 rounded-md">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-zinc-300">API key configured</span>
            <Badge
              variant="outline"
              className="ml-auto text-xs border-emerald-600 text-emerald-500"
            >
              Saved
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-zinc-400 hover:text-white"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              hasExistingKey && isCurrentProvider
                ? "Enter new API key to replace existing"
                : placeholder
            }
            className="bg-zinc-800 border-zinc-700"
          />
          {hasExistingKey && isCurrentProvider && (
            <p className="text-xs text-zinc-500">
              Leave empty to keep existing key, or enter a new key to replace it
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProviderConfig({
  status,
  config,
  providerState,
  testing,
  onProviderChange,
  onApiKeyChange,
  onRegionChange,
  onModelIdChange,
  onEndpointChange,
  onDeploymentNameChange,
  onApiVersionChange,
  onBaseUrlChange,
  onTestConnection,
}: ProviderConfigProps) {
  const {
    selectedProvider,
    apiKey,
    region,
    modelId,
    endpoint,
    deploymentName,
    apiVersion,
    baseUrl,
  } = providerState;

  // Check if current provider has an existing API key
  const hasExistingKey = config?.providerConfig?.hasApiKey ?? false;
  const isCurrentProvider =
    config?.providerConfig?.provider === selectedProvider;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Label className="text-sm sm:text-base font-medium flex items-center gap-2">
        <Settings2 className="h-4 w-4" />
        AI Provider
      </Label>

      {status?.provider && (
        <div className="p-2 bg-zinc-800/50 rounded text-xs sm:text-sm text-zinc-300 flex items-center gap-2">
          {getProviderIcon(status.provider)}
          <span>
            Current:{" "}
            <strong>
              {config?.providers?.[status.provider]?.name || status.provider}
            </strong>
          </span>
          {hasExistingKey && (
            <Badge className="ml-auto bg-emerald-600/20 text-emerald-400 border-emerald-600/50">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          )}
        </div>
      )}

      <Tabs
        value={selectedProvider}
        onValueChange={(v) => onProviderChange(v as AIProvider)}
      >
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-zinc-800 h-auto gap-1 p-1">
          <TabsTrigger
            value="bedrock"
            className="text-xs px-2 py-2 data-[state=active]:bg-zinc-700"
          >
            <Cloud className="h-3 w-3 mr-1 hidden sm:inline" />
            Bedrock
          </TabsTrigger>
          <TabsTrigger
            value="openai"
            className="text-xs px-2 py-2 data-[state=active]:bg-zinc-700"
          >
            <Cpu className="h-3 w-3 mr-1 hidden sm:inline" />
            OpenAI
          </TabsTrigger>
          <TabsTrigger
            value="azure"
            className="text-xs px-2 py-2 data-[state=active]:bg-zinc-700"
          >
            <Globe className="h-3 w-3 mr-1 hidden sm:inline" />
            Azure
          </TabsTrigger>
          <TabsTrigger
            value="anthropic"
            className="text-xs px-2 py-2 data-[state=active]:bg-zinc-700"
          >
            <Bot className="h-3 w-3 mr-1 hidden sm:inline" />
            Claude
          </TabsTrigger>
        </TabsList>

        {/* Bedrock Config */}
        <TabsContent value="bedrock" className="space-y-3 mt-3">
          <motion.div
            key="bedrock-content"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="Enter Bedrock API key"
              isCurrentProvider={isCurrentProvider}
            />
            <div className="space-y-2">
              <Label className="text-sm">Region</Label>
              <Select value={region} onValueChange={onRegionChange}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us-east-1">
                    US East (N. Virginia)
                  </SelectItem>
                  <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                  <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                  <SelectItem value="ap-northeast-1">
                    Asia Pacific (Tokyo)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Model</Label>
              <Select value={modelId} onValueChange={onModelIdChange}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {config?.providerModels?.bedrock &&
                    Object.entries(config.providerModels.bedrock).map(
                      ([id, name]) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ),
                    )}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        </TabsContent>

        {/* OpenAI Config */}
        <TabsContent value="openai" className="space-y-3 mt-3">
          <motion.div
            key="openai-content"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="sk-..."
              isCurrentProvider={isCurrentProvider}
            />
            <div className="space-y-2">
              <Label className="text-sm">Model</Label>
              <Select value={modelId} onValueChange={onModelIdChange}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {config?.providerModels?.openai &&
                    Object.entries(config.providerModels.openai).map(
                      ([id, name]) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ),
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Base URL (optional)</Label>
              <Input
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </motion.div>
        </TabsContent>

        {/* Azure Config */}
        <TabsContent value="azure" className="space-y-3 mt-3">
          <motion.div
            key="azure-content"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="Enter Azure OpenAI key"
              isCurrentProvider={isCurrentProvider}
            />
            <div className="space-y-2">
              <Label className="text-sm">Endpoint</Label>
              <Input
                value={endpoint}
                onChange={(e) => onEndpointChange(e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Deployment Name</Label>
              <Input
                value={deploymentName}
                onChange={(e) => onDeploymentNameChange(e.target.value)}
                placeholder="gpt-4o-deployment"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">API Version</Label>
              <Input
                value={apiVersion}
                onChange={(e) => onApiVersionChange(e.target.value)}
                placeholder="2024-02-15-preview"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </motion.div>
        </TabsContent>

        {/* Anthropic Config */}
        <TabsContent value="anthropic" className="space-y-3 mt-3">
          <motion.div
            key="anthropic-content"
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="sk-ant-..."
              isCurrentProvider={isCurrentProvider}
            />
            <div className="space-y-2">
              <Label className="text-sm">Model</Label>
              <Select value={modelId} onValueChange={onModelIdChange}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {config?.providerModels?.anthropic &&
                    Object.entries(config.providerModels.anthropic).map(
                      ([id, name]) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ),
                    )}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Test Connection Button */}
      <Button
        variant="outline"
        onClick={onTestConnection}
        disabled={testing || (!apiKey && !hasExistingKey)}
        className="w-full border-zinc-700"
      >
        {testing ? (
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <TestTube className="h-4 w-4 mr-2" />
        )}
        Test Connection
      </Button>
    </div>
  );
}
