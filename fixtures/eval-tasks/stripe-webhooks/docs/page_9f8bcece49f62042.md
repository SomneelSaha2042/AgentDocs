# [Transfers](/api/transfers)

Ask about this section

Copy for LLM

View as Markdown

A `Transfer` object is created when you move funds between Stripe accounts as part of Connect.

Before April 6, 2017, transfers also represented movement of funds from a Stripe account to a card or bank account. This behavior has since been split out into a [Payout](#payout_object) object, with corresponding payout endpoints. For more information, read about the [transfer/payout split](/transfer-payout-split).

Related guide: [Creating separate charges and transfers](/connect/separate-charges-and-transfers)

Was this section helpful?YesNo

[](/api/transfers/create)

Create a transfer

POST/v1/transfers

[](/api/transfers/update)

Update a transfer

POST/v1/transfers/:id

[](/api/transfers/retrieve)

Retrieve a transfer

GET/v1/transfers/:id

[](/api/transfers/list)

List all transfers

GET/v1/transfers

# [The Transfer object](/api/transfers/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    amountinteger
    
    Amount in the smallest currency unit to be transferred.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    descriptionnullable string
    
    An arbitrary string attached to the object. Often useful for displaying to users.
    
-   #### 
    
    destinationnullable stringExpandable
    
    ID of the Stripe account the transfer was sent to.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    amount\_reversedinteger
    
-   #### 
    
    balance\_transactionnullable stringExpandable
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    destination\_paymentnullable stringExpandable
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    reversalsobject
    
-   #### 
    
    reversedboolean
    
-   #### 
    
    source\_transactionnullable stringExpandable
    
-   #### 
    
    source\_typenullable string
    
-   #### 
    
    transfer\_groupnullable string
    

The Transfer object

```
{  "id": "tr_1MiN3gLkdIwHu7ixNCZvFdgA",  "object": "transfer",  "amount": 400,  "amount_reversed": 0,  "balance_transaction": "txn_1MiN3gLkdIwHu7ixxapQrznl",  "created": 1678043844,  "currency": "usd",  "description": null,  "destination": "acct_1MTfjCQ9PRzxEwkZ",  "destination_payment": "py_1MiN3gQ9PRzxEwkZWTPGNq9o",  "livemode": false,  "metadata": {},  "reversals": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/transfers/tr_1MiN3gLkdIwHu7ixNCZvFdgA/reversals"  },  "reversed": false,  "source_transaction": null,  "source_type": "card",  "transfer_group": "ORDER_95"}
```

# [Create a transfer](/api/transfers/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/transfers

To send funds from your Stripe account to a connected account, you create a new transfer object. Your [Stripe balance](#balance) must be able to cover the transfer amount, or you’ll receive an “Insufficient Funds” error.

### Parameters

-   #### 
    
    currencyenumRequired
    
    Three-letter [ISO code for currency](https://www.iso.org/iso-4217-currency-codes.html) in lowercase. Must be a [supported currency](https://docs.stripe.com/currencies).
    
-   #### 
    
    destinationstringRequired
    
    The ID of a connected Stripe account. [See the Connect documentation](/connect/separate-charges-and-transfers) for details.
    
-   #### 
    
    amountintegerRequired
    
    A positive integer in the smallest currency unit representing how much to transfer.
    
-   #### 
    
    descriptionstring
    
    An arbitrary string attached to the object. Often useful for displaying to users.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    

### More parameters

Expand all

-   #### 
    
    source\_transactionstring
    
-   #### 
    
    source\_typestring
    
-   #### 
    
    transfer\_groupstring
    

### Returns

Returns a transfer object if there were no initial errors with the transfer creation (e.g., insufficient funds).

```
curl https://api.stripe.com/v1/transfers \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d amount=400 \  -d currency=usd \  -d destination={{ACCOUNT_ID}} \  -d transfer_group=ORDER_95
```

Response

```
{  "id": "tr_1MiN3gLkdIwHu7ixNCZvFdgA",  "object": "transfer",  "amount": 400,  "amount_reversed": 0,  "balance_transaction": "txn_1MiN3gLkdIwHu7ixxapQrznl",  "created": 1678043844,  "currency": "usd",  "description": null,  "destination": "acct_1MTfjCQ9PRzxEwkZ",  "destination_payment": "py_1MiN3gQ9PRzxEwkZWTPGNq9o",  "livemode": false,  "metadata": {},  "reversals": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/transfers/tr_1MiN3gLkdIwHu7ixNCZvFdgA/reversals"  },  "reversed": false,  "source_transaction": null,  "source_type": "card",  "transfer_group": "ORDER_95"}
```
