import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig, PlatformConfig } from '../types';

export const config = loadConfig();

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Deep merge nested objects
      (result as any)[key] = deepMerge(targetValue, sourceValue);
    } else if (sourceValue !== undefined) {
      // Override primitive values and arrays
      (result as any)[key] = sourceValue;
    }
  }
  
  return result;
}

function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  const defaultPath = path.join(__dirname, '../../config/default.yaml');
  const envPath = path.join(__dirname, `../../config/${env}.yaml`);

  const defaultConfig = yaml.load(fs.readFileSync(defaultPath, 'utf8')) as AppConfig;
  const envConfig = fs.existsSync(envPath)
    ? (yaml.load(fs.readFileSync(envPath, 'utf8')) as Partial<AppConfig>)
    : {};

  // Deep merge to preserve nested platform config
  const merged = deepMerge(defaultConfig, envConfig);
  
  // Ensure all platform configs are complete (merge with defaults per platform)
  if (merged.platforms && defaultConfig.platforms) {
    for (const platform of Object.keys(merged.platforms) as (keyof typeof merged.platforms)[]) {
      if (defaultConfig.platforms[platform]) {
        merged.platforms[platform] = deepMerge(
          defaultConfig.platforms[platform],
          merged.platforms[platform]
        ) as PlatformConfig;
      }
    }
  }

  return merged;
}