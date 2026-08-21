"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AIProvider,
  BotConfig,
  BotInfo,
  BotStatus,
  ProviderConfig,
  ProviderConfigState,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

interface UseBotManagementProps {
  token: string | null;
}

export function useBotManagement({ token }: UseBotManagementProps) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Track if initial fetch has been done
  const hasFetched = useRef(false);
  const isFetching = useRef(false);

  // Local form state
  const [localMaxBots, setLocalMaxBots] = useState(5);
  const [localSystemPrompt, setLocalSystemPrompt] = useState("");

  // Provider config state
  const [selectedProvider, setSelectedProvider] =
    useState<AIProvider>("bedrock");
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [modelId, setModelId] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [deploymentName, setDeploymentName] = useState("");
  const [apiVersion, setApiVersion] = useState("2024-02-15-preview");
  const [baseUrl, setBaseUrl] = useState("");

  const [hasChanges, setHasChanges] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (!token || isFetching.current) return;

      try {
        isFetching.current = true;
        if (showLoading) setLoading(true);

        const options = {
          credentials: "include" as const,
          headers: {
            "x-api-key": API_KEY,
          },
        };

        const [statusRes, configRes, botsRes] = await Promise.all([
          fetch(`${API_URL}/api/admin/bots/status`, options),
          fetch(`${API_URL}/api/admin/bots/config`, options),
          fetch(`${API_URL}/api/admin/bots/list`, options),
        ]);

        if (statusRes.ok) {
          const data = await statusRes.json();
          setStatus(data.data);
        }

        if (configRes.ok) {
          const data = await configRes.json();
          setConfig(data.data);

          // Only set local state on initial load
          if (!hasFetched.current) {
            setLocalMaxBots(data.data.maxBots);
            setLocalSystemPrompt(data.data.systemPrompt);

            // Load provider config if exists
            if (data.data.providerConfig) {
              const pc = data.data.providerConfig;
              setSelectedProvider(pc.provider);
              // Don't load the masked API key
              if (pc.region) setRegion(pc.region);
              if (pc.modelId) setModelId(pc.modelId);
              if (pc.endpoint) setEndpoint(pc.endpoint);
              if (pc.deploymentName) setDeploymentName(pc.deploymentName);
              if (pc.apiVersion) setApiVersion(pc.apiVersion);
              if (pc.baseUrl) setBaseUrl(pc.baseUrl);
            }
          }
        }

        if (botsRes.ok) {
          const data = await botsRes.json();
          setBots(data.data || []);
        }

        setError(null);
        hasFetched.current = true;
      } catch (err) {
        console.error("Failed to fetch bot data:", err);
        setError("Failed to fetch bot data");
      } finally {
        isFetching.current = false;
        setLoading(false);
      }
    },
    [token],
  );

  // Initial fetch - only once
  useEffect(() => {
    if (token && !hasFetched.current) {
      fetchData(true);
    }
  }, [token, fetchData]);

  // Polling for updates (silent, no loading state) - 30 seconds instead of 10
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchData(false); // Don't show loading on polling
    }, 30000);

    return () => clearInterval(interval);
  }, [token, fetchData]);

  // Check for changes - include provider settings
  useEffect(() => {
    if (!config) return;

    const pc = config.providerConfig;
    const providerChanged = pc
      ? selectedProvider !== pc.provider ||
        region !== (pc.region || "us-east-1") ||
        modelId !== (pc.modelId || "") ||
        endpoint !== (pc.endpoint || "") ||
        deploymentName !== (pc.deploymentName || "") ||
        apiVersion !== (pc.apiVersion || "2024-02-15-preview") ||
        baseUrl !== (pc.baseUrl || "")
      : false;

    const changed =
      localMaxBots !== config.maxBots ||
      localSystemPrompt !== config.systemPrompt ||
      apiKey.length > 0 ||
      providerChanged;
    setHasChanges(changed);
  }, [
    localMaxBots,
    localSystemPrompt,
    apiKey,
    config,
    selectedProvider,
    region,
    modelId,
    endpoint,
    deploymentName,
    apiVersion,
    baseUrl,
  ]);

  // Reset modelId when switching providers
  useEffect(() => {
    if (!config?.providerModels) return;

    const providerModels = config.providerModels[selectedProvider];
    if (providerModels && !providerModels[modelId]) {
      const models = Object.keys(providerModels);
      if (models.length > 0) {
        setModelId(models[0]);
      }
    }
  }, [selectedProvider, config?.providerModels, modelId]);

  const buildProviderConfig = useCallback((): ProviderConfig => {
    const base: ProviderConfig = {
      provider: selectedProvider,
      apiKey: apiKey,
    };

    switch (selectedProvider) {
      case "bedrock":
        return { ...base, region, modelId };
      case "openai":
        return { ...base, modelId, baseUrl: baseUrl || undefined };
      case "azure":
        return { ...base, endpoint, deploymentName, apiVersion };
      case "anthropic":
        return { ...base, modelId };
      default:
        return base;
    }
  }, [
    selectedProvider,
    apiKey,
    region,
    modelId,
    endpoint,
    deploymentName,
    apiVersion,
    baseUrl,
  ]);

  const toggleBots = async () => {
    if (!token || !status) return;

    try {
      setToggling(true);
      const endpointPath = status.enabled ? "disable" : "enable";
      const response = await fetch(
        `${API_URL}/api/admin/bots/${endpointPath}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "x-api-key": API_KEY,
          },
        },
      );

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message);
        fetchData();
      } else {
        setError(data.message || "Failed to toggle bots");
      }
    } catch (err) {
      console.error("Failed to toggle bots:", err);
      setError("Failed to toggle bots");
    } finally {
      setToggling(false);
    }
  };

  const testProvider = async () => {
    if (!token) return;

    // Allow testing with existing key if no new key provided
    const hasExistingKey = config?.providerConfig?.hasApiKey;
    if (!apiKey && !hasExistingKey) {
      setError("API key is required to test connection");
      return;
    }

    try {
      setTesting(true);
      const providerConfig = buildProviderConfig();

      const response = await fetch(`${API_URL}/api/admin/bots/test-provider`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ providerConfig }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(data.message);
      } else {
        setError(data.message || "Connection test failed");
      }
    } catch (err) {
      console.error("Failed to test provider:", err);
      setError("Failed to test provider connection");
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    if (!token) return;

    try {
      setSaving(true);

      const body: Record<string, unknown> = {
        maxBots: localMaxBots,
        systemPrompt: localSystemPrompt,
      };

      // If there's an existing provider config and user is on the same provider,
      // send the provider config to update settings (region, model, etc.)
      // even without providing a new API key
      const hasExistingConfig = config?.providerConfig?.hasApiKey;
      const isSameProvider =
        config?.providerConfig?.provider === selectedProvider;

      if (apiKey) {
        // New API key provided - send full config
        body.providerConfig = buildProviderConfig();
      } else if (hasExistingConfig && isSameProvider) {
        // No new API key, but have existing config - send without apiKey
        // Backend will use existing key
        const providerConfig: Record<string, unknown> = {
          provider: selectedProvider,
        };

        // Add provider-specific settings
        switch (selectedProvider) {
          case "bedrock":
            providerConfig.region = region;
            providerConfig.modelId = modelId;
            break;
          case "openai":
            providerConfig.modelId = modelId;
            if (baseUrl) providerConfig.baseUrl = baseUrl;
            break;
          case "azure":
            providerConfig.endpoint = endpoint;
            providerConfig.deploymentName = deploymentName;
            providerConfig.apiVersion = apiVersion;
            break;
          case "anthropic":
            providerConfig.modelId = modelId;
            break;
        }

        body.providerConfig = providerConfig;
      }

      const response = await fetch(`${API_URL}/api/admin/bots/config`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess("Configuration saved successfully");
        setApiKey("");
        setHasChanges(false);
        fetchData();
      } else {
        setError(data.message || "Failed to save configuration");
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      setError("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = async () => {
    if (!token) return;

    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/api/admin/bots/reset-prompt`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-api-key": API_KEY,
        },
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess("System prompt reset to default");
        setLocalSystemPrompt(data.data?.systemPrompt || "");
        fetchData();
      } else {
        setError(data.message || "Failed to reset prompt");
      }
    } catch (err) {
      console.error("Failed to reset prompt:", err);
      setError("Failed to reset prompt");
    } finally {
      setSaving(false);
      setResetDialogOpen(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const providerState: ProviderConfigState = {
    selectedProvider,
    apiKey,
    region,
    modelId,
    endpoint,
    deploymentName,
    apiVersion,
    baseUrl,
  };

  return {
    // State
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

    // Actions
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
  };
}
