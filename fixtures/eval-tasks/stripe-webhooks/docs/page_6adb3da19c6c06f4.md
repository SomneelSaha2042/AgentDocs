# [Capabilities](/api/capabilities)

Ask about this section

Copy for LLM

View as Markdown

This is an object representing a capability for a Stripe account.

Related guide: [Account capabilities](/connect/account-capabilities)

Was this section helpful?YesNo

[](/api/capabilities/update)

Update an Account Capability

POST/v1/accounts/:id/capabilities/:id

[](/api/capabilities/retrieve)

Retrieve an Account Capability

GET/v1/accounts/:id/capabilities/:id

[](/api/capabilities/list)

List all account capabilities

GET/v1/accounts/:id/capabilities

# [The Capability object](/api/capabilities/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    The identifier for the capability.
    
-   #### 
    
    accountstringExpandable
    
    The account for which the capability enables functionality.
    
-   #### 
    
    requestedboolean
    
    Whether the capability has been requested.
    
-   #### 
    
    requirementsobject
    
    Information about the requirements for the capability, including what information needs to be collected, and by when.
    
    Show child attributes
    
-   #### 
    
    statusenum
    
    The status of the capability.
    
    Possible enum values
    
    `active`
    
    The capability is active.
    
    `inactive`
    
    The capability is inactive.
    
    `pending`
    
    The capability is inactive with requirements pending verification.
    
    `unrequested`
    
    The capability is unrequested.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    future\_requirementsobject
    
-   #### 
    
    requested\_atnullable timestamp
    

The Capability object

```
{  "id": "card_payments",  "object": "capability",  "account": "acct_1032D82eZvKYlo2C",  "future_requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "requested": true,  "requested_at": 1688491010,  "requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "status": "inactive"}
```

# [Update an Account Capability](/api/capabilities/update)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/accounts/:id/capabilities/:id

Updates an existing Account Capability. Request or remove a capability by updating its `requested` parameter.

### Parameters

-   #### 
    
    requestedboolean
    
    To request a new capability for an account, pass true. There can be a delay before the requested capability becomes active. If the capability has any activation requirements, the response includes them in the `requirements` arrays.
    
    If a capability isn’t permanent, you can remove it from the account by passing false. Some capabilities are permanent after they’ve been requested. Attempting to remove a permanent capability returns an error.
    

### More parameters

Expand all

-   #### 
    
    previewbooleanPreview feature
    

### Returns

Returns an Account Capability object.

```
curl https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}}/capabilities/card_payments \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d requested=true
```

Response

```
{  "id": "card_payments",  "object": "capability",  "account": "acct_1032D82eZvKYlo2C",  "future_requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "requested": true,  "requested_at": 1688491010,  "requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "status": "inactive"}
```
