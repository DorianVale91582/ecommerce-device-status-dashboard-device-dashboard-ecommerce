import assert from "node:assert/strict";
import { nextDashboardState, deviceUpdate } from "./device_dashboard.ts";

const packed = deviceUpdate.parse({ orderId: "order-7", deviceId: "kiosk-2", status: "packed", customerId: "customer-7" });
assert.deepEqual(nextDashboardState(packed), { orderId: "order-7", label: "Fulfillment packed", live: true });
const delivered = deviceUpdate.parse({ orderId: "order-7", deviceId: "kiosk-2", status: "delivered", customerId: "customer-7" });
assert.equal(nextDashboardState(delivered).live, false);
console.log("device state decision tests passed");
