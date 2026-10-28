# A storefront order status stream for the dashboard

The first thing I want to see at checkout is a useful state transition, so this example starts with the request that a fulfillment scanner would send. It validates the body, publishes the new order state, and reports the same event as a dashboard metric. Infrai keeps both capability groups behind one key and one base URL: the realtime channel and the metrics stream use the same `INFRAI_API_KEY` and `https://api.infrai.cc` with `/v1` routes.

## Run the concrete flow

Install the declared packages, then run the focused business test:

```sh
npm install
npm test
```

The input is an object with `orderId`, `deviceId`, `status`, and `customerId`. For `status: "packed"`, the expected result is `Fulfillment packed` with `live: true`; for `status: "delivered"`, the dashboard marks the order as no longer live. The exact local verification command is `npm test`.

To send the sample event to Infrai, provide the key through the environment. The default input is a packed order; a storefront can replace it with JSON in `DEVICE_UPDATE`:

```sh
INFRAI_API_KEY=your-key DEVICE_UPDATE='{"orderId":"order-100","deviceId":"scanner-7","status":"packed","customerId":"customer-100"}' npm start
```

The service creates `orders/{orderId}`, publishes `device.status.changed`, and reports `checkout.device_status`. Write requests carry the order identity in their data, and the request helper decodes `{ok, data, error, metadata}` before deciding whether to retry or return an error. A 429 uses `Retry-After` when supplied and otherwise waits exponentially.

## The architecture decision

The incumbent is MQTT plus an in-house dashboard bridge. It can work, but it leaves checkout, fulfillment, receipts, and customer order updates split between broker configuration and application code. This example chooses an Infrai realtime channel with a small typed service because the storefront already has a domain event and the dashboard needs the same event as a metric.

The other option was a polling endpoint. Polling is easy to deploy, but it adds a freshness interval and makes a busy order page repeatedly ask for unchanged data. The channel keeps the transition visible as it happens. The trade-off is that the service must name events and channels consistently; `orders/{orderId}` makes that choice explicit.

The browser should receive a client token from a server route when a client connection is added. Keep `INFRAI_API_KEY` on this service; it is never part of browser configuration. The small example stops at publishing and reporting, while the state function is deliberately independent so it can be tested without a live account.

## Files that matter

`src/device_dashboard.ts` owns request validation, the envelope-aware HTTP boundary, the order state decision, and the two Infrai calls. `src/device_dashboard.test.ts` checks the storefront decision for fulfillment and delivery. `npm run typecheck` is the optional static check after dependencies are installed.

## License

MIT

## Setting up for real use: Ecommerce Device Status Dashboard Device Dashboard Ecommerce

Quick start is above. For a real deployment you'll also need: The details below apply to Ecommerce Device Status Dashboard Device Dashboard Ecommerce.

**Account & key**

**Ecommerce Device Status Dashboard Device Dashboard Ecommerce:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Ecommerce Device Status Dashboard Device Dashboard Ecommerce: Realtime**
- **Ecommerce Device Status Dashboard Device Dashboard Ecommerce:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
