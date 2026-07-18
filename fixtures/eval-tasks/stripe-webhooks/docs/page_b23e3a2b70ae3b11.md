# [Setup Attempts](/api/setup_attempts)

Ask about this section

Copy for LLM

View as Markdown

A SetupAttempt describes one attempted confirmation of a SetupIntent, whether that confirmation is successful or unsuccessful. You can use SetupAttempts to inspect details of a specific attempt at setting up a payment method using a SetupIntent.

Was this section helpful?YesNo

[](/api/setup_attempts/list)

List all SetupAttempts

GET/v1/setup\_attempts

# [The SetupAttempt object](/api/setup_attempts/object)

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
    
    applicationnullable stringExpandable
    
    The value of [application](/api/setup_intents/object#setup_intent_object-application) on the SetupIntent at the time of this confirmation.
    
-   #### 
    
    attach\_to\_selfnullable boolean
    
    If present, the SetupIntent’s payment method will be attached to the in-context Stripe Account.
    
    It can only be used for this Stripe Account’s own money movement flows like InboundTransfer and OutboundTransfers. It cannot be set to true when setting up a PaymentMethod for a Customer, and defaults to false when attaching a PaymentMethod to a Customer.
    
-   #### 
    
    createdtimestampretrievable with publishable key
    
    Time at which the object was created. Measured in seconds since the Unix epoch.
    
-   #### 
    
    customernullable stringExpandable
    
    The value of [customer](/api/setup_intents/object#setup_intent_object-customer) on the SetupIntent at the time of this confirmation.
    
-   #### 
    
    customer\_accountnullable string
    
    The value of [customer\_account](/api/setup_intents/object#setup_intent_object-customer_account) on the SetupIntent at the time of this confirmation.
    
-   #### 
    
    flow\_directionsnullable array of enums
    
    Indicates the directions of money movement for which this payment method is intended to be used.
    
    Include `inbound` if you intend to use the payment method as the origin to pull funds from. Include `outbound` if you intend to use the payment method as the destination to send funds to. You can include both if you intend to use the payment method for both purposes.
    
    Possible enum values
    
    `inbound`
    
    `outbound`
    
-   #### 
    
    livemodebooleanretrievable with publishable key
    
    If the object exists in live mode, the value is `true`. If the object exists in test mode, the value is `false`.
    
-   #### 
    
    on\_behalf\_ofnullable stringExpandable
    
    The value of [on\_behalf\_of](/api/setup_intents/object#setup_intent_object-on_behalf_of) on the SetupIntent at the time of this confirmation.
    
-   #### 
    
    payment\_methodstringExpandableretrievable with publishable key
    
    ID of the payment method used with this SetupAttempt.
    
-   #### 
    
    payment\_method\_detailsobject
    
    Details about the payment method at the time of SetupIntent confirmation.
    
    Show child attributes
    
-   #### 
    
    setup\_errornullable object
    
    The error encountered during this attempt to confirm the SetupIntent, if any.
    
    Show child attributes
    
-   #### 
    
    setup\_intentstringExpandable
    
    ID of the SetupIntent that this attempt belongs to.
    
-   #### 
    
    statusstring
    
    Status of this SetupAttempt, one of `requires_confirmation`, `requires_action`, `processing`, `succeeded`, `failed`, or `abandoned`.
    
-   #### 
    
    usagestring
    
    The value of [usage](/api/setup_intents/object#setup_intent_object-usage) on the SetupIntent at the time of this confirmation, one of `off_session` or `on_session`.
    

The SetupAttempt object

```
{  "id": "setatt_1ErTsH2eZvKYlo2CI7ukcoF7",  "object": "setup_attempt",  "application": null,  "created": 1562004309,  "customer": null,  "flow_directions": null,  "livemode": false,  "on_behalf_of": null,  "payment_method": "pm_1ErTsG2eZvKYlo2CH0DNen59",  "payment_method_details": {    "card": {      "three_d_secure": null    },    "type": "card"  },  "setup_error": null,  "setup_intent": "seti_1ErTsG2eZvKYlo2CKaT8MITz",  "status": "succeeded",  "usage": "off_session"}
```

# [List all SetupAttempts](/api/setup_attempts/list)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/setup\_attempts

Returns a list of SetupAttempts that associate with a provided SetupIntent.

### Parameters

-   #### 
    
    setup\_intentstringRequired
    
    Only return SetupAttempts created by the SetupIntent specified by this ID.
    

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

A dictionary with a `data` property that contains an array of up to `limit` SetupAttempts that are created by the specified SetupIntent, which start after SetupAttempts `starting_after`. Each entry in the array is a separate SetupAttempts object. If no other SetupAttempts are available, the resulting array is be empty. This request should never raise an error.

```
curl -G https://api.stripe.com/v1/setup_attempts \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d limit=3 \  -d setup_intent={{SETUP_INTENT_ID}}
```

Response

```
{  "object": "list",  "url": "/v1/setup_attempts",  "has_more": false,  "data": [    {      "id": "setatt_1ErTsH2eZvKYlo2CI7ukcoF7",      "object": "setup_attempt",      "application": null,      "created": 1562004309,      "customer": null,      "flow_directions": null,      "livemode": false,      "on_behalf_of": null,      "payment_method": "pm_1ErTsG2eZvKYlo2CH0DNen59",      "payment_method_details": {        "card": {          "three_d_secure": null        },        "type": "card"      },      "setup_error": null,      "setup_intent": "seti_1ErTsG2eZvKYlo2CKaT8MITz",      "status": "succeeded",      "usage": "off_session"    }  ]}
```
