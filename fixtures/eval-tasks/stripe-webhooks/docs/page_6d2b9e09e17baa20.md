# [Invoices](/api/invoices)

Ask about this section

Copy for LLM

View as Markdown

Invoices are statements of amounts owed by a customer, and are either generated one-off, or generated periodically from a subscription.

They contain [invoice items](#invoiceitems), and proration adjustments that may be caused by subscription upgrades/downgrades (if necessary).

If your invoice is configured to be billed through automatic charges, Stripe automatically finalizes your invoice and attempts payment. Note that finalizing the invoice, [when automatic](/invoicing/integration/automatic-advancement-collection), does not happen immediately as the invoice is created. Stripe waits until one hour after the last webhook was successfully sent (or the last webhook timed out after failing). If you (and the platforms you may have connected to) have no webhooks configured, Stripe waits one hour after creation to finalize the invoice.

If your invoice is configured to be billed by sending an email, then based on your [email settings](https://dashboard.stripe.com/account/billing/automatic), Stripe will email the invoice to your customer and await payment. These emails can contain a link to a hosted page to pay the invoice.

Stripe applies any customer credit on the account before determining the amount due for the invoice (i.e., the amount that will be actually charged). If the amount due for the invoice is less than Stripe’s [minimum allowed charge per currency](/currencies#minimum-and-maximum-charge-amounts), the invoice is automatically marked paid, and we add the amount due to the customer’s credit balance which is applied to the next invoice.

More details on the customer’s credit balance are [here](/billing/customer/balance).

Related guide: [Send invoices to customers](/billing/invoices/sending)

Was this section helpful?YesNo

[](/api/invoices/create_preview)

Create a preview invoice

POST/v1/invoices/create\_preview

[](/api/invoices/create)

Create an invoice

POST/v1/invoices

[](/api/invoices/update)

Update an invoice

POST/v1/invoices/:id

[](/api/invoices/retrieve)

Retrieve an invoice

GET/v1/invoices/:id

[](/api/invoices/list)

List all invoices

GET/v1/invoices

[](/api/invoices/delete)

Delete a draft invoice

DELETE/v1/invoices/:id

[](/api/invoices/attach_payment)

Attach a payment to an Invoice

POST/v1/invoices/:id/attach\_payment

[](/api/invoices/finalize)

Finalize an invoice

POST/v1/invoices/:id/finalize

[](/api/invoices/mark_uncollectible)

Mark an invoice as uncollectible

POST/v1/invoices/:id/mark\_uncollectible

[](/api/invoices/pay)

Pay an invoice

POST/v1/invoices/:id/pay

[](/api/invoices/search)

Search invoices

GET/v1/invoices/search

[](/api/invoices/send)

Send an invoice for manual payment

POST/v1/invoices/:id/send

[](/api/invoices/void)

Void an invoice

POST/v1/invoices/:id/void

# [The Invoice object](/api/invoices/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object. For preview invoices created using the [create preview](https://stripe.com/docs/api/invoices/create_preview) endpoint, this id will be prefixed with `upcoming_in`.
    
-   #### 
    
    auto\_advanceboolean
    
    Controls whether Stripe performs [automatic collection](/invoicing/integration/automatic-advancement-collection) of the invoice. If `false`, the invoice’s state doesn’t automatically advance without an explicit action.
    
-   #### 
    
    automatic\_taxobject
    
    Settings and latest results for automatic tax lookup for this invoice.
    
    Show child attributes
    
-   #### 
    
    collection\_methodenum
    
    Either `charge_automatically`, or `send_invoice`. When charging automatically, Stripe will attempt to pay this invoice using the default source attached to the customer. When sending an invoice, Stripe will email this invoice to the customer with payment instructions.
    
    Possible enum values
    
    `charge_automatically`
    
    Attempt payment using the default source attached to the customer.
    
    `send_invoice`
    
    Email payment instructions to the customer.
    
-   #### 
    
    confirmation\_secretnullable objectExpandable
    
    The confirmation secret associated with this invoice. Currently, this contains the client\_secret of the PaymentIntent that Stripe creates during invoice finalization.
    
    Show child attributes
    
-   #### 
    
    currencyenum
    
    Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).
    
-   #### 
    
    customerstringExpandable
    
    The ID of the customer to bill.
    
-   #### 
    
    customer\_accountnullable string
    
    The ID of the account representing the customer to bill.
    
-   #### 
    
    descriptionnullable string
    
    An arbitrary string attached to the object. Often useful for displaying to users. Referenced as ‘memo’ in the Dashboard.
    
-   #### 
    
    hosted\_invoice\_urlnullable string
    
    The URL for the hosted invoice page, which allows customers to view and pay an invoice. If the invoice has not been finalized yet, this will be null.
    
-   #### 
    
    linesobject
    
    The individual line items that make up the invoice. `lines` is sorted as follows: (1) pending invoice items (including prorations) in reverse chronological order, (2) subscription items in reverse chronological order, and (3) invoice items added after invoice creation in chronological order.
    
    Show child attributes
    
-   #### 
    
    metadatanullable object
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.
    
-   #### 
    
    parentnullable object
    
    The parent that generated this invoice
    
    Show child attributes
    
-   #### 
    
    paymentsobjectExpandable
    
    Payments for this invoice. Use [invoice payment](/api/invoice-payment) to get more details.
    
    Show child attributes
    
-   #### 
    
    period\_endtimestamp
    
    The latest timestamp at which invoice items can be associated with this invoice. Use the [line item period](/api/invoices/line_item#invoice_line_item_object-period) to get the service period for each price.
    
-   #### 
    
    period\_starttimestamp
    
    The earliest timestamp at which invoice items can be associated with this invoice. Use the [line item period](/api/invoices/line_item#invoice_line_item_object-period) to get the service period for each price.
    
-   #### 
    
    statusnullable enum
    
    The status of the invoice, one of `draft`, `open`, `paid`, `uncollectible`, or `void`. [Learn more](/billing/invoices/workflow#workflow-overview)
    
-   #### 
    
    totalinteger
    
    Total after discounts and taxes.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    account\_countrynullable string
    
-   #### 
    
    account\_namenullable string
    
-   #### 
    
    account\_tax\_idsnullable array of stringsExpandable
    
-   #### 
    
    amount\_dueinteger
    
-   #### 
    
    amount\_overpaidinteger
    
-   #### 
    
    amount\_paidinteger
    
-   #### 
    
    amount\_paid\_off\_stripeintegerExpandable
    
-   #### 
    
    amount\_remaininginteger
    
-   #### 
    
    amount\_shippinginteger
    
-   #### 
    
    applicationnullable stringExpandableConnect only
    
-   #### 
    
    attempt\_countinteger
    
-   #### 
    
    attemptedboolean
    
-   #### 
    
    automatically\_finalizes\_atnullable timestamp
    
-   #### 
    
    billing\_reasonnullable enum
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    custom\_fieldsnullable array of objects
    
-   #### 
    
    customer\_addressnullable object
    
-   #### 
    
    customer\_emailnullable string
    
-   #### 
    
    customer\_namenullable string
    
-   #### 
    
    customer\_phonenullable string
    
-   #### 
    
    customer\_shippingnullable object
    
-   #### 
    
    customer\_tax\_exemptnullable enum
    
-   #### 
    
    customer\_tax\_idsnullable array of objects
    
-   #### 
    
    default\_payment\_methodnullable stringExpandable
    
-   #### 
    
    default\_sourcenullable stringExpandable
    
-   #### 
    
    default\_tax\_ratesarray of objects
    
-   #### 
    
    discountsarray of stringsExpandable
    
-   #### 
    
    due\_datenullable timestamp
    
-   #### 
    
    effective\_atnullable timestamp
    
-   #### 
    
    ending\_balancenullable integer
    
-   #### 
    
    footernullable string
    
-   #### 
    
    from\_invoicenullable object
    
-   #### 
    
    invoice\_pdfnullable string
    
-   #### 
    
    issuerobjectConnect only
    
-   #### 
    
    last\_finalization\_errornullable object
    
-   #### 
    
    latest\_revisionnullable stringExpandable
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    next\_payment\_attemptnullable timestamp
    
-   #### 
    
    numbernullable string
    
-   #### 
    
    on\_behalf\_ofnullable stringExpandableConnect only
    
-   #### 
    
    payment\_settingsobject
    
-   #### 
    
    post\_payment\_credit\_notes\_amountinteger
    
-   #### 
    
    pre\_payment\_credit\_notes\_amountinteger
    
-   #### 
    
    receipt\_numbernullable string
    
-   #### 
    
    renderingnullable object
    
-   #### 
    
    shipping\_costnullable object
    
-   #### 
    
    shipping\_detailsnullable object
    
-   #### 
    
    starting\_balanceinteger
    
-   #### 
    
    statement\_descriptornullable string
    
-   #### 
    
    status\_transitionsobject
    
-   #### 
    
    subtotalinteger
    
-   #### 
    
    subtotal\_excluding\_taxnullable integer
    
-   #### 
    
    test\_clocknullable stringExpandable
    
-   #### 
    
    threshold\_reasonnullable object
    
-   #### 
    
    total\_discount\_amountsnullable array of objects
    
-   #### 
    
    total\_excluding\_taxnullable integer
    
-   #### 
    
    total\_pretax\_credit\_amountsnullable array of objects
    
-   #### 
    
    total\_taxesnullable array of objects
    
-   #### 
    
    webhooks\_delivered\_atnullable timestamp
    

The Invoice object

```
{  "id": "in_1MtHbELkdIwHu7ixl4OzzPMv",  "object": "invoice",  "account_country": "US",  "account_name": "Stripe Docs",  "account_tax_ids": null,  "amount_due": 0,  "amount_paid": 0,  "amount_overpaid": 0,  "amount_remaining": 0,  "amount_shipping": 0,  "application": null,  "attempt_count": 0,  "attempted": false,  "auto_advance": false,  "automatic_tax": {    "enabled": false,    "liability": null,    "status": null  },  "billing_reason": "manual",  "collection_method": "charge_automatically",  "created": 1680644467,  "currency": "usd",  "custom_fields": null,  "customer": "cus_NeZwdNtLEOXuvB",  "customer_address": null,  "customer_email": "jennyrosen@example.com",  "customer_name": "Jenny Rosen",  "customer_phone": null,  "customer_shipping": null,  "customer_tax_exempt": "none",  "customer_tax_ids": [],  "confirmation_secret": null,  "default_payment_method": null,  "default_source": null,  "default_tax_rates": [],  "description": null,  "discounts": [],  "due_date": null,  "ending_balance": null,  "footer": null,  "from_invoice": null,  "hosted_invoice_url": null,  "invoice_pdf": null,  "issuer": {    "type": "self"  },  "last_finalization_error": null,  "latest_revision": null,  "lines": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/invoices/in_1MtHbELkdIwHu7ixl4OzzPMv/lines"  },  "payments": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/invoice_payments"  },  "livemode": false,  "metadata": {},  "next_payment_attempt": null,  "number": null,  "on_behalf_of": null,  "parent": null,  "payment_settings": {    "default_mandate": null,    "payment_method_options": null,    "payment_method_types": null  },  "period_end": 1680644467,  "period_start": 1680644467,  "post_payment_credit_notes_amount": 0,  "pre_payment_credit_notes_amount": 0,  "receipt_number": null,  "shipping_cost": null,  "shipping_details": null,  "starting_balance": 0,  "statement_descriptor": null,  "status": "draft",  "status_transitions": {    "finalized_at": null,    "marked_uncollectible_at": null,    "paid_at": null,    "voided_at": null  },  "subtotal": 0,  "subtotal_excluding_tax": 0,  "test_clock": null,  "total": 0,  "total_discount_amounts": [],  "total_excluding_tax": 0,  "total_taxes": [],  "transfer_data": null,  "webhooks_delivered_at": 1680644467}
```

# [Create a preview invoice](/api/invoices/create_preview)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/invoices/create\_preview

At any time, you can preview the upcoming invoice for a subscription or subscription schedule. This will show you all the charges that are pending, including subscription renewal charges, invoice item charges, etc. It will also show you any discounts that are applicable to the invoice.

You can also preview the effects of creating or updating a subscription or subscription schedule, including a preview of any prorations that will take place. To ensure that the actual proration is calculated exactly the same as the previewed proration, you should pass the `subscription_details.proration_date` parameter when doing the actual subscription update.

The recommended way to get only the prorations being previewed on the invoice is to consider line items where `parent.subscription_item_details.proration` is `true`.

Note that when you are viewing an upcoming invoice, you are simply viewing a preview – the invoice has not yet been created. As such, the upcoming invoice will not show up in invoice listing calls, and you cannot use the API to pay or edit the invoice. If you want to change the amount that your customer will be billed, you can add, remove, or update pending invoice items, or update the customer’s discount.

Note: Currency conversion calculations use the latest exchange rates. Exchange rates may vary between the time of the preview and the time of the actual invoice creation. [Learn more](https://docs.stripe.com/currencies/conversions)

### Parameters

-   #### 
    
    automatic\_taxobject
    
    Settings for automatic tax lookup for this invoice preview.
    
    Show child parameters
    
-   #### 
    
    customerstring
    
    The identifier of the customer whose upcoming invoice you’re retrieving. If `automatic_tax` is enabled then one of `customer`, `customer_details`, `subscription`, or `schedule` must be set.
    
-   #### 
    
    customer\_accountstring
    
    The identifier of the account representing the customer whose upcoming invoice you’re retrieving. If `automatic_tax` is enabled then one of `customer`, `customer_account`, `customer_details`, `subscription`, or `schedule` must be set.
    
-   #### 
    
    subscriptionstring
    
    The identifier of the subscription for which you’d like to retrieve the upcoming invoice. If not provided, but a `subscription_details.items` is provided, you will preview creating a subscription with those items. If neither `subscription` nor `subscription_details.items` is provided, you will retrieve the next upcoming invoice from among the customer’s subscriptions.
    

### More parameters

Expand all

-   #### 
    
    currencyenum
    
-   #### 
    
    customer\_detailsobject
    
-   #### 
    
    discountsarray of objects
    
-   #### 
    
    invoice\_itemsarray of objects
    
-   #### 
    
    issuerobjectConnect only
    
-   #### 
    
    on\_behalf\_ofstringConnect only
    
-   #### 
    
    preview\_modeenum
    
-   #### 
    
    schedulestring
    
-   #### 
    
    schedule\_detailsobject
    
-   #### 
    
    subscription\_detailsobject
    

### Returns

Returns an invoice if valid customer information is provided. Raises [an error](/api/errors) otherwise.

```
curl https://api.stripe.com/v1/invoices/create_preview \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d customer={{CUSTOMER_ID}}
```

Response

```
{  "id": "upcoming_in_1MtHbELkdIwHu7ixl4OzzPMv",  "object": "invoice",  "account_country": "US",  "account_name": "Stripe Docs",  "account_tax_ids": null,  "amount_due": 0,  "amount_paid": 0,  "amount_overpaid": 0,  "amount_remaining": 0,  "amount_shipping": 0,  "application": null,  "application_fee_amount": null,  "attempt_count": 0,  "attempted": false,  "auto_advance": false,  "automatic_tax": {    "enabled": false,    "status": null  },  "billing_reason": "manual",  "collection_method": "charge_automatically",  "created": 1680644467,  "currency": "usd",  "custom_fields": null,  "customer": "cus_NeZwdNtLEOXuvB",  "customer_address": null,  "customer_email": "jennyrosen@example.com",  "customer_name": "Jenny Rosen",  "customer_phone": null,  "customer_shipping": null,  "customer_tax_exempt": "none",  "customer_tax_ids": [],  "default_payment_method": null,  "default_source": null,  "default_tax_rates": [],  "description": null,  "discounts": [],  "due_date": null,  "ending_balance": null,  "footer": null,  "from_invoice": null,  "hosted_invoice_url": null,  "invoice_pdf": null,  "last_finalization_error": null,  "latest_revision": null,  "lines": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/invoices/in_1MtHbELkdIwHu7ixl4OzzPMv/lines"  },  "livemode": false,  "metadata": {},  "next_payment_attempt": null,  "number": null,  "on_behalf_of": null,  "parent": null,  "payment_settings": {    "default_mandate": null,    "payment_method_options": null,    "payment_method_types": null  },  "period_end": 1680644467,  "period_start": 1680644467,  "post_payment_credit_notes_amount": 0,  "pre_payment_credit_notes_amount": 0,  "receipt_number": null,  "shipping_cost": null,  "shipping_details": null,  "starting_balance": 0,  "statement_descriptor": null,  "status": "draft",  "status_transitions": {    "finalized_at": null,    "marked_uncollectible_at": null,    "paid_at": null,    "voided_at": null  },  "subtotal": 0,  "subtotal_excluding_tax": 0,  "test_clock": null,  "total": 0,  "total_discount_amounts": [],  "total_excluding_tax": 0,  "total_taxes": [],  "webhooks_delivered_at": 1680644467}
```
