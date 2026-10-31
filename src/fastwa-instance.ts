import { FastwaFactory } from 'fastwa';
import { MetaAdapter } from '@fastwa/meta';

import { FastwaNextOptions, NextFastwaApplication } from './interfaces';

export interface FastwaInstance {
  readonly adapter: MetaAdapter;
  /**
   * Starts the application on first use. A failed start is retried on the
   * next call.
   */
  start(): Promise<NextFastwaApplication>;
  /**
   * Closes the application. A closed instance can't be started again.
   */
  close(): Promise<void>;
}

export function createInstance(
  module: any,
  options: FastwaNextOptions
): FastwaInstance {
  const { setup, ...adapterOptions } = options;
  const adapter = new MetaAdapter({ ...adapterOptions, server: false });

  let app: Promise<NextFastwaApplication> | undefined;
  let closing: Promise<void> | undefined;

  const bootstrap = async () => {
    const instance = await FastwaFactory.create(module, adapter);

    try {
      await setup?.(instance);
      return await instance.listen();
    } catch (error) {
      // Keep the bootstrap error, not one from closing
      await instance.close().catch(() => undefined);
      throw error;
    }
  };

  const start = () => {
    if (closing) {
      return Promise.reject(new Error('The fastwa application was closed'));
    }

    return (app ??= bootstrap().catch((error) => {
      app = undefined;
      throw error;
    }));
  };

  const close = () =>
    (closing ??= (async () => {
      const started = await app?.catch(() => undefined);
      await started?.close();
    })());

  return { adapter, start, close };
}
