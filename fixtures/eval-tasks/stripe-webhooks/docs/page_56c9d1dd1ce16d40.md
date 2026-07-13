# [Stripe Balance Debit Agreement](/api/stripe_balance_debit_agreements)

Ask about this section

Copy for LLM

View as Markdown

A Stripe Balance Debit Agreement represents the permission for a Stripe account to debit funds from another Stripe account’s balance. The debit agreement token can be passed in payment\_method\_options to create a Stripe Balance payment method and mandate via SetupIntent or PaymentIntent APIs.

Was this section helpful?YesNo

[](/api/stripe_balance_debit_agreements/create)

Create a StripeBalanceDebitAgreement

POST/v1/stripe\_balance\_debit\_agreements

[](/api/stripe_balance_debit_agreements/retrieve)

Retrieve a StripeBalanceDebitAgreement

GET/v1/stripe\_balance\_debit\_agreements/:id

[](/api/stripe_balance_debit_agreements/revoke)

Revoke a StripeBalanceDebitAgreement

POST/v1/stripe\_balance\_debit\_agreements/:id/revoke

# [The StripeBalanceDebitAgreement object](/api/stripe_balance_debit_agreements/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    objectstring
    
    String representing the object’s type. Objects of the same type share the same value.
    
-   #### 
    
    financial\_accountnullable string
    
    The ID of the financial account that is authorized to be debited.
    
-   #### 
    
    livemodeboolean
    
    Has the value `true` if the object exists in live mode or the value `false` if the object exists in test mode.
    
-   #### 
    
    multi\_usenullable object
    
    If this is a `multi_use` debit agreement, this hash contains details about the agreement.
    
    Show child attributes
    
-   #### 
    
    seller\_network\_business\_profilestring
    
    The ID of the seller network business profile associated with this debit agreement.
    
-   #### 
    
    single\_usenullable object
    
    If this is a `single_use` debit agreement, this hash contains details about the agreement.
    
    Show child attributes
    
-   #### 
    
    statusenum
    
    The status of the debit agreement.
    
    Possible enum values
    
    `active`
    
    The debit agreement is active and can be used to create payment methods.
    
    `expired`
    
    The debit agreement has expired due to single-use consumption.
    
    `pending`
    
    The debit agreement has been created and is pending activation.
    
    `revoked`
    
    The debit agreement has been revoked by the granting account.
    

The StripeBalanceDebitAgreement object

```
{  "id": "sbda_1Na5YT2eZvKYlo2Ctn7SPPuy",  "object": "stripe_balance_debit_agreement",  "financial_account": "fa_1Na5YT2eZvKYlo2Ctn7SPPuy",  "livemode": false,  "multi_use": null,  "seller_network_business_profile": "snbp_1Na5YT2eZvKYlo2Ctn7SPPuz",  "single_use": {    "amount": 1000,    "currency": "usd"  },  "status": "active"}
```

# [Create a StripeBalanceDebitAgreement](/api/stripe_balance_debit_agreements/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/stripe\_balance\_debit\_agreements

Creates a Stripe Balance Debit Agreement granting permission to debit from a financial account’s balance via the Stripe Balance payment method. The returned token can be used in payment\_method\_options\[stripe\_balance\]\[mandate\_options\] to generate a payment method and mandate.

### Parameters

-   #### 
    
    seller\_network\_business\_profilestringRequired
    
    The ID of the seller network business profile being granted permission to debit.
    
-   #### 
    
    financial\_accountstring
    
    The ID of the financial account to debit.
    
-   #### 
    
    multi\_useobject
    
    If this is a `multi_use` debit agreement, this hash contains details about the agreement.
    
    Show child parameters
    
-   #### 
    
    single\_useobject
    
    If this is a `single_use` debit agreement, this hash contains details about the agreement.
    
    Show child parameters
    

### Returns

Returns a StripeBalanceDebitAgreement object.

cURL

```
curl https://api.stripe.com/v1/stripe_balance_debit_agreements \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d financial_account={{FINANCIAL_ACCOUNT_ID}} \  -d seller_network_business_profile=snbp_1Na5YT2eZvKYlo2Ctn7SPPuz \  -d "single_use[amount]=1000" \  -d "single_use[currency]=usd"
```

Response

```
{  "id": "sbda_1Na5YT2eZvKYlo2Ctn7SPPuy",  "object": "stripe_balance_debit_agreement",  "financial_account": "fa_1Na5YT2eZvKYlo2Ctn7SPPuy",  "livemode": false,  "multi_use": null,  "seller_network_business_profile": "snbp_1Na5YT2eZvKYlo2Ctn7SPPuz",  "single_use": {    "amount": 1000,    "currency": "usd"  },  "status": "pending"}
```
