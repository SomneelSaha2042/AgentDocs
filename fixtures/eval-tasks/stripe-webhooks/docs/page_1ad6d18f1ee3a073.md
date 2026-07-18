# [Payment Methods](/api/payment_methods)

Ask about this section

Copy for LLM

View as Markdown

PaymentMethod objects represent your customer’s payment instruments. You can use them with [PaymentIntents](/payments/payment-intents) to collect payments or save them to Customer objects to store instrument details for future payments.

Related guides: [Payment Methods](/payments/payment-methods) and [More Payment Scenarios](/payments/more-payment-scenarios).

Was this section helpful?YesNo

[](/api/payment_methods/create)

Create a PaymentMethod

POST/v1/payment\_methods

[](/api/payment_methods/update)

Update a PaymentMethod

POST/v1/payment\_methods/:id

[](/api/payment_methods/retrieve)

Retrieve a PaymentMethod

GET/v1/payment\_methods/:id

[](/api/payment_methods/customer)

Retrieve a Customer's PaymentMethod

GET/v1/customers/:id/payment\_methods/:id

[](/api/payment_methods/list)

List PaymentMethods

GET/v1/payment\_methods

[](/api/payment_methods/customer_list)

List a Customer's PaymentMethods

GET/v1/customers/:id/payment\_methods

[](/api/payment_methods/attach)

Attach a PaymentMethod to a Customer

POST/v1/payment\_methods/:id/attach

[](/api/payment_methods/detach)

Detach a PaymentMethod from a Customer

POST/v1/payment\_methods/:id/detach

# [The PaymentMethod object](/api/payment_methods/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    billing\_detailsobject
    
    Billing information associated with the PaymentMethod that may be used or required by particular types of payment methods.
    
    Show child attributes
    
-   #### 
    
    customernullable stringExpandable
    
    The ID of the Customer to which this PaymentMethod is saved. This will not be set when the PaymentMethod has not been saved to a Customer.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    typeenum
    
    The type of the PaymentMethod. An additional hash is included on the PaymentMethod with a name matching this value. It contains additional information specific to the PaymentMethod type.
    
    Possible enum values
    
    `acss_debit`
    
    [Pre-authorized debit payments](/payments/acss-debit) are used to debit Canadian bank accounts through the Automated Clearing Settlement System (ACSS).
    
    `affirm`
    
    [Affirm](/payments/affirm) is a buy now, pay later payment method in the US.
    
    `afterpay_clearpay`
    
    [Afterpay / Clearpay](/payments/afterpay-clearpay) is a buy now, pay later payment method used in Australia, Canada, France, New Zealand, Spain, the UK, and the US.
    
    `alipay`
    
    [Alipay](/payments/alipay) is a digital wallet payment method used in China.
    
    `alma`
    
    [Alma](/payments/alma) is a Buy Now, Pay Later payment method that lets customers pay in 2, 3, or 4 installments.
    
    `amazon_pay`
    
    [Amazon Pay](/payments/amazon-pay) is a Wallet payment method that lets hundreds of millions of Amazon customers pay their way, every day.
    
    `au_becs_debit`
    
    [BECS Direct Debit](/payments/au-becs-debit) is used to debit Australian bank accounts through the Bulk Electronic Clearing System (BECS).
    
    `bacs_debit`
    
    [Bacs Direct Debit](/payments/payment-methods/bacs-debit) is used to debit UK bank accounts.
    
    `bancontact`
    
    [Bancontact](/payments/bancontact) is a bank redirect payment method used in Belgium.
    
    `billie`
    
    [Billie](/payments/billie) is a payment method.
    
    Show 48 more
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    acss\_debitnullable object
    
-   #### 
    
    affirmnullable object
    
-   #### 
    
    afterpay\_clearpaynullable object
    
-   #### 
    
    alipaynullable object
    
-   #### 
    
    allow\_redisplaynullable enum
    
-   #### 
    
    almanullable object
    
-   #### 
    
    amazon\_paynullable object
    
-   #### 
    
    au\_becs\_debitnullable object
    
-   #### 
    
    bacs\_debitnullable object
    
-   #### 
    
    bancontactnullable object
    
-   #### 
    
    billienullable object
    
-   #### 
    
    bizumnullable object
    
-   #### 
    
    bliknullable object
    
-   #### 
    
    boletonullable object
    
-   #### 
    
    cardnullable object
    
-   #### 
    
    card\_presentnullable object
    
-   #### 
    
    cashappnullable object
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    cryptonullable object
    
-   #### 
    
    customnullable object
    
-   #### 
    
    customer\_balancenullable object
    
-   #### 
    
    epsnullable object
    
-   #### 
    
    fpxnullable object
    
-   #### 
    
    giropaynullable object
    
-   #### 
    
    grabpaynullable object
    
-   #### 
    
    idealnullable object
    
-   #### 
    
    interac\_presentnullable objectPreview feature
    
-   #### 
    
    kakao\_paynullable object
    
-   #### 
    
    klarnanullable object
    
-   #### 
    
    konbininullable object
    
-   #### 
    
    kr\_cardnullable object
    
-   #### 
    
    linknullable object
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    mb\_waynullable object
    
-   #### 
    
    mobilepaynullable object
    
-   #### 
    
    multibanconullable object
    
-   #### 
    
    naver\_paynullable object
    
-   #### 
    
    nz\_bank\_accountnullable object
    
-   #### 
    
    oxxonullable object
    
-   #### 
    
    p24nullable object
    
-   #### 
    
    pay\_by\_banknullable object
    
-   #### 
    
    payconullable object
    
-   #### 
    
    paynownullable object
    
-   #### 
    
    paypalnullable object
    
-   #### 
    
    paypaynullable objectPreview feature
    
-   #### 
    
    paytonullable object
    
-   #### 
    
    pixnullable object
    
-   #### 
    
    promptpaynullable object
    
-   #### 
    
    radar\_optionsnullable object
    
-   #### 
    
    revolut\_paynullable object
    
-   #### 
    
    samsung\_paynullable object
    
-   #### 
    
    satispaynullable object
    
-   #### 
    
    scalapaynullable objectPreview feature
    
-   #### 
    
    sepa\_debitnullable object
    
-   #### 
    
    sofortnullable object
    
-   #### 
    
    sunbitnullable object
    
-   #### 
    
    swishnullable object
    
-   #### 
    
    twintnullable object
    
-   #### 
    
    upinullable object
    
-   #### 
    
    us\_bank\_accountnullable object
    
-   #### 
    
    wechat\_paynullable object
    
-   #### 
    
    zipnullable object
    

The PaymentMethod object

```
{  "id": "pm_1Q0PsIJvEtkwdCNYMSaVuRz6",  "object": "payment_method",  "allow_redisplay": "unspecified",  "billing_details": {    "address": {      "city": null,      "country": null,      "line1": null,      "line2": null,      "postal_code": null,      "state": null    },    "email": null,    "name": "John Doe",    "phone": null  },  "created": 1726673582,  "customer": null,  "livemode": false,  "metadata": {},  "type": "us_bank_account",  "us_bank_account": {    "account_holder_type": "individual",    "account_type": "checking",    "bank_name": "STRIPE TEST BANK",    "financial_connections_account": null,    "fingerprint": "LstWJFsCK7P349Bg",    "last4": "6789",    "networks": {      "preferred": "ach",      "supported": [        "ach"      ]    },    "routing_number": "110000000",    "status_details": {}  }}
```

# [Create a PaymentMethod](/api/payment_methods/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/payment\_methods

Creates a PaymentMethod object. Read the [Stripe.js reference](/stripe-js/reference#stripe-create-payment-method) to learn how to create PaymentMethods via Stripe.js.

Instead of creating a PaymentMethod directly, we recommend using the [PaymentIntents](/payments/accept-a-payment) API to accept a payment immediately or the [SetupIntent](/payments/save-and-reuse) API to collect payment method details ahead of a future payment.

### Parameters

-   #### 
    
    typeenumRequired
    
    The type of the PaymentMethod. An additional hash is included on the PaymentMethod with a name matching this value. It contains additional information specific to the PaymentMethod type.
    
    Possible enum values
    
    `acss_debit`
    
    [Pre-authorized debit payments](/payments/acss-debit) are used to debit Canadian bank accounts through the Automated Clearing Settlement System (ACSS).
    
    `affirm`
    
    [Affirm](/payments/affirm) is a buy now, pay later payment method in the US.
    
    `afterpay_clearpay`
    
    [Afterpay / Clearpay](/payments/afterpay-clearpay) is a buy now, pay later payment method used in Australia, Canada, France, New Zealand, Spain, the UK, and the US.
    
    `alipay`
    
    [Alipay](/payments/alipay) is a digital wallet payment method used in China.
    
    `alma`
    
    [Alma](/payments/alma) is a Buy Now, Pay Later payment method that lets customers pay in 2, 3, or 4 installments.
    
    `amazon_pay`
    
    [Amazon Pay](/payments/amazon-pay) is a Wallet payment method that lets hundreds of millions of Amazon customers pay their way, every day.
    
    `au_becs_debit`
    
    [BECS Direct Debit](/payments/au-becs-debit) is used to debit Australian bank accounts through the Bulk Electronic Clearing System (BECS).
    
    `bacs_debit`
    
    [Bacs Direct Debit](/payments/payment-methods/bacs-debit) is used to debit UK bank accounts.
    
    `bancontact`
    
    [Bancontact](/payments/bancontact) is a bank redirect payment method used in Belgium.
    
    `billie`
    
    [Billie](/payments/billie) is a payment method.
    
    Show 48 more
    
-   #### 
    
    billing\_detailsobject
    
    Billing information associated with the PaymentMethod that may be used or required by particular types of payment methods.
    
    Show child parameters
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    

### More parameters

Expand all

-   #### 
    
    acss\_debitobject
    
-   #### 
    
    affirmobject
    
-   #### 
    
    afterpay\_clearpayobject
    
-   #### 
    
    alipayobject
    
-   #### 
    
    allow\_redisplayenum
    
-   #### 
    
    almaobject
    
-   #### 
    
    amazon\_payobject
    
-   #### 
    
    au\_becs\_debitobject
    
-   #### 
    
    bacs\_debitobject
    
-   #### 
    
    bancontactobject
    
-   #### 
    
    billieobject
    
-   #### 
    
    bizumobject
    
-   #### 
    
    blikobject
    
-   #### 
    
    boletoobject
    
-   #### 
    
    cardobject
    
-   #### 
    
    cashappobject
    
-   #### 
    
    cryptoobject
    
-   #### 
    
    customobject
    
-   #### 
    
    customer\_balanceobject
    
-   #### 
    
    epsobject
    
-   #### 
    
    fpxobject
    
-   #### 
    
    giropayobject
    
-   #### 
    
    grabpayobject
    
-   #### 
    
    idealobject
    
-   #### 
    
    interac\_presentobjectPreview feature
    
-   #### 
    
    kakao\_payobject
    
-   #### 
    
    klarnaobject
    
-   #### 
    
    konbiniobject
    
-   #### 
    
    kr\_cardobject
    
-   #### 
    
    linkobject
    
-   #### 
    
    mb\_wayobject
    
-   #### 
    
    mobilepayobject
    
-   #### 
    
    multibancoobject
    
-   #### 
    
    naver\_payobject
    
-   #### 
    
    nz\_bank\_accountobject
    
-   #### 
    
    oxxoobject
    
-   #### 
    
    p24object
    
-   #### 
    
    pay\_by\_bankobject
    
-   #### 
    
    paycoobject
    
-   #### 
    
    paynowobject
    
-   #### 
    
    paypalobject
    
-   #### 
    
    paypayobjectPreview feature
    
-   #### 
    
    paytoobject
    
-   #### 
    
    pixobject
    
-   #### 
    
    promptpayobject
    
-   #### 
    
    radar\_optionsobject
    
-   #### 
    
    revolut\_payobject
    
-   #### 
    
    samsung\_payobject
    
-   #### 
    
    satispayobject
    
-   #### 
    
    scalapayobjectPreview feature
    
-   #### 
    
    sepa\_debitobject
    
-   #### 
    
    sofortobject
    
-   #### 
    
    sunbitobject
    
-   #### 
    
    swishobject
    
-   #### 
    
    twintobject
    
-   #### 
    
    upiobject
    
-   #### 
    
    us\_bank\_accountobject
    
-   #### 
    
    wechat\_payobject
    
-   #### 
    
    zipobject
    

### Returns

Returns a PaymentMethod object.

```
curl https://api.stripe.com/v1/payment_methods \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d type=us_bank_account \  -d "us_bank_account[account_holder_type]=individual" \  -d "us_bank_account[account_number]=000123456789" \  -d "us_bank_account[routing_number]=110000000" \  -d "billing_details[name]=John Doe"
```

Response

```
{  "id": "pm_1Q0PsIJvEtkwdCNYMSaVuRz6",  "object": "payment_method",  "allow_redisplay": "unspecified",  "billing_details": {    "address": {      "city": null,      "country": null,      "line1": null,      "line2": null,      "postal_code": null,      "state": null    },    "email": null,    "name": "John Doe",    "phone": null  },  "created": 1726673582,  "customer": null,  "livemode": false,  "metadata": {},  "type": "us_bank_account",  "us_bank_account": {    "account_holder_type": "individual",    "account_type": "checking",    "bank_name": "STRIPE TEST BANK",    "financial_connections_account": null,    "fingerprint": "LstWJFsCK7P349Bg",    "last4": "6789",    "networks": {      "preferred": "ach",      "supported": [        "ach"      ]    },    "routing_number": "110000000",    "status_details": {}  }}
```
