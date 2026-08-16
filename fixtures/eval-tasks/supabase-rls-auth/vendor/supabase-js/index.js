export function createClient(url, key, options = {}) {
  return {
    __url: url,
    __key: key,
    __options: options,
    from(table) {
      const query = [['from', table]];
      return {
        select(columns) { query.push(['select', columns]); return this; },
        eq(column, value) { query.push(['eq', column, value]); return this; },
        async single() { query.push(['single']); return { data: { __query: query }, error: null, __query: query }; },
      };
    },
  };
}