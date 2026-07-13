# [Credit Note](/api/credit_notes)

Ask about this section

Copy for LLM

View as Markdown

Issue a credit note to adjust an invoice’s amount after the invoice is finalized.

Related guide: [Credit notes](/billing/invoices/credit-notes)

Was this section helpful?YesNo

[](/api/credit_notes/create)

Create a credit note

POST/v1/credit\_notes

[](/api/credit_notes/update)

Update a credit note

POST/v1/credit\_notes/:id

[](/api/credit_notes/retrieve)

Retrieve a credit note

GET/v1/credit\_notes/:id

[](/api/credit_notes/preview_lines)

Retrieve a credit note preview's line items

GET/v1/credit\_notes/preview/lines

[](/api/credit_notes/lines)

Retrieve a credit note's line items

GET/v1/credit\_notes/:id/lines

[](/api/credit_notes/list)

List all credit notes

GET/v1/credit\_notes

[](/api/credit_notes/preview)

Preview a credit note

GET/v1/credit\_notes/preview

[](/api/credit_notes/void)

Void a credit note

POST/v1/credit\_notes/:id/void

# [The Credit Note object](/api/credit_notes/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    invoicestringExpandable
    
    ID of the invoice.
    
-   #### 
    
    linesobject
    
    Line items that make up the credit note
    
    Show child attributes
    
-   #### 
    
    memonullable string
    
    Customer-facing text that appears on the credit note PDF.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    reasonnullable enum
    
    Reason for issuing this credit note, one of `duplicate`, `fraudulent`, `order_change`, or `product_unsatisfactory`
    
    Possible enum values
    
    `duplicate`
    
    Credit issued for a duplicate payment or charge
    
    `fraudulent`
    
    Credit note issued for fraudulent activity
    
    `order_change`
    
    Credit note issued for order change
    
    `product_unsatisfactory`
    
    Credit note issued for unsatisfactory product
    
-   #### 
    
    statusenum
    
    Status of this credit note, one of `issued` or `void`. Learn more about [voiding credit notes](/billing/invoices/credit-notes#voiding).
    
    Possible enum values
    
    `issued`
    
    The credit note has been issued.
    
    `void`
    
    The credit note has been voided.
    
-   #### 
    
    subtotalinteger
    
    The integer amount in the smallest currency unit representing the amount of the credit note, excluding exclusive tax and invoice level discounts.
    
-   #### 
    
    totalinteger
    
    The integer amount in the smallest currency unit representing the total amount of the credit note, including tax and all discount.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    amountinteger
    
-   #### 
    
    amount\_shippinginteger
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    customerstringExpandable
    
-   #### 
    
    customer\_accountnullable string
    
-   #### 
    
    customer\_balance\_transactionnullable stringExpandable
    
-   #### 
    
    discount\_amountintegerDeprecated
    
-   #### 
    
    discount\_amountsarray of objects
    
-   #### 
    
    effective\_atnullable timestamp
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    numberstring
    
-   #### 
    
    out\_of\_band\_amountnullable integer
    
-   #### 
    
    pdfstring
    
-   #### 
    
    post\_payment\_amountinteger
    
-   #### 
    
    pre\_payment\_amountinteger
    
-   #### 
    
    pretax\_credit\_amountsarray of objects
    
-   #### 
    
    refundsarray of objects
    
-   #### 
    
    shipping\_costnullable object
    
-   #### 
    
    subtotal\_excluding\_taxnullable integer
    
-   #### 
    
    total\_excluding\_taxnullable integer
    
-   #### 
    
    total\_taxesnullable array of objects
    
-   #### 
    
    typeenum
    
-   #### 
    
    voided\_atnullable timestamp
    

The Credit Note object

```
{  "id": "cn_1MxvRqLkdIwHu7ixY0xbUcxk",  "object": "credit_note",  "amount": 1099,  "amount_shipping": 0,  "created": 1681750958,  "currency": "usd",  "customer": "cus_NjLgPhUokHubJC",  "customer_balance_transaction": null,  "discount_amount": 0,  "discount_amounts": [],  "invoice": "in_1MxvRkLkdIwHu7ixABNtI99m",  "lines": {    "object": "list",    "data": [      {        "id": "cnli_1MxvRqLkdIwHu7ixFpdhBFQf",        "object": "credit_note_line_item",        "amount": 1099,        "description": "T-shirt",        "discount_amount": 0,        "discount_amounts": [],        "invoice_line_item": "il_1MxvRlLkdIwHu7ixnkbntxUV",        "livemode": false,        "quantity": 1,        "tax_rates": [],        "taxes": [],        "type": "invoice_line_item",        "unit_amount": 1099,        "unit_amount_decimal": "1099"      }    ],    "has_more": false,    "url": "/v1/credit_notes/cn_1MxvRqLkdIwHu7ixY0xbUcxk/lines"  },  "livemode": false,  "memo": null,  "metadata": {},  "number": "C9E0C52C-0036-CN-01",  "out_of_band_amount": null,  "pdf": "https://pay.stripe.com/credit_notes/acct_1M2JTkLkdIwHu7ix/test_YWNjdF8xTTJKVGtMa2RJd0h1N2l4LF9Oak9FOUtQNFlPdk52UXhFd2Z4SU45alpEd21kd0Y4LDcyMjkxNzU50200cROQsSK2/pdf?s=ap",  "pre_payment_amount": 1099,  "post_payment_amount": 0,  "reason": null,  "refunds": [],  "shipping_cost": null,  "status": "issued",  "subtotal": 1099,  "subtotal_excluding_tax": 1099,  "total": 1099,  "total_excluding_tax": 1099,  "total_taxes": [],  "type": "pre_payment",  "voided_at": null}
```

# [The Credit Note Line Item object](/api/credit_notes/line_item)

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
    
    amountinteger
    
    The integer amount in the smallest currency unit representing the gross amount being credited for this line item, excluding (exclusive) tax and discounts.
    
-   #### 
    
    descriptionnullable string
    
    Description of the item being credited.
    
-   #### 
    
    discount\_amountintegerDeprecated
    
    The integer amount in the smallest currency unit representing the discount being credited for this line item.
    
-   #### 
    
    discount\_amountsarray of objects
    
    The amount of discount calculated per discount for this line item
    
    Show child attributes
    
-   #### 
    
    invoice\_line\_itemnullable string
    
    ID of the invoice line item being credited
    
-   #### 
    
    livemodeboolean
    
    If the object exists in live mode, the value is `true`. If the object exists in test mode, the value is `false`.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    pretax\_credit\_amountsarray of objects
    
    The pretax credit amounts (ex: discount, credit grants, etc) for this line item.
    
    Show child attributes
    
-   #### 
    
    quantitynullable integer
    
    The number of units of product being credited.
    
-   #### 
    
    tax\_ratesarray of objects
    
    The tax rates which apply to the line item.
    
    Show child attributes
    
-   #### 
    
    taxesnullable array of objects
    
    The tax information of the line item.
    
    Show child attributes
    
-   #### 
    
    typeenum
    
    The type of the credit note line item, one of `invoice_line_item` or `custom_line_item`. When the type is `invoice_line_item` there is an additional `invoice_line_item` property on the resource the value of which is the id of the credited line item on the invoice.
    
    Possible enum values
    
    `custom_line_item`
    
    `invoice_line_item`
    
-   #### 
    
    unit\_amountnullable integer
    
    The cost of each unit of product being credited.
    
-   #### 
    
    unit\_amount\_decimalnullable decimal string
    
    Same as `unit_amount`, but contains a decimal value with at most 12 decimal places.
    

The Credit Note Line Item object

```
{  "id": "cnli_1NPtOx2eZvKYlo2CBH1NpUsU",  "object": "credit_note_line_item",  "amount": 749,  "description": "My First Invoice Item (created for API docs)",  "discount_amount": 0,  "discount_amounts": [],  "invoice_line_item": "il_1NPtOx2eZvKYlo2CAUuq0WVl",  "livemode": false,  "quantity": 1,  "taxes": [],  "tax_rates": [],  "type": "invoice_line_item",  "unit_amount": null,  "unit_amount_decimal": null}
```
