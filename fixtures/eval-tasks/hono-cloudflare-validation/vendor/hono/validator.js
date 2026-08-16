export function validator(target, validate) {
  return async (c) => {
    const value = target === 'json' ? await c.req.json() : undefined;
    const result = await validate(value, c);
    if (result && typeof result.json === 'function' && 'status' in result) return result;
    c.setValid(target, result);
    return undefined;
  };
}