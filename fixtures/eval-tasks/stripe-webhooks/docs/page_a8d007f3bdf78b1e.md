# [Cash Balance Transaction](/api/cash_balance_transactions)

Ask about this section

Copy for LLM

View as Markdown

Customers with certain payments enabled have a cash balance, representing funds that were paid by the customer to a merchant, but have not yet been allocated to a payment. Cash Balance Transactions represent when funds are moved into or out of this balance. This includes funding by the customer, allocation to payments, and refunds to the customer.

Was this section helpful?YesNo

[](/api/cash_balance_transactions/create_or_retrieve_funding_instructions)

Create or retrieve funding instructions for a customer cash balance

POST/v1/customers/:id/funding\_instructions

[](/api/cash_balance_transactions/retrieve)

Retrieve a cash balance transaction

GET/v1/customers/:id/cash\_balance\_transactions/:id

[](/api/cash_balance_transactions/list)

List cash balance transactions

GET/v1/customers/:id/cash\_balance\_transactions

[](/api/cash_balance_transactions/fund_cash_balance)

Fund a test mode cash balance

POST/v1/test\_helpers/customers/:id/fund\_cash\_balance

# [The Cash Balance Transaction object](/api/cash_balance_transactions/object)

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
    
    adjusted\_for\_overdraftnullable object
    
    If this is a `type=adjusted_for_overdraft` transaction, contains information about what caused the overdraft, which triggered this transaction.
    
    Show child attributes
    
-   #### 
    
    applied\_to\_paymentnullable object
    
    If this is a `type=applied_to_payment` transaction, contains information about how funds were applied.
    
    Show child attributes
    
-   #### 
    
    createdtimestamp
    
    Time at which the object was created. Measured in seconds since the Unix epoch.
    
-   #### 
    
    currencystring
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    customerstringExpandable
    
    The customer whose available cash balance changed as a result of this transaction.
    
-   #### 
    
    customer\_accountnullable string
    
    The ID of an Account representing a customer whose available cash balance changed as a result of this transaction.
    
-   #### 
    
    ending\_balanceinteger
    
    The total available cash balance for the specified currency after this transaction was applied. Represented in the [smallest currency unit](/currencies#zero-decimal).
    
-   #### 
    
    fundednullable object
    
    If this is a `type=funded` transaction, contains information about the funding.
    
    Show child attributes
    
-   #### 
    
    livemodeboolean
    
    If the object exists in live mode, the value is `true`. If the object exists in test mode, the value is `false`.
    
-   #### 
    
    net\_amountinteger
    
    The amount by which the cash balance changed, represented in the [smallest currency unit](/currencies#zero-decimal). A positive value represents funds being added to the cash balance, a negative value represents funds being removed from the cash balance.
    
-   #### 
    
    refunded\_from\_paymentnullable object
    
    If this is a `type=refunded_from_payment` transaction, contains information about the source of the refund.
    
    Show child attributes
    
-   #### 
    
    transferred\_to\_balancenullable object
    
    If this is a `type=transferred_to_balance` transaction, contains the balance transaction linked to the transfer.
    
    Show child attributes
    
-   #### 
    
    typeenum
    
    The type of the cash balance transaction. New types may be added in future. See [Customer Balance](/payments/customer-balance#types) to learn more about these types.
    
    Possible enum values
    
    `adjusted_for_overdraft`
    
    A cash balance transaction type: `adjusted_for_overdraft`
    
    `applied_to_payment`
    
    A cash balance transaction type: `applied_to_payment`
    
    `funded`
    
    A cash balance transaction type: `funded`
    
    `funding_reversed`
    
    A cash balance transaction type: `funding_reversed`
    
    `refunded_from_payment`
    
    A cash balance transaction type: `refunded_from_payment`
    
    `return_canceled`
    
    A cash balance transaction type: `return_canceled`
    
    `return_initiated`
    
    A cash balance transaction type: `return_initiated`
    
    `transferred_to_balance`
    
    A cash balance transaction type: `transferred_to_balance`
    
    `unapplied_from_payment`
    
    A cash balance transaction type: `unapplied_from_payment`
    
-   #### 
    
    unapplied\_from\_paymentnullable object
    
    If this is a `type=unapplied_from_payment` transaction, contains information about how funds were unapplied.
    
    Show child attributes
    

The Cash Balance Transaction object

```
{  "id": "ccsbtxn_1Na16B2eZvKYlo2CUhyw3dsF",  "object": "customer_cash_balance_transaction",  "created": 1690829143,  "currency": "eur",  "customer": "cus_9s6XKzkNRiz8i3",  "ending_balance": 10000,  "funded": {    "bank_transfer": {      "eu_bank_transfer": {        "bic": "BANKDEAAXXX",        "iban_last4": "7089",        "sender_name": "Sample Business GmbH"      },      "reference": "Payment for Invoice 28278FC-155",      "type": "eu_bank_transfer"    }  },  "livemode": false,  "net_amount": 5000,  "type": "funded"}
```

# [Create or retrieve funding instructions for a customer cash balance](/api/cash_balance_transactions/create_or_retrieve_funding_instructions)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/customers/:id/funding\_instructions

Retrieve funding instructions for a customer cash balance. If funding instructions do not yet exist for the customer, new funding instructions will be created. If funding instructions have already been created for a given customer, the same funding instructions will be retrieved. In other words, we will return the same funding instructions each time.

### Parameters

-   #### 
    
    bank\_transferobjectRequired
    
    Additional parameters for `bank_transfer` funding types
    
    Show child parameters
    
-   #### 
    
    currencyenumRequired
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    funding\_typeenumRequired
    
    The `funding_type` to get the instructions for.
    
    Possible enum values
    
    `bank_transfer`
    
    Use a bank\_transfer hash to define the bank transfer type
    

### Returns

Returns funding instructions for a customer cash balance

```
curl https://api.stripe.com/v1/customers/{{CUSTOMER_ID}}/funding_instructions \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d funding_type=bank_transfer \  -d currency=eur \  -d "bank_transfer[type]=eu_bank_transfer" \  -d "bank_transfer[eu_bank_transfer][country]=DE"
```

Response

```
{  "object": "funding_instructions",  "bank_transfer": {    "country": "DE",    "financial_addresses": [      {        "iban": {          "account_holder_address": {            "city": "Dublin",            "country": "IE",            "line1": "Some address",            "line2": null,            "postal_code": "D01H104",            "state": "Dublin 1"          },          "account_holder_name": "Merchant name",          "bank_address": {            "city": "Dublin",            "country": "IE",            "line1": "1 North Wall Quay",            "line2": null,            "postal_code": "D01 T8Y1",            "state": "Dublin"          },          "bic": "SOGEDEFFXXX",          "country": "DE",          "iban": "DE006847740991234567890"        },        "supported_networks": [          "sepa",          "swift"        ],        "type": "iban"      }    ],    "type": "eu_bank_transfer"  },  "currency": "eur",  "funding_type": "bank_transfer",  "livemode": false}
```
