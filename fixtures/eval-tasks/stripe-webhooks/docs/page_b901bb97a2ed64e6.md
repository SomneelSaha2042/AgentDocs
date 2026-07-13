# [The Application Fee object](/api/application_fees/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    accountstringExpandable
    
    ID of the Stripe account this fee was taken from.
    
-   #### 
    
    amountinteger
    
    Amount earned, in the smallest currency unit.
    
-   #### 
    
    amount\_refundedinteger
    
    Amount in the smallest currency unit refunded (can be less than the amount attribute on the fee if a partial refund was issued)
    
-   #### 
    
    chargestringExpandable
    
    ID of the charge that the application fee was taken from.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    refundedboolean
    
    Whether the fee has been fully refunded. If the fee is only partially refunded, this attribute will still be false.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    applicationstringExpandable
    
-   #### 
    
    balance\_transactionnullable stringExpandable
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    fee\_sourcenullable object
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    originating\_transactionnullable stringExpandable
    
-   #### 
    
    refundsobject
    

The Application Fee object

```
{  "id": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",  "object": "application_fee",  "account": "acct_164wxjKbnvuxQXGu",  "amount": 105,  "amount_refunded": 105,  "application": "ca_32D88BD1qLklliziD7gYQvctJIhWBSQ7",  "balance_transaction": "txn_1032HU2eZvKYlo2CEPtcnUvl",  "charge": "ch_1B73DOKbnvuxQXGurbwPqzsu",  "created": 1506609734,  "currency": "gbp",  "livemode": false,  "originating_transaction": null,  "refunded": true,  "refunds": {    "object": "list",    "data": [      {        "id": "fr_1MBoU0KbnvuxQXGu2wCCz4Bb",        "object": "fee_refund",        "amount": 38,        "balance_transaction": null,        "created": 1670284441,        "currency": "usd",        "fee": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",        "metadata": {}      },      {        "id": "fr_D0s7fGBKB40Twy",        "object": "fee_refund",        "amount": 100,        "balance_transaction": "txn_1CaqNg2eZvKYlo2C75cA3Euk",        "created": 1528486576,        "currency": "usd",        "fee": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",        "metadata": {}      }    ],    "has_more": false,    "url": "/v1/application_fees/fee_1B73DOKbnvuxQXGuhY8Aw0TN/refunds"  },  "fee_source": {    "charge": "ch_1B73DOKbnvuxQXGurbwPqzsu",    "type": "charge"  }}
```

# [Retrieve an application fee](/api/application_fees/retrieve)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/application\_fees/:id

Retrieves the details of an application fee that your account has collected. The same information is returned when refunding the application fee.

### Parameters

No parameters.

### Returns

Returns an application fee object if a valid identifier was provided, and raises [an error](/api/errors) otherwise.

```
curl https://api.stripe.com/v1/application_fees/{{APPLICATION_FEE_ID}} \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "id": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",  "object": "application_fee",  "account": "acct_164wxjKbnvuxQXGu",  "amount": 105,  "amount_refunded": 105,  "application": "ca_32D88BD1qLklliziD7gYQvctJIhWBSQ7",  "balance_transaction": "txn_1032HU2eZvKYlo2CEPtcnUvl",  "charge": "ch_1B73DOKbnvuxQXGurbwPqzsu",  "created": 1506609734,  "currency": "gbp",  "livemode": false,  "originating_transaction": null,  "refunded": true,  "refunds": {    "object": "list",    "data": [      {        "id": "fr_1MBoU0KbnvuxQXGu2wCCz4Bb",        "object": "fee_refund",        "amount": 38,        "balance_transaction": null,        "created": 1670284441,        "currency": "usd",        "fee": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",        "metadata": {}      },      {        "id": "fr_D0s7fGBKB40Twy",        "object": "fee_refund",        "amount": 100,        "balance_transaction": "txn_1CaqNg2eZvKYlo2C75cA3Euk",        "created": 1528486576,        "currency": "usd",        "fee": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",        "metadata": {}      }    ],    "has_more": false,    "url": "/v1/application_fees/fee_1B73DOKbnvuxQXGuhY8Aw0TN/refunds"  },  "fee_source": {    "charge": "ch_1B73DOKbnvuxQXGurbwPqzsu",    "type": "charge"  }}
```

# [List all application fees](/api/application_fees/list)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/application\_fees

Returns a list of application fees you’ve previously collected. The application fees are returned in sorted order, with the most recent fees appearing first.

### Parameters

-   #### 
    
    chargestring
    
    Only return application fees for the charge specified by this charge ID.
    

### More parameters

Expand all

-   #### 
    
    createdobject
    
-   #### 
    
    ending\_beforestring
    
-   #### 
    
    limitinteger
    
-   #### 
    
    starting\_afterstring
    

### Returns

A dictionary with a `data` property that contains an array of up to `limit` application fees, starting after application fee `starting_after`. Each entry in the array is a separate application fee object. If no more fees are available, the resulting array will be empty.

```
curl -G https://api.stripe.com/v1/application_fees \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d limit=3
```

Response

```
{  "object": "list",  "url": "/v1/application_fees",  "has_more": false,  "data": [    {      "id": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",      "object": "application_fee",      "account": "acct_164wxjKbnvuxQXGu",      "amount": 105,      "amount_refunded": 105,      "application": "ca_32D88BD1qLklliziD7gYQvctJIhWBSQ7",      "balance_transaction": "txn_1032HU2eZvKYlo2CEPtcnUvl",      "charge": "ch_1B73DOKbnvuxQXGurbwPqzsu",      "created": 1506609734,      "currency": "gbp",      "livemode": false,      "originating_transaction": null,      "refunded": true,      "refunds": {        "object": "list",        "data": [          {            "id": "fr_1MBoU0KbnvuxQXGu2wCCz4Bb",            "object": "fee_refund",            "amount": 38,            "balance_transaction": null,            "created": 1670284441,            "currency": "usd",            "fee": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",            "metadata": {}          },          {            "id": "fr_D0s7fGBKB40Twy",            "object": "fee_refund",            "amount": 100,            "balance_transaction": "txn_1CaqNg2eZvKYlo2C75cA3Euk",            "created": 1528486576,            "currency": "usd",            "fee": "fee_1B73DOKbnvuxQXGuhY8Aw0TN",            "metadata": {}          }        ],        "has_more": false,        "url": "/v1/application_fees/fee_1B73DOKbnvuxQXGuhY8Aw0TN/refunds"      },      "fee_source": {        "charge": "ch_1B73DOKbnvuxQXGurbwPqzsu",        "type": "charge"      }    }  ]}
```
