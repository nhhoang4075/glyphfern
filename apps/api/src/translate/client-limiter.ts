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

export function createClientLimiter(
  limits: ClientLimits,
  now: () => Date = () => new Date(),
): ClientLimiter {
  const usage = new Map<string, Usage>();
  const maxClients = limits.maxClients ?? DEFAULT_MAX_CLIENTS;
  return {
    allow(client, characters) {
      const time = now();
      const minute = Math.floor(time.getTime() / 60_000);
      const day = time.toISOString().slice(0, 10);
      let entry = usage.get(client);
      if (!entry) {
        if (usage.size >= maxClients) {
          const oldest = usage.keys().next().value;
          if (oldest !== undefined) {
            usage.delete(oldest);
          }
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
