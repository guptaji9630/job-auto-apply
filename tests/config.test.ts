import { config } from '../src/config';

describe('Config', () => {
  test('loads default.yaml with platform configs', () => {
    expect(config.platforms.linkedin.enabled).toBe(true);
    expect(config.platforms.linkedin.rateLimit.requestsPerMinute).toBe(10);
  });
});