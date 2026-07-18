# [Transfer Reversals](/api/transfer_reversals)

Ask about this section

Copy for LLM

View as Markdown

[Stripe Connect](/connect) platforms can reverse transfers made to a connected account, either entirely or partially, and can also specify whether to refund any related application fees. Transfer reversals add to the platform’s balance and subtract from the destination account’s balance.

Reversing a transfer that was made for a [destination charge](/connect/destination-charges) is allowed only up to the amount of the charge. It is possible to reverse a [transfer\_group](/connect/separate-charges-and-transfers#transfer-options) transfer only if the destination account has enough balance to cover the reversal.

Related guide: [Reverse transfers](/connect/separate-charges-and-transfers#reverse-transfers)

Was this section helpful?YesNo

[](/api/transfer_reversals/create)

Create a transfer reversal

POST/v1/transfers/:id/reversals

[](/api/transfer_reversals/update)

Update a reversal

POST/v1/transfers/:id/reversals/:id

[](/api/transfer_reversals/retrieve)

Retrieve a reversal

GET/v1/transfers/:id/reversals/:id

[](/api/transfer_reversals/list)

List all reversals

GET/v1/transfers/:id/reversals

# [The Transfer Reversal object](/api/transfer_reversals/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    amountinteger
    
    Amount, in the smallest currency unit.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    transferstringExpandable
    
    ID of the transfer that was reversed.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    balance\_transactionnullable stringExpandable
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    destination\_payment\_refundnullable stringExpandable
    
-   #### 
    
    source\_refundnullable stringExpandable
    

The Transfer Reversal object

```
{  "id": "trr_1Mio2eLkdIwHu7ixN5LPJS4a",  "object": "transfer_reversal",  "amount": 400,  "balance_transaction": "txn_1Mio2eLkdIwHu7ixosfrbjhW",  "created": 1678147568,  "currency": "usd",  "destination_payment_refund": "pyr_1Mio2eQ9PRzxEwkZYewpaIFB",  "metadata": {},  "source_refund": null,  "transfer": "tr_1Mio2dLkdIwHu7ixsUuCxJpu"}
```

# [Create a transfer reversal](/api/transfer_reversals/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/transfers/:id/reversals

When you create a new reversal, you must specify a transfer to create it on.

When reversing transfers, you can optionally reverse part of the transfer. You can do so as many times as you wish until the entire transfer has been reversed.

Once entirely reversed, a transfer can’t be reversed again. This method will return an error when called on an already-reversed transfer, or when trying to reverse more money than is left on a transfer.

### Parameters

-   #### 
    
    amountinteger
    
    A positive integer in the smallest currency unit representing how much of this transfer to reverse. Can only reverse up to the unreversed amount remaining of the transfer. Partial transfer reversals are only allowed for transfers to Stripe Accounts. Defaults to the entire transfer amount.
    
-   #### 
    
    descriptionstring
    
    An arbitrary string which you can attach to a reversal object. This will be unset if you POST an empty value.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    

### More parameters

Expand all

-   #### 
    
    refund\_application\_feeboolean
    

### Returns

Returns a transfer reversal object if the reversal succeeded. Raises [an error](#errors) if the transfer has already been reversed or an invalid transfer identifier was provided.

```
curl https://api.stripe.com/v1/transfers/{{TRANSFER_ID}}/reversals \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d amount=400
```

Response

```
{  "id": "trr_1Mio2eLkdIwHu7ixN5LPJS4a",  "object": "transfer_reversal",  "amount": 400,  "balance_transaction": "txn_1Mio2eLkdIwHu7ixosfrbjhW",  "created": 1678147568,  "currency": "usd",  "destination_payment_refund": "pyr_1Mio2eQ9PRzxEwkZYewpaIFB",  "metadata": {},  "source_refund": null,  "transfer": "tr_1Mio2dLkdIwHu7ixsUuCxJpu"}
```
