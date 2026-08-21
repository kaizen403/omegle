/**
 * Bot Admin Routes
 * Controls AI chat bot system with multi-provider support
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { adminService } from '../../services/admin';
import { ProviderConfig, AIProvider } from '../../services/bots/types';

const router = Router();

/**
 * GET /api/admin/bots/status
 * Get current bot system status
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    const status = botHandler.getStatus();

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get bot status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bot status',
    });
  }
});

/**
 * GET /api/admin/bots/config
 * Get current bot configuration including provider info
 */
router.get('/config', requireAuth, async (req, res) => {
  try {
    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    const config = botHandler.getConfig();

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get bot config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bot config',
    });
  }
});

/**
 * GET /api/admin/bots/list
 * Get list of all bots
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    const bots = botHandler.getAllBots();

    return res.json({
      success: true,
      data: bots,
    });
  } catch (error) {
    console.error('Get bots list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bots list',
    });
  }
});

/**
 * POST /api/admin/bots/enable
 * Enable the bot system
 */
router.post('/enable', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can enable bots',
      });
    }

    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    const result = await botHandler.enableBots();

    return res.json({
      success: result.success,
      message: result.message,
      data: {
        botCount: result.botCount,
      },
    });
  } catch (error) {
    console.error('Enable bots error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to enable bots',
    });
  }
});

/**
 * POST /api/admin/bots/disable
 * Disable the bot system
 */
router.post('/disable', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can disable bots',
      });
    }

    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    const result = await botHandler.disableBots();

    return res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('Disable bots error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disable bots',
    });
  }
});

/**
 * PUT /api/admin/bots/config
 * Update bot configuration (maxBots, systemPrompt, providerConfig)
 * If providerConfig is provided without apiKey, uses existing key if available
 */
router.put('/config', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { maxBots, systemPrompt } = req.body;
    let { providerConfig } = req.body;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can configure bots',
      });
    }

    if (maxBots !== undefined && (typeof maxBots !== 'number' || maxBots < 1 || maxBots > 50)) {
      return res.status(400).json({
        success: false,
        message: 'maxBots must be between 1 and 50',
      });
    }

    if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'systemPrompt must be a string',
      });
    }

    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();

    // Validate provider config if provided
    if (providerConfig) {
      const validProviders: AIProvider[] = ['bedrock', 'openai', 'azure', 'anthropic'];
      if (!validProviders.includes(providerConfig.provider)) {
        return res.status(400).json({
          success: false,
          message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
        });
      }

      // If no API key provided, try to use existing one
      if (!providerConfig.apiKey) {
        const existingConfig = botHandler.getExistingProviderConfig();
        if (existingConfig && existingConfig.provider === providerConfig.provider) {
          // Use existing API key when provider is the same
          providerConfig = {
            ...providerConfig,
            apiKey: existingConfig.apiKey,
          };
        } else if (!existingConfig) {
          return res.status(400).json({
            success: false,
            message: 'API key is required for new provider configuration',
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'API key is required when changing providers',
          });
        }
      }

      // Provider-specific validation
      if (providerConfig.provider === 'bedrock') {
        if (!providerConfig.region) {
          return res.status(400).json({
            success: false,
            message: 'Region is required for AWS Bedrock',
          });
        }
        if (!providerConfig.modelId) {
          return res.status(400).json({
            success: false,
            message: 'Model ID is required for AWS Bedrock',
          });
        }
      }

      if (providerConfig.provider === 'openai') {
        if (!providerConfig.modelId) {
          return res.status(400).json({
            success: false,
            message: 'Model ID is required for OpenAI',
          });
        }
      }

      if (providerConfig.provider === 'azure') {
        if (!providerConfig.endpoint) {
          return res.status(400).json({
            success: false,
            message: 'Endpoint is required for Azure OpenAI',
          });
        }
        if (!providerConfig.deploymentName) {
          return res.status(400).json({
            success: false,
            message: 'Deployment name is required for Azure OpenAI',
          });
        }
        if (!providerConfig.apiVersion) {
          providerConfig.apiVersion = '2024-02-15-preview';
        }
      }

      if (providerConfig.provider === 'anthropic') {
        if (!providerConfig.modelId) {
          return res.status(400).json({
            success: false,
            message: 'Model ID is required for Anthropic',
          });
        }
      }
    }

    // Update config (persists to Neon)
    await botHandler.updateConfig({ maxBots, systemPrompt, providerConfig });

    const config = botHandler.getConfig();
    const status = botHandler.getStatus();

    return res.json({
      success: true,
      message: 'Bot configuration updated',
      data: {
        config,
        status,
      },
    });
  } catch (error) {
    console.error('Update bot config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bot configuration',
    });
  }
});

/**
 * POST /api/admin/bots/test-provider
 * Test connection to a provider without saving
 * If no apiKey provided, use existing configured key
 */
router.post('/test-provider', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    let { providerConfig } = req.body;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can test providers',
      });
    }

    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();

    // If no apiKey provided, use existing config (for testing existing key)
    if (!providerConfig?.apiKey) {
      const existingConfig = botHandler.getExistingProviderConfig();
      if (!existingConfig) {
        return res.status(400).json({
          success: false,
          message: 'No existing API key configured. Please provide an API key.',
        });
      }
      // Use existing config with any new settings overridden
      providerConfig = {
        ...existingConfig,
        ...providerConfig,
        apiKey: existingConfig.apiKey, // Always use existing key if not provided
      };
    }

    if (!providerConfig.provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required',
      });
    }

    const result = await botHandler.testProvider(providerConfig as ProviderConfig);

    return res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error('Test provider error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to test provider connection',
    });
  }
});

/**
 * POST /api/admin/bots/reset-prompt
 * Reset system prompt to default
 */
router.post('/reset-prompt', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can reset system prompt',
      });
    }

    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    await botHandler.resetSystemPrompt();

    const config = botHandler.getConfig();

    return res.json({
      success: true,
      message: 'System prompt reset to default',
      data: { systemPrompt: config.systemPrompt },
    });
  } catch (error) {
    console.error('Reset system prompt error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset system prompt',
    });
  }
});

/**
 * POST /api/admin/bots/test-chat
 * Test chat with the bot using the current configuration
 */
router.post('/test-chat', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { message, conversationHistory } = req.body;

    const isSuperAdmin = await adminService.verifySuperAdmin(user.uid);
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can test chat',
      });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
      });
    }

    const socketManager = adminService.getSocketIOManager();
    if (!socketManager) {
      return res.status(500).json({
        success: false,
        message: 'Socket manager not initialized',
      });
    }

    const botHandler = socketManager.getBotHandler();
    const status = botHandler.getStatus();

    if (!status.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Bot system is not enabled. Please enable bots first.',
      });
    }

    // Use the test chat function from bot handler
    const response = await botHandler.testChat(message, conversationHistory || []);

    return res.json({
      success: true,
      data: { response },
    });
  } catch (error) {
    console.error('Test chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bot response',
    });
  }
});

export default router;
