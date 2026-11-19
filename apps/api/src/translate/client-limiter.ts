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
const OVERFLOW_SHARE = 4;

function dottedToGroups(address: string): string | undefined {
  const lastColon = address.lastIndexOf(":");
  const quad = address.slice(lastColon + 1).split(".");
  if (quad.length !== 4 || quad.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    return undefined;
  }
  const [a = 0, b = 0, c = 0, d = 0] = quad.map(Number);
  const high = ((a << 8) | b).toString(16);
  const low = ((c << 8) | d).toString(16);
  return `${address.slice(0, lastColon + 1)}${high}:${low}`;
}

function expandIpv6(address: string): number[] | undefined {
  const parts = address.split("::");
  if (parts.length > 2) {
    return undefined;
  }
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts[1] ? parts[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (parts.length === 1 ? left.length !== 8 : missing < 1) {
    return undefined;
  }
  const groups = [...left, ...Array(parts.length === 1 ? 0 : missing).fill("0"), ...right];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return undefined;
  }
  return groups.map((group) => Number.parseInt(group, 16));
}

function ipv4Of(groups: readonly number[]): string {
  const [high = 0, low = 0] = groups.slice(6);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function embeddedIpv4(groups: readonly number[]): string | undefined {
  const zeroPrefix = groups.slice(0, 5).every((group) => group === 0);
  if (zeroPrefix && groups[5] === 0xffff) {
    return ipv4Of(groups);
  }
  const compat = groups.slice(0, 6).every((group) => group === 0);
  const loopbackOrAny = groups[6] === 0 && (groups[7] === 0 || groups[7] === 1);
  if (compat && !loopbackOrAny) {
    return ipv4Of(groups);
  }
  const nat64 =
    groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
  if (nat64) {
    return ipv4Of(groups);
  }
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups[2] === 1) {
    return ipv4Of(groups);
  }
  return undefined;
}

export function normalizeClient(address: string): string {
  if (!address.includes(":")) {
    return address;
  }
  const bare = address.toLowerCase().replace(/%.*$/, "");
  const converted = bare.includes(".") ? dottedToGroups(bare) : bare;
  const groups = converted ? expandIpv6(converted) : undefined;
  if (!groups) {
    return address;
  }
  const embedded = embeddedIpv4(groups);
  if (embedded) {
    return embedded;
  }
  const hex = (group: number) => group.toString(16).padStart(4, "0");
  const first = groups[0] ?? 0;
  if (first >= 0x2000 && first <= 0x3fff) {
    return `${groups.slice(0, 4).map(hex).join(":")}::/64`;
  }
  return groups.map(hex).join(":");
}

function charge(
  entry: Usage,
  minute: number,
  day: string,
  characters: number,
  requestCap: number,
  characterCap: number,
): boolean {
  if (entry.minute !== minute) {
    entry.minute = minute;
    entry.requests = 0;
  }
  if (entry.day !== day) {
    entry.day = day;
    entry.characters = 0;
  }
  if (entry.requests + 1 > requestCap || entry.characters + characters > characterCap) {
    return false;
  }
  entry.requests += 1;
  entry.characters += characters;
  return true;
}

export function createClientLimiter(
  limits: ClientLimits,
  now: () => Date = () => new Date(),
): ClientLimiter {
  const usage = new Map<string, Usage>();
  const maxClients = limits.maxClients ?? DEFAULT_MAX_CLIENTS;
  const overflow: Usage = { minute: 0, requests: 0, day: "", characters: 0 };
  const overflowRequests = Math.max(1, limits.requestsPerMinute * OVERFLOW_SHARE);
  const overflowCharacters = limits.charactersPerDay * OVERFLOW_SHARE;
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
          return charge(overflow, minute, day, characters, overflowRequests, overflowCharacters);
        }
        entry = { minute, requests: 0, day, characters: 0 };
        usage.set(client, entry);
      }
      return charge(
        entry,
        minute,
        day,
        characters,
        limits.requestsPerMinute,
        limits.charactersPerDay,
      );
    },
  };
}
