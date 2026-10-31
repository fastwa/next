# @fastwa/next

Runs a [fastwa](https://www.npmjs.com/package/fastwa) WhatsApp Cloud API bot inside a [Next.js](https://nextjs.org) app, with the App Router: the webhook is a route handler instead of the server started by [`@fastwa/meta`](https://www.npmjs.com/package/@fastwa/meta). The route uses the Fetch API handler of `@fastwa/meta` (`adapter.webhooks.handler`), with the application started on demand and the handlers run with `after()`.

```bash
npm install fastwa @fastwa/meta @fastwa/next reflect-metadata
```

Requires Next.js 15.1 or later.

## Setup

Enable decorators and their metadata in `tsconfig.json`; Next.js compiles them with SWC, which reads these options:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Create the application in `lib/fastwa.ts` with `fastwa()`. It takes the module and the options of `MetaAdapter`, except `path` and `server`:

```ts
// lib/fastwa.ts
import 'server-only';

import { fastwa } from '@fastwa/next';

import { WebhookModule } from '@/webhook.module';

export const whatsapp = fastwa(WebhookModule, {
  verifyToken: process.env.META_VERIFY_TOKEN!,
  appSecret: process.env.META_APP_SECRET!,
  accessToken: process.env.META_ACCESS_TOKEN!
});
```

`server-only` makes the build fail if a client component imports it, which would expose the secrets.

Then export its handlers from a route. The webhook is served at the route's path, here `/api/webhook`:

```ts
// app/api/webhook/route.ts
import { whatsapp } from '@/lib/fastwa';

export const { GET, POST } = whatsapp;
```

`whatsapp` also has `adapter`, `getApp()` and `close()`. A route can only export its handlers, so keeping the application in `lib/fastwa.ts` lets the rest of the app use it (see [Sending messages](#sending-messages)).

Modules, controllers, guards and pipes are written as in any fastwa app. With `isolatedModules`, which Next.js enables, types used in decorated signatures must be imported with `import type`:

```ts
import { Contact } from '@fastwa/meta';
import type { MetaContact } from '@fastwa/meta';

@Command('hello')
hello(@Contact() contact?: MetaContact) {}
```

| Option            | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `verifyToken`     | Token checked when Meta verifies the webhook                                                                |
| `appSecret`       | App secret, used to check the `X-Hub-Signature-256` header of every event                                   |
| `accessToken`     | Token with the `whatsapp_business_messaging` permission, used to send messages                              |
| `phoneNumberId`   | Business number `sendMessage()` sends from by default                                                       |
| `graphApiVersion` | Defaults to `v23.0`                                                                                         |
| `setup`           | `(app) => void`, runs before the application starts, e.g. to call `app.useGlobalPipes()`                    |

## How it works

`GET` answers Meta's verification with the `verifyToken` alone. `POST` reads the event and checks its signature first, and rejects invalid requests (`401`, `400`, `413`) without starting the application. The application is created and started with the first valid event (or the first `getApp()` call), and reused by the following ones; if it fails to start, the event is answered with an error so Meta delivers it again.

Each `fastwa()` call has its own application. In development, the module that calls it is evaluated again when its code changes, so a new application takes over and edits take effect without restarting `next dev`. The previous one is not closed: if it keeps something running (e.g. timers started in `onModuleInit`), close it yourself:

```ts
// lib/fastwa.ts
const globalForFastwa = globalThis as { whatsapp?: FastwaNext };

void globalForFastwa.whatsapp?.close();

export const whatsapp = (globalForFastwa.whatsapp = fastwa(WebhookModule, {
  // ...
}));
```

Valid events are acknowledged right away, and the handlers run after the response with [`after()`](https://nextjs.org/docs/app/api-reference/functions/after), so slow handlers do not make Meta retry them.

The route must use the Node.js runtime (the default): signatures are checked with `node:crypto`.

## Sending messages

`whatsapp.adapter` is the `MetaAdapter`, e.g. to send from a server action:

```ts
// app/actions.ts
'use server';

import { whatsapp } from '@/lib/fastwa';

export async function notify(to: string) {
  await whatsapp.adapter.sendMessage(to, 'Your order has shipped 📦');
}
```

Sending does not start the application: `sendMessage()` only calls the Graph API.

## Serverless

Each server instance has its own application. On serverless platforms, state kept in memory is lost between invocations and is not shared between instances: collectors (`awaitMessage()`) only see messages that reach the same instance, and `@Cron` jobs from `@fastwa/schedule` do not run between requests. Keep conversation state in a database, and use the platform's cron jobs instead.

## License

MIT
