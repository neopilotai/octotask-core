/**
    __                              __           __           
   / /_  __  ______  ___  _________/ /__  ____  / /___  __  __
  / __ \/ / / / __ \/ _ \/ ___/ __  / _ \/ __ \/ / __ \/ / / /
 / / / / /_/ / /_/ /  __/ /  / /_/ /  __/ /_/ / / /_/ / /_/ / 
/_/ /_/\__, / .___/\___/_/   \__,_/\___/ .___/_/\____/\__, /  
      /____/_/                        /_/            /____/   

 * This library is designed for usage inside Firebase Cloud Functions.
 * Client must finish all writes to FS before invoking.
 * Compilation and transit ops handled by consumer libs.
 */

import { deploy } from 'firebase-tools';

interface DeployConfig {
  project: string;
  token: string;
  cwd: string;
  retries?: number;
  timeout?: number;
}

interface DeploymentResult {
  success: boolean;
  duration: number;
  timestamp: string;
  project: string;
}

interface DeploymentError {
  code: string;
  message: string;
  originalError?: Error;
  timestamp: string;
  retryable: boolean;
}

type DeploymentLogger = (
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) => void;

let deploymentLogger: DeploymentLogger = () => {};

/**
 * Set a custom logger for deployment events
 */
export function setDeploymentLogger(logger: DeploymentLogger): void {
  deploymentLogger = logger;
}

/**
 * Validate deployment configuration
 */
function validateConfig(config: DeployConfig): void {
  if (!config) {
    throw createError('INVALID_CONFIG', 'Deploy config is required', false);
  }

  const { project, token, cwd } = config;

  if (!project || typeof project !== 'string') {
    throw createError('INVALID_PROJECT', 'Valid project ID is required', false);
  }
  if (!token || typeof token !== 'string') {
    throw createError(
      'INVALID_TOKEN',
      'Valid authentication token is required',
      false,
    );
  }
  if (!cwd || typeof cwd !== 'string') {
    throw createError(
      'INVALID_CWD',
      'Valid working directory is required',
      false,
    );
  }
}

/**
 * Create a structured deployment error
 */
function createError(
  code: string,
  message: string,
  retryable: boolean,
  originalError?: Error,
): DeploymentError {
  return {
    code,
    message,
    originalError,
    timestamp: new Date().toISOString(),
    retryable,
  };
}

/**
 * Execute deployment with retry logic and error handling
 */
async function executeDeployment(
  config: DeployConfig,
): Promise<DeploymentResult> {
  const startTime = Date.now();
  const originalCwd = process.cwd();

  try {
    deploymentLogger('info', 'Starting Firebase deployment', {
      project: config.project,
    });

    /**
     * Programmatic deploys use source cwd by default.
     * To fix this, we explicitly change cwd on process first.
     */
    process.chdir(config.cwd);

    await deploy({
      project: config.project,
      token: config.token,
      cwd: config.cwd,
    });

    const duration = Date.now() - startTime;
    const result: DeploymentResult = {
      success: true,
      duration,
      timestamp: new Date().toISOString(),
      project: config.project,
    };

    deploymentLogger(
      'info',
      'Firebase deployment completed successfully',
      result as unknown as Record<string, unknown>,
    );
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const isRetryable =
      error instanceof Error &&
      (error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('network'));

    const err = createError(
      'DEPLOYMENT_FAILED',
      error instanceof Error ? error.message : 'Unknown deployment error',
      isRetryable,
      error instanceof Error ? error : undefined,
    );

    deploymentLogger('error', 'Firebase deployment failed', {
      ...err,
      duration,
    });
    throw err;
  } finally {
    // Restore original working directory
    process.chdir(originalCwd);
  }
}

/**
 * Firebase deployments with retry mechanism
 *
 * Tokens can be generated from oAuth or hard coded from `firebase login:ci`.
 * Files in the specified cwd are read & deployed.
 *
 * @param config - Deployment configuration
 * @returns Deployment result with metadata
 * @throws {DeploymentError} If deployment fails
 */
export async function firebaseDeploy(
  config: DeployConfig,
): Promise<DeploymentResult> {
  validateConfig(config);

  const maxRetries = config.retries ?? 3;
  let lastError: DeploymentError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 2), 30000);
        deploymentLogger(
          'info',
          `Retrying deployment (attempt ${attempt}/${maxRetries})`,
          { backoffMs },
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      return await executeDeployment(config);
    } catch (error) {
      lastError = error as DeploymentError;

      if (!lastError.retryable || attempt === maxRetries) {
        deploymentLogger(
          'error',
          `Deployment failed after ${attempt} attempt(s)`,
          { error: lastError },
        );
        throw lastError;
      }
    }
  }

  throw lastError || createError('UNKNOWN_ERROR', 'Deployment failed', false);
}
