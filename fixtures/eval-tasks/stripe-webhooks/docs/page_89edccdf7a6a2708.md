# [List all connected accounts](/api/accounts/list)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/accounts

Returns a list of accounts connected to your platform via [Connect](/connect). If you’re not a platform, the list is empty.

### Parameters

No parameters.

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

A dictionary with a `data` property that contains an array of up to `limit` accounts, starting after account `starting_after`. Each entry in the array is a separate [`Account`](/api/accounts/object) object. If no more accounts are available, the resulting array is empty.

```
curl -G https://api.stripe.com/v1/accounts \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d limit=3
```

Response

```
{  "object": "list",  "url": "/v1/accounts",  "has_more": false,  "data": [    {      "id": "acct_1Nv0FGQ9RKHgCVdK",      "object": "account",      "business_profile": {        "annual_revenue": null,        "estimated_worker_count": null,        "mcc": null,        "name": null,        "product_description": null,        "support_address": null,        "support_email": null,        "support_phone": null,        "support_url": null,        "url": null      },      "business_type": null,      "capabilities": {},      "charges_enabled": false,      "controller": {        "fees": {          "payer": "application"        },        "is_controller": true,        "losses": {          "payments": "application"        },        "requirement_collection": "stripe",        "stripe_dashboard": {          "type": "express"        },        "type": "application"      },      "country": "US",      "created": 1695830751,      "default_currency": "usd",      "details_submitted": false,      "email": "jenny.rosen@example.com",      "external_accounts": {        "object": "list",        "data": [],        "has_more": false,        "total_count": 0,        "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/external_accounts"      },      "future_requirements": {        "alternatives": [],        "current_deadline": null,        "currently_due": [],        "disabled_reason": null,        "errors": [],        "eventually_due": [],        "past_due": [],        "pending_verification": []      },      "login_links": {        "object": "list",        "total_count": 0,        "has_more": false,        "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/login_links",        "data": []      },      "metadata": {},      "payouts_enabled": false,      "requirements": {        "alternatives": [],        "current_deadline": null,        "currently_due": [          "business_profile.mcc",          "business_profile.url",          "business_type",          "external_account",          "representative.first_name",          "representative.last_name",          "tos_acceptance.date",          "tos_acceptance.ip"        ],        "disabled_reason": "requirements.past_due",        "errors": [],        "eventually_due": [          "business_profile.mcc",          "business_profile.url",          "business_type",          "external_account",          "representative.first_name",          "representative.last_name",          "tos_acceptance.date",          "tos_acceptance.ip"        ],        "past_due": [          "business_profile.mcc",          "business_profile.url",          "business_type",          "external_account",          "representative.first_name",          "representative.last_name",          "tos_acceptance.date",          "tos_acceptance.ip"        ],        "pending_verification": []      },      "settings": {        "bacs_debit_payments": {          "display_name": null,          "service_user_number": null        },        "branding": {          "icon": null,          "logo": null,          "primary_color": null,          "secondary_color": null        },        "card_issuing": {          "tos_acceptance": {            "date": null,            "ip": null          }        },        "card_payments": {          "decline_on": {            "avs_failure": false,            "cvc_failure": false          },          "statement_descriptor_prefix": null,          "statement_descriptor_prefix_kanji": null,          "statement_descriptor_prefix_kana": null        },        "dashboard": {          "display_name": null,          "timezone": "Etc/UTC"        },        "invoices": {          "default_account_tax_ids": null        },        "payments": {          "statement_descriptor": null,          "statement_descriptor_kana": null,          "statement_descriptor_kanji": null        },        "payouts": {          "debit_negative_balances": true,          "schedule": {            "delay_days": 2,            "interval": "daily"          },          "statement_descriptor": null        },        "sepa_debit_payments": {}      },      "tos_acceptance": {        "date": null,        "ip": null,        "user_agent": null      },      "type": "none"    }  ]}
```

# [Delete an account](/api/accounts/delete)

Ask about this section

Copy for LLM

View as Markdown

DELETE /v1/accounts/:id

With [Connect](/connect), you can delete accounts you manage.

Test-mode accounts can be deleted at any time.

Live-mode accounts that have access to the standard dashboard and Stripe is responsible for negative account balances cannot be deleted, which includes Standard accounts. All other Live-mode accounts, can be deleted when all [balances](/api/balance/balance_object) are zero.

If you want to delete your own account, use the [account information tab in your account settings](https://dashboard.stripe.com/settings/account) instead.

### Parameters

No parameters.

### Returns

Returns an object with a deleted parameter if the call succeeds. If the account ID does not exist, this call raises [an error](/api/errors).

```
curl -X DELETE https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}} \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "id": "acct_1Nv0FGQ9RKHgCVdK",  "object": "account",  "deleted": true}
```

# [Reject an account](/api/account/reject)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/accounts/:id/reject

With [Connect](/connect), you can reject accounts that you have flagged as suspicious.

Only accounts where your platform is liable for negative account balances, which includes Custom and Express accounts, can be rejected. Test-mode accounts can be rejected at any time. Live-mode accounts can only be rejected after all balances are zero.

### Parameters

-   #### 
    
    reasonstringRequired
    
    The reason for rejecting the account. Can be `fraud`, `terms_of_service`, or `other`.
    

### Returns

Returns an account with `payouts_enabled` and `charges_enabled` set to false on success. If the account ID does not exist, this call raises [an error](/api/errors).

```
curl https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}}/reject \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d reason=fraud
```

Response

```
{  "id": "acct_1Nv0FGQ9RKHgCVdK",  "object": "account",  "business_profile": {    "annual_revenue": null,    "estimated_worker_count": null,    "mcc": null,    "name": null,    "product_description": null,    "support_address": null,    "support_email": null,    "support_phone": null,    "support_url": null,    "url": null  },  "business_type": null,  "capabilities": {},  "charges_enabled": false,  "controller": {    "fees": {      "payer": "application"    },    "is_controller": true,    "losses": {      "payments": "application"    },    "requirement_collection": "stripe",    "stripe_dashboard": {      "type": "express"    },    "type": "application"  },  "country": "US",  "created": 1385798567,  "default_currency": "usd",  "details_submitted": true,  "email": "jenny.rosen@example.com",  "external_accounts": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/external_accounts"  },  "future_requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "login_links": {    "object": "list",    "total_count": 0,    "has_more": false,    "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/login_links",    "data": []  },  "metadata": {},  "payouts_enabled": true,  "requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [      "business_profile.mcc",      "business_profile.product_description",      "business_profile.support_phone",      "business_profile.url",      "business_type",      "external_account",      "person_8UayFKIMRJklog.first_name",      "person_8UayFKIMRJklog.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "disabled_reason": "rejected.fraud",    "errors": [],    "eventually_due": [      "business_profile.mcc",      "business_profile.product_description",      "business_profile.support_phone",      "business_profile.url",      "business_type",      "external_account",      "person_8UayFKIMRJklog.first_name",      "person_8UayFKIMRJklog.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "past_due": [      "business_profile.mcc",      "business_profile.product_description",      "business_profile.support_phone",      "business_profile.url",      "business_type",      "external_account",      "person_8UayFKIMRJklog.first_name",      "person_8UayFKIMRJklog.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "pending_verification": []  },  "settings": {    "bacs_debit_payments": {      "display_name": null,      "service_user_number": null    },    "branding": {      "icon": null,      "logo": null,      "primary_color": null,      "secondary_color": null    },    "card_issuing": {      "tos_acceptance": {        "date": null,        "ip": null      }    },    "card_payments": {      "decline_on": {        "avs_failure": false,        "cvc_failure": false      },      "statement_descriptor_prefix": null,      "statement_descriptor_prefix_kanji": null,      "statement_descriptor_prefix_kana": null    },    "dashboard": {      "display_name": null,      "timezone": "Etc/UTC"    },    "invoices": {      "default_account_tax_ids": null    },    "payments": {      "statement_descriptor": null,      "statement_descriptor_kana": null,      "statement_descriptor_kanji": null    },    "payouts": {      "debit_negative_balances": true,      "schedule": {        "delay_days": 2,        "interval": "daily"      },      "statement_descriptor": null    },    "sepa_debit_payments": {}  },  "tos_acceptance": {    "date": null,    "ip": null,    "user_agent": null  },  "type": "none"}
```
