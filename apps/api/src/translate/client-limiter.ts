export interface ClientLimiter {
  allow(client: string, characters: number): boolean;
}

export interface ClientLimits {
  requestsPerMinute: number;
  charactersPerDay: number;
  maxClients?: number;
}

interface Usage {
  minute: number;
  requests: number;
  day: string;
  characters: number;
}

const DEFAULT_MAX_CLIENTS = 10_000;
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

function expandIpv6(address: string): string[] | undefined {
  const [head = "", tail, extra] = address.split("::");
  if (extra !== undefined) {
    return undefined;
  }
  const left = head === "" ? [] : head.split(":");
  const right = tail === undefined || tail === "" ? [] : tail.split(":");
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? left.length !== 8 : missing < 0) {
    return undefined;
  }
  return [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right];
}

export function normalizeClient(address: string): string {
  const mapped = IPV4_MAPPED.exec(address);
  if (mapped?.[1]) {
    return mapped[1];
  }
  if (!address.includes(":")) {
    return address;
  }
  const groups = expandIpv6(address.toLowerCase().replace(/%.*$/, ""));
  if (!groups || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return address;
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, "0"))
    .join(":")}::/64`;
}

export function createClientLimiter(
  limits: ClientLimits,
  now: () => Date = () => new Date(),
): ClientLimiter {
  const usage = new Map<string, Usage>();
  const maxClients = limits.maxClients ?? DEFAULT_MAX_CLIENTS;
  return {
    allow(rawClient, characters) {
      const client = normalizeClient(rawClient);
      const time = now();
      const minute = Math.floor(time.getTime() / 60_000);
      const day = time.toISOString().slice(0, 10);
      let entry = usage.get(client);
      if (!entry) {
        if (usage.size >= maxClients) {
          for (const [key, value] of usage) {
            if (value.day !== day) {
              usage.delete(key);
            }
          }
        }
        if (usage.size >= maxClients) {
          return false;
        }
        entry = { minute, requests: 0, day, characters: 0 };
        usage.set(client, entry);
      }
      if (entry.minute !== minute) {
        entry.minute = minute;
        entry.requests = 0;
      }
      if (entry.day !== day) {
        entry.day = day;
        entry.characters = 0;
      }
      if (
        entry.requests + 1 > limits.requestsPerMinute ||
        entry.characters + characters > limits.charactersPerDay
      ) {
        return false;
      }
      entry.requests += 1;
      entry.characters += characters;
      return true;
    },
  };
}
