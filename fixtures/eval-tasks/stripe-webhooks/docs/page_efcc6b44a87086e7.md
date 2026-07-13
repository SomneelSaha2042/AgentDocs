# [Mandates](/api/mandates)

Ask about this section

Copy for LLM

View as Markdown

A Mandate is a record of the permission that your customer gives you to debit their payment method.

Was this section helpful?YesNo

[](/api/mandates/retrieve)

Retrieve a Mandate

GET/v1/mandates/:id

# [The Mandate object](/api/mandates/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    customer\_acceptanceobject
    
    Details about the customer’s acceptance of the mandate.
    
    Show child attributes
    
-   #### 
    
    payment\_methodstringExpandable
    
    ID of the payment method associated with this mandate.
    
-   #### 
    
    payment\_method\_detailsobject
    
    Additional mandate information specific to the payment method type.
    
    Show child attributes
    
-   #### 
    
    statusenum
    
    The mandate status indicates whether or not you can use it to initiate a payment.
    
    Possible enum values
    
    `active`
    
    The mandate can be used to initiate a payment.
    
    `inactive`
    
    The mandate was rejected, revoked, or previously used, and may not be used to initiate future payments.
    
    `pending`
    
    The mandate is newly created and is not yet active or inactive.
    
-   #### 
    
    typeenum
    
    The type of the mandate.
    
    Possible enum values
    
    `multi_use`
    
    Represents permission given for multiple payments.
    
    `single_use`
    
    Represents a one-time permission given for a single payment.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    multi\_usenullable object
    
-   #### 
    
    on\_behalf\_ofnullable stringConnect only
    
-   #### 
    
    single\_usenullable object
    

The Mandate object

```
{  "id": "mandate_1MvojA2eZvKYlo2CvqTABjZs",  "object": "mandate",  "customer_acceptance": {    "accepted_at": 123456789,    "online": {      "ip_address": "127.0.0.0",      "user_agent": "device"    },    "type": "online"  },  "livemode": false,  "multi_use": {},  "payment_method": "pm_123456789",  "payment_method_details": {    "sepa_debit": {      "reference": "123456789",      "url": ""    },    "type": "sepa_debit"  },  "status": "active",  "type": "multi_use"}
```

# [Retrieve a Mandate](/api/mandates/retrieve)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/mandates/:id

Retrieves a Mandate object.

### Parameters

No parameters.

### Returns

Returns a Mandate object.

```
curl https://api.stripe.com/v1/mandates/{{MANDATE_ID}} \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "id": "mandate_1MvojA2eZvKYlo2CvqTABjZs",  "object": "mandate",  "customer_acceptance": {    "accepted_at": 123456789,    "online": {      "ip_address": "127.0.0.0",      "user_agent": "device"    },    "type": "online"  },  "livemode": false,  "multi_use": {},  "payment_method": "pm_123456789",  "payment_method_details": {    "sepa_debit": {      "reference": "123456789",      "url": ""    },    "type": "sepa_debit"  },  "status": "active",  "type": "multi_use"}
```
