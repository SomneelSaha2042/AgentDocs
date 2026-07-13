# [Customer Session](/api/customer_sessions)

Ask about this section

Copy for LLM

View as Markdown

A Customer Session allows you to grant Stripe’s frontend SDKs (like Stripe.js) client-side access control over a Customer.

Related guides: [Customer Session with the Payment Element](/payments/accept-a-payment-deferred?platform=web&type=payment#save-payment-methods), [Customer Session with the Pricing Table](/payments/checkout/pricing-table#customer-session), [Customer Session with the Buy Button](/payment-links/buy-button#pass-an-existing-customer).

Was this section helpful?YesNo

[](/api/customer_sessions/create)

Create a Customer Session

POST/v1/customer\_sessions

# [The Customer Session object](/api/customer_sessions/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    client\_secretstring
    
    The client secret of this Customer Session. Used on the client to set up secure access to the given `customer`.
    
    The client secret can be used to provide access to `customer` from your frontend. It should not be stored, logged, or exposed to anyone other than the relevant customer. Make sure that you have TLS enabled on any page that includes the client secret.
    
-   #### 
    
    componentsobject
    
    This hash defines which component is enabled and the features it supports.
    
    Show child attributes
    
-   #### 
    
    customerstringExpandable
    
    The Customer the Customer Session was created for.
    
-   #### 
    
    expires\_attimestamp
    
    The timestamp at which this Customer Session will expire.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    customer\_accountnullable string
    
-   #### 
    
    livemodeboolean
    

The Customer Session object

```
{  "object": "customer_session",  "client_secret": "_POpxYpmkXdtttYtZQYhrsOJZ2RCQ9kCqqXRU6qrP5c4Jgje",  "components": {    "buy_button": {      "enabled": false    },    "pricing_table": {      "enabled": true    }  },  "customer": "cus_PO34b57IOUb83c",  "expires_at": 1684790027,  "livemode": false}
```

# [Create a Customer Session](/api/customer_sessions/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/customer\_sessions

Creates a Customer Session object that includes a single-use client secret that you can use on your front-end to grant client-side API access for certain customer resources.

### Parameters

-   #### 
    
    componentsobjectRequired
    
    Configuration for each component. At least 1 component must be enabled.
    
    Show child parameters
    
-   #### 
    
    customerstring
    
    The ID of an existing customer for which to create the Customer Session.
    

### More parameters

Expand all

-   #### 
    
    customer\_accountstring
    

### Returns

Returns a Customer Session object.

```
curl https://api.stripe.com/v1/customer_sessions \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d customer={{CUSTOMER_ID}} \  -d "components[pricing_table][enabled]=true"
```

Response

```
{  "object": "customer_session",  "client_secret": "_POpxYpmkXdtttYtZQYhrsOJZ2RCQ9kCqqXRU6qrP5c4Jgje",  "components": {    "buy_button": {      "enabled": false    },    "pricing_table": {      "enabled": true    }  },  "customer": "cus_PO34b57IOUb83c",  "expires_at": 1684790027,  "livemode": false}
```
