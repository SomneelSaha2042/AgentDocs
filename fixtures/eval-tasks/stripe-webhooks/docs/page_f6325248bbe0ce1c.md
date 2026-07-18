# [External Bank Accounts](/api/external_accounts)

Ask about this section

Copy for LLM

View as Markdown

External bank accounts are financial accounts associated with a Stripe platform’s connected accounts for the purpose of transferring funds to or from the connected account’s Stripe balance.

Was this section helpful?YesNo

[](/api/external_account_bank_accounts/create)

Create a bank account

POST/v1/accounts/:id/external\_accounts

[](/api/external_account_bank_accounts/update)

Update a bank account

POST/v1/accounts/:id/external\_accounts/:id

[](/api/external_account_bank_accounts/retrieve)

Retrieve a bank account

GET/v1/accounts/:id/external\_accounts/:id

[](/api/external_account_bank_accounts/list)

List all bank accounts

GET/v1/accounts/:id/external\_accounts

[](/api/external_account_bank_accounts/delete)

Delete a bank account

DELETE/v1/accounts/:id/external\_accounts/:id

# [The External Bank Account object](/api/external_account_bank_accounts/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    accountnullable stringExpandableAvailable conditionally
    
    The account this bank account belongs to. Only applicable on Accounts (not customers or recipients) This property is only available when returned as an [External Account](/api/external_account_bank_accounts/object) where [controller.is\_controller](/api/accounts/object#account_object-controller-is_controller) is `true`.
    
-   #### 
    
    bank\_namenullable string
    
    Name of the bank associated with the routing number (e.g., `WELLS FARGO`).
    
-   #### 
    
    countrystring
    
    Two-letter ISO code representing the country the bank account is located in.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO code for the currency](https://stripe.com/docs/payouts) paid out to the bank account.
    
-   #### 
    
    default\_for\_currencynullable boolean
    
    Whether this bank account is the default external account for its currency.
    
-   #### 
    
    last4string
    
    The last four digits of the bank account number.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    routing\_numbernullable string
    
    The routing transit number for the bank account.
    
-   #### 
    
    statusstring
    
    For bank accounts, possible values are `new`, `validated`, `verified`, `verification_failed`, `tokenized_account_number_deactivated` or `errored`. A bank account that hasn’t had any activity or validation performed is `new`. If Stripe can determine that the bank account exists, its status will be `validated`. Note that there often isn’t enough information to know (e.g., for smaller credit unions), and the validation is not always run. If customer bank account verification has succeeded, the bank account status will be `verified`. If the verification failed for any reason, such as microdeposit failure, the status will be `verification_failed`. If the status is `tokenized_account_number_deactivated`, the account utilizes a tokenized account number which has been deactivated due to expiration or revocation. This account will need to be reverified to continue using it for money movement. If a payout sent to this bank account fails, we’ll set the status to `errored` and will not continue to send [scheduled payouts](https://stripe.com/docs/payouts#payout-schedule) until the bank details are updated.
    
    For external accounts, possible values are `new`, `errored`, `verification_failed`, and `tokenized_account_number_deactivated`. If a payout fails, the status is set to `errored` and scheduled payouts are stopped until account details are updated. In the US and India, if we can’t [verify the owner of the bank account](https://support.stripe.com/questions/bank-account-ownership-verification), we’ll set the status to `verification_failed`. Other validations aren’t run against external accounts because they’re only used for payouts. This means the other statuses don’t apply.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    account\_holder\_namenullable string
    
-   #### 
    
    account\_holder\_typenullable string
    
-   #### 
    
    account\_typenullable string
    
-   #### 
    
    available\_payout\_methodsnullable array of enums
    
-   #### 
    
    customernullable stringExpandable
    
-   #### 
    
    fingerprintnullable string
    
-   #### 
    
    future\_requirementsnullable object
    
-   #### 
    
    requirementsnullable object
    

The External Bank Account object

```
{  "id": "ba_1N9DrD2eZvKYlo2C58f4DaIa",  "object": "bank_account",  "account": "acct_1032D82eZvKYlo2C",  "account_holder_name": "Jane Austen",  "account_holder_type": "individual",  "account_type": null,  "available_payout_methods": [    "standard"  ],  "bank_name": "STRIPE TEST BANK",  "country": "US",  "currency": "usd",  "fingerprint": "1JWtPxqbdX5Gamtz",  "last4": "6789",  "metadata": {},  "routing_number": "110000000",  "status": "new"}
```

# [Create a bank account](/api/external_account_bank_accounts/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/accounts/:id/external\_accounts

When you create a new bank account, you must specify a [connected account](#accounts) to create it on. You can only specify connected accounts where [account.controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application` (includes [Custom accounts](/connect/custom-accounts)).

If the bank account’s owner has no other external account in the bank account’s currency, the new bank account will become the default for that currency. However, if the owner already has a bank account for that currency, the new account will become the default only if the `default_for_currency` parameter is set to `true`.

### Parameters

-   #### 
    
    external\_accountobject | stringRequired
    
    Either a token, like the ones returned by [Stripe.js](/js), or a dictionary containing a user’s bank account details (with the options shown below).
    
    Show child parameters
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    

### More parameters

Expand all

-   #### 
    
    default\_for\_currencyboolean
    

### Returns

Returns the bank account object

```
curl https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}}/external_accounts \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d external_account=btok_1NAiJy2eZvKYlo2Cnh6bIs9c
```

Response

```
{  "id": "ba_1NAiJy2eZvKYlo2CvChQKz5k",  "object": "bank_account",  "account": "acct_1032D82eZvKYlo2C",  "account_holder_name": "Jane Austen",  "account_holder_type": "company",  "account_type": null,  "bank_name": "STRIPE TEST BANK",  "country": "US",  "currency": "usd",  "fingerprint": "1JWtPxqbdX5Gamtc",  "last4": "6789",  "metadata": {},  "routing_number": "110000000",  "status": "new"}
```
