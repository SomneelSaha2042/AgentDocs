# [Cash Balance](/api/cash_balance)

Ask about this section

Copy for LLM

View as Markdown

A customer’s `Cash balance` represents real funds. Customers can add funds to their cash balance by sending a bank transfer. These funds can be used for payment and can eventually be paid out to your bank account.

Was this section helpful?YesNo

[](/api/cash_balance/update)

Update a cash balance's settings

POST/v1/customers/:id/cash\_balance

[](/api/cash_balance/retrieve)

Retrieve a cash balance

GET/v1/customers/:id/cash\_balance

# [The Cash balance object](/api/cash_balance/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    objectstring
    
    String representing the object’s type. Objects of the same type share the same value.
    
-   #### 
    
    availablenullable object
    
    A hash of all cash balances available to this customer. You cannot delete a customer with any cash balances, even if the balance is 0. Amounts are represented in the [smallest currency unit](/currencies#zero-decimal).
    
-   #### 
    
    customerstring
    
    The ID of the customer whose cash balance this object represents.
    
-   #### 
    
    customer\_accountnullable string
    
    The ID of an Account representing a customer whose cash balance this object represents.
    
-   #### 
    
    livemodeboolean
    
    If the object exists in live mode, the value is `true`. If the object exists in test mode, the value is `false`.
    
-   #### 
    
    settingsobject
    
    A hash of settings for this cash balance.
    
    Show child attributes
    

The Cash balance object

```
{  "object": "cash_balance",  "available": {    "eur": 10000  },  "customer": "cus_OaCLf8Fi1nbFpJ",  "livemode": false,  "settings": {    "reconciliation_mode": "automatic",    "using_merchant_default": true  }}
```

# [Update a cash balance's settings](/api/cash_balance/update)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/customers/:id/cash\_balance

Changes the settings on a customer’s cash balance.

### Parameters

-   #### 
    
    settingsobject
    
    A hash of settings for this cash balance.
    
    Show child parameters
    

### Returns

The customer’s cash balance, with the updated settings.

```
curl https://api.stripe.com/v1/customers/{{CUSTOMER_ID}}/cash_balance \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "settings[reconciliation_mode]=manual"
```

Response

```
{  "object": "cash_balance",  "available": null,  "customer": "cus_Ob4Xiw8KXOqcvM",  "livemode": false,  "settings": {    "reconciliation_mode": "manual",    "using_merchant_default": false  }}
```
