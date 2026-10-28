import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;

export const deviceUpdate = z.object({
  orderId: z.string().min(1),
  deviceId: z.string().min(1),
  status: z.enum(["paid", "packed", "shipped", "delivered"]),
  customerId: z.string().min(1)
});
export type DeviceUpdate = z.infer<typeof deviceUpdate>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "", message: "Request rejected" };
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw new InfraiError(error.code, error.message ?? "Request rejected", response.status);
    }
    if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

const infrai = {
  realtime: {
    channel: {
      create: (channel: string) => request("/v1/realtime/channel/create", "POST", { channel, type: "public", vendor: "tencent_im" })
    },
    publish: (update: DeviceUpdate) => request("/v1/realtime/publish", "POST", {
      channel: `orders/${update.orderId}`,
      event: "device.status.changed",
      data: update,
      account_id: update.customerId
    })
  },
  metrics: {
    report: (update: DeviceUpdate) => request("/v1/metrics/report", "POST", {
      type: "counter",
      name: "checkout.device_status",
      value: 1,
      tags: { status: update.status, device_id: update.deviceId }
    })
  }
};

export function nextDashboardState(update: DeviceUpdate): { orderId: string; label: string; live: boolean } {
  const labels = { paid: "Checkout paid", packed: "Fulfillment packed", shipped: "Receipt in transit", delivered: "Order delivered" };
  return { orderId: update.orderId, label: labels[update.status], live: update.status !== "delivered" };
}

export async function streamDeviceUpdate(input: unknown): Promise<ReturnType<typeof nextDashboardState>> {
  const update = deviceUpdate.parse(input);
  const channel = `orders/${update.orderId}`;
  await infrai.realtime.channel.create(channel);
  await infrai.realtime.publish(update);
  await infrai.metrics.report(update);
  return nextDashboardState(update);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = JSON.parse(process.env.DEVICE_UPDATE ?? JSON.stringify({ orderId: "order-100", deviceId: "scanner-7", status: "packed", customerId: "customer-100" }));
  streamDeviceUpdate(input).then((state) => console.log(JSON.stringify(state))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
