import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig } from '../types';

export const config = loadConfig();

function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || 'development';
  const defaultPath = path.join(__dirname, '../../config/default.yaml');
  const envPath = path.join(__dirname, `../../config/${env}.yaml`);

  const defaultConfig = yaml.load(fs.readFileSync(defaultPath, 'utf8')) as AppConfig;
  const envConfig = fs.existsSync(envPath)
    ? (yaml.load(fs.readFileSync(envPath, 'utf8')) as Partial<AppConfig>)
    : {};

  return { ...defaultConfig, ...envConfig } as AppConfig;
}