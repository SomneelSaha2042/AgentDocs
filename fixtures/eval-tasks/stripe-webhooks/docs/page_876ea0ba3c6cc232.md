# [Invoice Items](/api/invoiceitems)

Ask about this section

Copy for LLM

View as Markdown

Invoice Items represent the component lines of an [invoice](/api/invoices). When you create an invoice item with an `invoice` field, it is attached to the specified invoice and included as [an invoice line item](/api/invoices/line_item) within [invoice.lines](/api/invoices/object#invoice_object-lines).

Invoice Items can be created before you are ready to actually send the invoice. This can be particularly useful when combined with a [subscription](/api/subscriptions). Sometimes you want to add a charge or credit to a customer, but actually charge or credit the customer’s card only at the end of a regular billing cycle. This is useful for combining several charges (to minimize per-transaction fees), or for having Stripe tabulate your usage-based billing totals.

Related guides: [Integrate with the Invoicing API](/invoicing/integration), [Subscription Invoices](/billing/invoices/subscription#adding-upcoming-invoice-items).

Was this section helpful?YesNo

[](/api/invoiceitems/create)

Create an invoice item

POST/v1/invoiceitems

[](/api/invoiceitems/update)

Update an invoice item

POST/v1/invoiceitems/:id

[](/api/invoiceitems/retrieve)

Retrieve an invoice item

GET/v1/invoiceitems/:id

[](/api/invoiceitems/list)

List all invoice items

GET/v1/invoiceitems

[](/api/invoiceitems/delete)

Delete an invoice item

DELETE/v1/invoiceitems/:id

# [The Invoice Item object](/api/invoiceitems/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    amountinteger
    
    Amount (in the `currency` specified) of the invoice item. This should always be equal to `unit_amount * quantity`.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    customerstringExpandable
    
    The ID of the customer to bill for this invoice item.
    
-   #### 
    
    customer\_accountnullable string
    
    The ID of the account to bill for this invoice item.
    
-   #### 
    
    descriptionnullable string
    
    An arbitrary string attached to the object. Often useful for displaying to users.
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    parentnullable object
    
    The parent that generated this invoice item.
    
    Show child attributes
    
-   #### 
    
    periodobject
    
    The period associated with this invoice item. When set to different values, the period will be rendered on the invoice. If you have [Stripe Revenue Recognition](/revenue-recognition) enabled, the period will be used to recognize and defer revenue. See the [Revenue Recognition documentation](/revenue-recognition/methodology/subscriptions-and-invoicing) for details.
    
    Show child attributes
    
-   #### 
    
    pricingnullable object
    
    The pricing information of the invoice item.
    
    Show child attributes
    
-   #### 
    
    prorationboolean
    
    Whether the invoice item was created automatically as a proration adjustment when the customer switched plans.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    datetimestamp
    
-   #### 
    
    discountableboolean
    
-   #### 
    
    discountsnullable array of stringsExpandable
    
-   #### 
    
    invoicenullable stringExpandable
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    net\_amountnullable integer
    
-   #### 
    
    proration\_detailsnullable object
    
-   #### 
    
    quantityintegerDeprecated
    
-   #### 
    
    quantity\_decimaldecimal string
    
-   #### 
    
    tax\_ratesnullable array of objects
    
-   #### 
    
    test\_clocknullable stringExpandable
    

The Invoice Item object

```
{  "id": "ii_1MtGUtLkdIwHu7ixBYwjAM00",  "object": "invoiceitem",  "amount": 1099,  "currency": "usd",  "customer": "cus_NeZei8imSbMVvi",  "date": 1680640231,  "description": "T-shirt",  "discountable": true,  "discounts": [],  "invoice": null,  "livemode": false,  "metadata": {},  "parent": null,  "period": {    "end": 1680640231,    "start": 1680640231  },  "pricing": {    "price_details": {      "price": "price_1MtGUsLkdIwHu7ix1be5Ljaj",      "product": "prod_NeZe7xbBdJT8EN"    },    "type": "price_details",    "unit_amount_decimal": "1099"  },  "proration": false,  "quantity": 1,  "quantity_decimal": "1",  "tax_rates": [],  "test_clock": null}
```

# [Create an invoice item](/api/invoiceitems/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/invoiceitems

Creates an item to be added to a draft invoice (up to 250 items per invoice). If no invoice is specified, the item will be on the next invoice created for the customer specified.

### Parameters

-   #### 
    
    amountinteger
    
    The integer amount in the smallest currency unit of the charge to be applied to the upcoming invoice. Passing in a negative `amount` will reduce the `amount_due` on the invoice.
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    customerstring
    
    The ID of the customer to bill for this invoice item.
    
-   #### 
    
    customer\_accountstring
    
    The ID of the account representing the customer to bill for this invoice item.
    
-   #### 
    
    descriptionstring
    
    An arbitrary string which you can attach to the invoice item. The description is displayed in the invoice for easy tracking.
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    periodobject
    
    The period associated with this invoice item. When set to different values, the period will be rendered on the invoice. If you have [Stripe Revenue Recognition](/revenue-recognition) enabled, the period will be used to recognize and defer revenue. See the [Revenue Recognition documentation](/revenue-recognition/methodology/subscriptions-and-invoicing) for details.
    
    Show child parameters
    
-   #### 
    
    pricingobject
    
    The pricing information for the invoice item.
    
    Show child parameters
    

### More parameters

Expand all

-   #### 
    
    discountableboolean
    
-   #### 
    
    discountsarray of objects
    
-   #### 
    
    invoicestring
    
-   #### 
    
    price\_dataobject
    
-   #### 
    
    quantityintegerDeprecated
    
-   #### 
    
    quantity\_decimalstring
    
-   #### 
    
    subscriptionstring
    
-   #### 
    
    tax\_behaviorenumRecommended if calculating taxes
    
-   #### 
    
    tax\_codestringRecommended if calculating taxes
    
-   #### 
    
    tax\_ratesarray of strings
    
-   #### 
    
    unit\_amount\_decimalstring
    

### Returns

The created invoice item object is returned if successful. Otherwise, this call raises [an error](#errors).

```
curl https://api.stripe.com/v1/invoiceitems \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d customer={{CUSTOMER_ID}} \  -d "pricing[price]={{PRICE_ID}}"
```

Response

```
{  "id": "ii_1MtGUtLkdIwHu7ixBYwjAM00",  "object": "invoiceitem",  "amount": 1099,  "currency": "usd",  "customer": "cus_NeZei8imSbMVvi",  "date": 1680640231,  "description": "T-shirt",  "discountable": true,  "discounts": [],  "invoice": null,  "livemode": false,  "metadata": {},  "parent": null,  "period": {    "end": 1680640231,    "start": 1680640231  },  "pricing": {    "price_details": {      "price": "price_1MtGUsLkdIwHu7ix1be5Ljaj",      "product": "prod_NeZe7xbBdJT8EN"    },    "type": "price_details",    "unit_amount_decimal": "1099"  },  "proration": false,  "quantity": 1,  "quantity_decimal": "1",  "tax_rates": [],  "test_clock": null}
```
