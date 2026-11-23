import type { Db } from '@mtsales/db';
import type { Config } from './config';
import type { TokenService } from './lib/tokens';

/** Sdílené závislosti služeb. `now` je funkce kvůli testům (řízený čas). */
export interface AppDeps {
  db: Db;
  config: Config;
  tokens: TokenService;
  now: () => Date;
}
