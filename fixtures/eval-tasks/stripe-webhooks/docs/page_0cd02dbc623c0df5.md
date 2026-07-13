# [Payment Method Domains](/api/payment_method_domains)

Ask about this section

Copy for LLM

View as Markdown

A payment method domain represents a web domain that you have registered with Stripe. Stripe Elements use registered payment method domains to control where certain payment methods are shown.

Related guide: [Payment method domains](/payments/payment-methods/pmd-registration).

Was this section helpful?YesNo

[](/api/payment_method_domains/create)

Create a payment method domain

POST/v1/payment\_method\_domains

[](/api/payment_method_domains/update)

Update a payment method domain

POST/v1/payment\_method\_domains/:id

[](/api/payment_method_domains/retrieve)

Retrieve a payment method domain

GET/v1/payment\_method\_domains/:id

[](/api/payment_method_domains/list)

List payment method domains

GET/v1/payment\_method\_domains

[](/api/payment_method_domains/validate)

Validate an existing payment method domain

POST/v1/payment\_method\_domains/:id/validate

# [The PaymentMethodDomain object](/api/payment_method_domains/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    domain\_namestring
    
    The domain name that this payment method domain object represents.
    
-   #### 
    
    enabledboolean
    
    Whether this payment method domain is enabled. If the domain is not enabled, payment methods that require a payment method domain will not appear in Elements.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    amazon\_payobject
    
-   #### 
    
    apple\_payobject
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    google\_payobject
    
-   #### 
    
    klarnaobject
    
-   #### 
    
    linkobject
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    paypalobject
    

The PaymentMethodDomain object

```
{  "id": "pmd_1Nnrer2eZvKYlo2Cips79tWl",  "object": "payment_method_domain",  "apple_pay": {    "status": "active"  },  "created": 1694129445,  "domain_name": "example.com",  "enabled": true,  "google_pay": {    "status": "active"  },  "link": {    "status": "active"  },  "livemode": false,  "paypal": {    "status": "active"  }}
```

# [Create a payment method domain](/api/payment_method_domains/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/payment\_method\_domains

Creates a payment method domain.

### Parameters

-   #### 
    
    domain\_namestringRequired
    
    The domain name that this payment method domain object represents.
    
-   #### 
    
    enabledboolean
    
    Whether this payment method domain is enabled. If the domain is not enabled, payment methods that require a payment method domain will not appear in Elements or Embedded Checkout.
    

### Returns

Returns a payment method domain object.

```
curl https://api.stripe.com/v1/payment_method_domains \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "domain_name=example.com"
```

Response

```
{  "id": "pmd_1Nnrer2eZvKYlo2Cips79tWl",  "object": "payment_method_domain",  "apple_pay": {    "status": "active"  },  "created": 1694129445,  "domain_name": "example.com",  "enabled": true,  "google_pay": {    "status": "active"  },  "link": {    "status": "active"  },  "livemode": false,  "paypal": {    "status": "active"  }}
```
