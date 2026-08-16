class JsonResponse {
  constructor(body, status = 200) {
    this.status = status;
    this.body = JSON.stringify(body);
  }
  async json() { return JSON.parse(this.body); }
}

function pathFor(input) {
  return typeof input === 'string' ? input : new URL(input.url).pathname;
}

export class Hono {
  constructor() { this.routes = []; }
  get(path, ...handlers) { this.routes.push({ method: 'GET', path, handlers }); return this; }
  post(path, ...handlers) { this.routes.push({ method: 'POST', path, handlers }); return this; }
  async request(path, init = {}) {
    const method = (init.method ?? 'GET').toUpperCase();
    const route = this.routes.find((candidate) => candidate.method === method && candidate.path === pathFor(path));
    if (!route) return new JsonResponse({ error: 'not found' }, 404);
    const state = new Map();
    const req = {
      async json() { return init.body === undefined ? undefined : JSON.parse(init.body); },
      valid(key) { return state.get(key); },
    };
    const c = {
      req,
      setValid(key, value) { state.set(key, value); },
      json(body, status = 200) { return new JsonResponse(body, status); },
    };
    for (const handler of route.handlers) {
      const result = await handler(c);
      if (result instanceof JsonResponse) return result;
    }
    return new JsonResponse({ error: 'handler returned no response' }, 500);
  }
  fetch(request) { return this.request(request); }
}