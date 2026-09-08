"use client";

import { ReactNode, useState } from "react";
import { Pencil, RefreshCw, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Section, StatusPill } from "@/components/console";
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

/**
 * One labelled form control with optional help text. Every setting in this
 * panel uses it, so labels, spacing and help text line up down the column.
 */
function Field({
  label,
  htmlFor,
  help,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

/**
 * The API key field.
 *
 * A saved key is shown as a confirmation row rather than a masked input, so
 * nobody wonders whether the dots are a real value. Entering a new key is an
 * explicit "Change" action. The input is `type="password"` and truncates: a
 * long key must never wrap and push the panel around.
 */
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

  if (hasExistingKey && !showInput && isCurrentProvider) {
    return (
      <Field label="API key">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            API key saved
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="shrink-0"
          >
            <Pencil className="size-4" strokeWidth={2} />
            Change
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field
      label="API key"
      htmlFor="provider-api-key"
      help={
        hasExistingKey && isCurrentProvider
          ? "Leave this empty to keep the saved key, or paste a new one to replace it."
          : "Stored on the server and never shown again after saving."
      }
    >
      <Input
        id="provider-api-key"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          hasExistingKey && isCurrentProvider
            ? "Enter a new key to replace the saved one"
            : placeholder
        }
        className="h-9 w-full truncate font-mono text-sm"
      />
    </Field>
  );
}

const PROVIDER_TABS: ReadonlyArray<{ value: AIProvider; label: string }> = [
  { value: "bedrock", label: "Bedrock" },
  { value: "openai", label: "OpenAI" },
  { value: "azure", label: "Azure" },
  { value: "anthropic", label: "Claude" },
];

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

  const modelOptions = (provider: AIProvider) =>
    Object.entries<string>(config?.providerModels?.[provider] ?? {});

  return (
    <Section
      title="AI provider"
      description="Which model answers as the bots, and the credentials it uses."
      actions={
        hasExistingKey ? (
          <StatusPill tone="success">Key saved</StatusPill>
        ) : (
          <StatusPill tone="warning">No key</StatusPill>
        )
      }
    >
      <div className="max-w-xl space-y-4">
        {status?.provider && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="min-w-0 truncate text-muted-foreground">
              In use:{" "}
              <span className="font-medium text-foreground">
                {config?.providers?.[status.provider]?.name || status.provider}
              </span>
            </span>
          </div>
        )}

        <Tabs
          value={selectedProvider}
          onValueChange={(v) => onProviderChange(v as AIProvider)}
          className="gap-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-4">
            {PROVIDER_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-8 min-w-0 px-2 text-sm"
              >
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Bedrock */}
          <TabsContent value="bedrock" className="space-y-4">
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="Enter the Bedrock API key"
              isCurrentProvider={isCurrentProvider}
            />
            <Field
              label="Region"
              help="The AWS region the model is invoked in."
            >
              <Select value={region} onValueChange={onRegionChange}>
                <SelectTrigger className="h-9 w-full">
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
            </Field>
            <Field label="Model">
              <Select value={modelId} onValueChange={onModelIdChange}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions("bedrock").map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </TabsContent>

          {/* OpenAI */}
          <TabsContent value="openai" className="space-y-4">
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="sk-..."
              isCurrentProvider={isCurrentProvider}
            />
            <Field label="Model">
              <Select value={modelId} onValueChange={onModelIdChange}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions("openai").map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Base URL"
              htmlFor="openai-base-url"
              help="Optional. Point this at a compatible gateway instead of OpenAI."
            >
              <Input
                id="openai-base-url"
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder="https://api.openai.com/v1"
                title={baseUrl || undefined}
                className="h-9 w-full truncate"
              />
            </Field>
          </TabsContent>

          {/* Azure */}
          <TabsContent value="azure" className="space-y-4">
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="Enter the Azure OpenAI key"
              isCurrentProvider={isCurrentProvider}
            />
            <Field label="Endpoint" htmlFor="azure-endpoint">
              <Input
                id="azure-endpoint"
                value={endpoint}
                onChange={(e) => onEndpointChange(e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
                title={endpoint || undefined}
                className="h-9 w-full truncate"
              />
            </Field>
            <Field
              label="Deployment name"
              htmlFor="azure-deployment"
              help="The name you gave the model deployment in Azure."
            >
              <Input
                id="azure-deployment"
                value={deploymentName}
                onChange={(e) => onDeploymentNameChange(e.target.value)}
                placeholder="gpt-4o-deployment"
                title={deploymentName || undefined}
                className="h-9 w-full truncate"
              />
            </Field>
            <Field label="API version" htmlFor="azure-api-version">
              <Input
                id="azure-api-version"
                value={apiVersion}
                onChange={(e) => onApiVersionChange(e.target.value)}
                placeholder="2024-02-15-preview"
                className="h-9 w-full truncate font-mono text-sm"
              />
            </Field>
          </TabsContent>

          {/* Anthropic */}
          <TabsContent value="anthropic" className="space-y-4">
            <ApiKeyField
              hasExistingKey={hasExistingKey}
              value={apiKey}
              onChange={onApiKeyChange}
              placeholder="sk-ant-..."
              isCurrentProvider={isCurrentProvider}
            />
            <Field label="Model">
              <Select value={modelId} onValueChange={onModelIdChange}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions("anthropic").map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onTestConnection}
            disabled={testing || (!apiKey && !hasExistingKey)}
            className="shrink-0"
          >
            {testing ? (
              <RefreshCw className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <TestTube className="size-4" strokeWidth={2} />
            )}
            Test connection
          </Button>
        </div>
      </div>
    </Section>
  );
}
