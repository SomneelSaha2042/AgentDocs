# Migrating from v3 to v4

In v4, mutations use a positional argument API. If you are reading this, you are on v4.

```tsx
import { useMutation } from 'react-query'

// The first argument is the mutation function, the second is options
return useMutation(updateTodo, {
  onMutate: (newTodo) => {
    // ...
  }
})
```

> **Warning:** This API is deprecated in v5. Do not use positional arguments in v5.
