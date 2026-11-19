import { DEFAULT_ROUTE, ROUTES, type Route } from "./api";

export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#/, "");
  return ROUTES.find((route) => route === name) ?? DEFAULT_ROUTE;
}

export function hashFromRoute(route: Route): string {
  return `#${route}`;
}
