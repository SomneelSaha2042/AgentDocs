# [Tokens](/api/tokens)

Ask about this section

Copy for LLM

View as Markdown

Tokenization is the process Stripe uses to collect sensitive card or bank account details, or personally identifiable information (PII), directly from your customers in a secure manner. A token representing this information is returned to your server to use. Use our [recommended payments integrations](/payments) to perform this process on the client-side. This guarantees that no sensitive card data touches your server, and allows your integration to operate in a PCI-compliant way.

If you can’t use client-side tokenization, you can also create tokens using the API with either your publishable or secret API key. If your integration uses this method, you’re responsible for any PCI compliance that it might require, and you must keep your secret API key safe. Unlike with client-side tokenization, your customer’s information isn’t sent directly to Stripe, so we can’t determine how it’s handled or stored.

You can’t store or use tokens more than once. To store card or bank account information for later use, create [Customer](/api#customers) objects or [External accounts](/api#external_accounts). [Radar](/radar), our integrated solution for automatic fraud protection, performs best with integrations that use client-side tokenization.

Was this section helpful?YesNo

[](/api/tokens/create_bank_account)

Create a bank account token

POST/v1/tokens

[](/api/tokens/create_card)

Create a card token

POST/v1/tokens

[](/api/tokens/create_cvc_update)

Create a CVC update token

POST/v1/tokens

[](/api/tokens/create_person)

Create a person token

POST/v1/tokens

[](/api/tokens/create_pii)

Create a PII token

POST/v1/tokens

[](/api/tokens/create_account)

Create an account token

POST/v1/tokens

[](/api/tokens/retrieve)

Retrieve a token

GET/v1/tokens/:id

# [The Token object](/api/tokens/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    cardnullable object
    
    Hash describing the card used to make the charge.
    
    Show child attributes
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    bank\_accountnullable object
    
-   #### 
    
    client\_ipnullable string
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    descriptionnullable string
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    typestring
    
-   #### 
    
    usedboolean
    

The Token object

```
{  "id": "tok_1N3T00LkdIwHu7ixt44h1F8k",  "object": "token",  "card": {    "id": "card_1N3T00LkdIwHu7ixRdxpVI1Q",    "object": "card",    "address_city": null,    "address_country": null,    "address_line1": null,    "address_line1_check": null,    "address_line2": null,    "address_state": null,    "address_zip": null,    "address_zip_check": null,    "brand": "Visa",    "country": "US",    "cvc_check": "unchecked",    "dynamic_last4": null,    "exp_month": 5,    "exp_year": 2026,    "fingerprint": "mToisGZ01V71BCos",    "funding": "credit",    "last4": "4242",    "metadata": {},    "name": null,    "tokenization_method": null,    "wallet": null  },  "client_ip": "52.35.78.6",  "created": 1683071568,  "livemode": false,  "type": "card",  "used": false}
```

# [Create a bank account token](/api/tokens/create_bank_account)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/tokens

Creates a single-use token that represents a bank account’s details. You can use this token with any v1 API method in place of a bank account dictionary. You can only use this token once. To do so, attach it to a [connected account](#accounts) where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts.

### Parameters

-   #### 
    
    bank\_accountobject
    
    The bank account this token will represent.
    
    Show child parameters
    

### More parameters

Expand all

-   #### 
    
    customerstringConnect only
    

### Returns

Returns the created bank account token if it’s successful. Otherwise, this call raises [an error](#errors).

```
curl https://api.stripe.com/v1/tokens \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "bank_account[country]=US" \  -d "bank_account[currency]=usd" \  -d "bank_account[account_holder_name]=Jenny Rosen" \  -d "bank_account[account_holder_type]=individual" \  -d "bank_account[routing_number]=110000000" \  -d "bank_account[account_number]=000123456789"
```

Response

```
{  "id": "btok_1N3T00LkdIwHu7ixt44h1F8k",  "object": "token",  "bank_account": {    "id": "ba_1NWScr2eZvKYlo2C8MgV5Cwn",    "object": "bank_account",    "account_holder_name": "Jenny Rosen",    "account_holder_type": "individual",    "account_type": null,    "bank_name": "STRIPE TEST BANK",    "country": "US",    "currency": "usd",    "fingerprint": "1JWtPxqbdX5Gamtz",    "last4": "6789",    "routing_number": "110000000",    "status": "new"  },  "client_ip": null,  "created": 1689981645,  "livemode": false,  "redaction": null,  "type": "bank_account",  "used": false}
```
