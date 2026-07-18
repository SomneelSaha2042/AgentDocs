# [Secrets](/api/secret_management)

Ask about this section

Copy for LLM

View as Markdown

Secret Store is an API that allows Stripe Apps developers to securely persist secrets for use by UI Extensions and app backends.

The primary resource in Secret Store is a `secret`. Other apps can’t view secrets created by an app. Additionally, secrets are scoped to provide further permission control.

All Dashboard users and the app backend share `account` scoped secrets. Use the `account` scope for secrets that don’t change per-user, like a third-party API key.

A `user` scoped secret is accessible by the app backend and one specific Dashboard user. Use the `user` scope for per-user secrets like per-user OAuth tokens, where different users might have different permissions.

Related guide: [Store data between page reloads](/stripe-apps/store-auth-data-custom-objects)

Was this section helpful?YesNo

[](/api/apps/secret_store/list)

List secrets

GET/v1/apps/secrets

[](/api/apps/secret_store/delete)

Delete a Secret

POST/v1/apps/secrets/delete

[](/api/apps/secret_store/find)

Find a Secret

GET/v1/apps/secrets/find

[](/api/apps/secret_store/set)

Set a Secret

POST/v1/apps/secrets

# [The Secret object](/api/apps/secret_store/secret_resource)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    objectstring
    
    String representing the object’s type. Objects of the same type share the same value.
    
-   #### 
    
    createdtimestamp
    
    Time at which the object was created. Measured in seconds since the Unix epoch.
    
-   #### 
    
    deletednullable boolean
    
    If true, indicates that this secret has been deleted
    
-   #### 
    
    expires\_atnullable timestamp
    
    The Unix timestamp for the expiry time of the secret, after which the secret deletes.
    
-   #### 
    
    livemodeboolean
    
    If the object exists in live mode, the value is `true`. If the object exists in test mode, the value is `false`.
    
-   #### 
    
    namestring
    
    A name for the secret that’s unique within the scope.
    
-   #### 
    
    payloadnullable stringExpandable
    
    The plaintext secret value to be stored.
    
-   #### 
    
    scopeobject
    
    Specifies the scoping of the secret. Requests originating from UI extensions can only access account-scoped secrets or secrets scoped to their own user.
    
    Show child attributes
    

The Secret object

```
{  "id": "appsecret_5110hHS1707T6fjBnah1LkdIwHu7ix",  "object": "apps.secret",  "created": 1680209063,  "expires_at": null,  "livemode": false,  "name": "my-api-key",  "scope": {    "type": "account"  }}
```

# [List secrets](/api/apps/secret_store/list)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/apps/secrets

List all secrets stored on the given scope.

### Parameters

-   #### 
    
    scopeobjectRequired
    
    Specifies the scoping of the secret. Requests originating from UI extensions can only access account-scoped secrets or secrets scoped to their own user.
    
    Show child parameters
    

### More parameters

Expand all

-   #### 
    
    ending\_beforestring
    
-   #### 
    
    limitinteger
    
-   #### 
    
    starting\_afterstring
    

### Returns

A dictionary with a `data` property that contains an array of up to `limit` Secrets, starting after Secret `starting_after`. Each entry in the array is a separate Secret object. If no more Secrets are available, the resulting array will be empty.

```
curl -G https://api.stripe.com/v1/apps/secrets \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "scope[type]=account"
```

Response

```
{  "object": "list",  "url": "/v1/apps/secrets",  "has_more": false,  "data": [    {      "id": "appsecret_5110hHS1707T6fjBnah1LkdIwHu7ix",      "object": "apps.secret",      "created": 1680209063,      "expires_at": null,      "livemode": false,      "name": "my-api-key",      "scope": {        "type": "account"      }    }  ]}
```
