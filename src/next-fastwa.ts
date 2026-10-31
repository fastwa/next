import { after } from 'next/server';
import { MetaAdapter } from '@fastwa/meta';

import { createInstance } from './fastwa-instance';
import { FastwaNextOptions, NextFastwaApplication } from './interfaces';

export type NextRouteHandler = (request: Request) => Promise<Response>;

export interface FastwaNext {
  /**
   * Route handler that answers Meta's verification
   */
  GET: NextRouteHandler;
  /**
   * Route handler that receives the events. The application starts with the
   * first event whose signature is valid.
   */
  POST: NextRouteHandler;
  /**
   * The application, created and started on first use
   */
  getApp(): Promise<NextFastwaApplication>;
  /**
   * Closes the application, if it was started. The handlers can't start it
   * again.
   */
  close(): Promise<void>;
  /**
   * The adapter, e.g. to call `sendMessage()` from a server action
   */
  readonly adapter: MetaAdapter;
}

/**
 * Creates a fastwa application that receives the webhook in a Next.js route
 * handler. The application is created and started with the first valid
 * event (or the first `getApp()` call).
 *
 * For example, in `app/api/webhook/route.ts`:
 * ```typescript
 * export const { GET, POST } = fastwa(AppModule, {
 *   verifyToken: process.env.META_VERIFY_TOKEN!,
 *   appSecret: process.env.META_APP_SECRET!,
 *   accessToken: process.env.META_ACCESS_TOKEN!
 * });
 * ```
 *
 * @param module Entry application module class
 *
 * @publicApi
 */
export function fastwa(module: any, options: FastwaNextOptions): FastwaNext {
  const { adapter, start, close } = createInstance(module, options);

  const handler: NextRouteHandler = (request) =>
    adapter.webhooks.handler(request, { waitUntil: after, ready: start });

  return { GET: handler, POST: handler, getApp: start, close, adapter };
}
