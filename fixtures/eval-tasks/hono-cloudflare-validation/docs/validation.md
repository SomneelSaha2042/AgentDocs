# Validate JSON bodies

Hono validates request bodies with middleware from `hono/validator`.

```ts
import { validator } from 'hono/validator'

app.post('/users', validator('json', (value, c) => {
  if (typeof value.username !== 'string' || value.username.length < 3) {
    return c.json({ error: 'invalid username' }, 400)
  }
  if (typeof value.age !== 'number' || value.age < 18) {
    return c.json({ error: 'invalid age' }, 400)
  }
  return value
}), (c) => {
  const user = c.req.valid('json')
  return c.json({ id: `user_${user.username}`, ...user }, 201)
})
```

`validator('json', callback)` stores the returned value on `c.req.valid('json')` for the route handler. Returning a response from the validator stops the handler and sends that response.
