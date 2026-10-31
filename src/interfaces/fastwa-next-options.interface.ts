import type { AdapterListenArgs, IFastwaApplication } from 'fastwa';
import type { MetaAdapter, MetaAdapterOptions } from '@fastwa/meta';

export type NextFastwaApplication = IFastwaApplication<
  AdapterListenArgs<MetaAdapter>
>;

/**
 * Options of `MetaAdapter`, except `path` and `server`: the webhook is
 * served by the route handler, at its path
 */
export interface FastwaNextOptions
  extends Omit<MetaAdapterOptions, 'path' | 'server'> {
  /**
   * Runs once, before the application starts, e.g. to call
   * `app.useGlobalPipes()`
   */
  setup?: (app: NextFastwaApplication) => void | Promise<void>;
}
