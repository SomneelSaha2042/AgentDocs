# [Update an account](/api/accounts/update)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/accounts/:id

Updates a [connected account](/connect/accounts) by setting the values of the parameters passed. Any parameters not provided are left unchanged.

For accounts where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts, you can update any information on the account.

For accounts where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `stripe`, which includes Standard and Express accounts, you can update all information until you create an [Account Link](/api/account_links) or [Account Session](/api/account_sessions) to start Connect onboarding, after which some properties can no longer be updated.

To update your own account, use the [Dashboard](https://dashboard.stripe.com/settings/account). Refer to our [Connect](/connect/updating-accounts) documentation to learn more about updating accounts.

### Parameters

-   #### 
    
    business\_typeenum
    
    The business type. Once you create an [Account Link](/api/account_links) or [Account Session](/api/account_sessions), this property can only be updated for accounts where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts.
    
    Possible enum values
    
    `company`
    
    `government_entity`
    
    US only
    
    `individual`
    
    `non_profit`
    
-   #### 
    
    capabilitiesobject
    
    Each key of the dictionary represents a capability, and each capability maps to its settings (for example, whether it has been requested or not). Each capability is inactive until you have provided its specific requirements and Stripe has verified them. An account might have some of its requested capabilities be active and some be inactive.
    
    Required when [account.controller.stripe\_dashboard.type](/api/accounts/create#create_account-controller-dashboard-type) is `none`, which includes Custom accounts.
    
    Show child parameters
    
-   #### 
    
    companyobject
    
    Information about the company or business. This field is available for any `business_type`. Once you create an [Account Link](/api/account_links) or [Account Session](/api/account_sessions), this property can only be updated for accounts where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts.
    
    Show child parameters
    
-   #### 
    
    emailstring
    
    The email address of the account holder. This is only to make the account easier to identify to you. If [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts, Stripe doesn’t email the account without your consent.
    
    The maximum length is 800 characters.
    
-   #### 
    
    individualobject
    
    Information about the person represented by the account. This field is null unless `business_type` is set to `individual`. Once you create an [Account Link](/api/account_links) or [Account Session](/api/account_sessions), this property can only be updated for accounts where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts.
    
    Show child parameters
    
-   #### 
    
    metadataobject
    
    Set of [key-value pairs](/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to `metadata`.
    
-   #### 
    
    tos\_acceptanceobject
    
    Details on the account’s acceptance of the [Stripe Services Agreement](/connect/updating-accounts#tos-acceptance). This property can only be updated for accounts where [controller.requirement\_collection](/api/accounts/object#account_object-controller-requirement_collection) is `application`, which includes Custom accounts. This property defaults to a `full` service agreement when empty.
    
    Show child parameters
    

### More parameters

Expand all

-   #### 
    
    account\_tokenstring
    
-   #### 
    
    business\_profileobject
    
-   #### 
    
    default\_currencyenum
    
-   #### 
    
    documentsobject
    
-   #### 
    
    external\_accountstring
    
-   #### 
    
    groupsobject
    
-   #### 
    
    settingsobject
    

### Returns

Returns an [`Account`](#account_object) object if the call succeeds. If the account ID does not exist or another issue occurs, this call raises [an error](/api/errors). Some validations will not raise an error but will instead populate the [`requirements.errors`](#account_object-requirements-errors) array.

```
curl https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}} \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d "metadata[order_id]=6735"
```

Response

```
{  "id": "acct_1Nv0FGQ9RKHgCVdK",  "object": "account",  "business_profile": {    "annual_revenue": null,    "estimated_worker_count": null,    "mcc": null,    "name": null,    "product_description": null,    "support_address": null,    "support_email": null,    "support_phone": null,    "support_url": null,    "url": null  },  "business_type": null,  "capabilities": {},  "charges_enabled": false,  "controller": {    "fees": {      "payer": "application"    },    "is_controller": true,    "losses": {      "payments": "application"    },    "requirement_collection": "stripe",    "stripe_dashboard": {      "type": "express"    },    "type": "application"  },  "country": "US",  "created": 1695830751,  "default_currency": "usd",  "details_submitted": false,  "email": "jenny.rosen@example.com",  "external_accounts": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/external_accounts"  },  "future_requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "login_links": {    "object": "list",    "total_count": 0,    "has_more": false,    "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/login_links",    "data": []  },  "metadata": {    "order_id": "6735"  },  "payouts_enabled": false,  "requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [      "business_profile.mcc",      "business_profile.url",      "business_type",      "external_account",      "representative.first_name",      "representative.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "disabled_reason": "requirements.past_due",    "errors": [],    "eventually_due": [      "business_profile.mcc",      "business_profile.url",      "business_type",      "external_account",      "representative.first_name",      "representative.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "past_due": [      "business_profile.mcc",      "business_profile.url",      "business_type",      "external_account",      "representative.first_name",      "representative.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "pending_verification": []  },  "settings": {    "bacs_debit_payments": {      "display_name": null,      "service_user_number": null    },    "branding": {      "icon": null,      "logo": null,      "primary_color": null,      "secondary_color": null    },    "card_issuing": {      "tos_acceptance": {        "date": null,        "ip": null      }    },    "card_payments": {      "decline_on": {        "avs_failure": false,        "cvc_failure": false      },      "statement_descriptor_prefix": null,      "statement_descriptor_prefix_kanji": null,      "statement_descriptor_prefix_kana": null    },    "dashboard": {      "display_name": null,      "timezone": "Etc/UTC"    },    "invoices": {      "default_account_tax_ids": null    },    "payments": {      "statement_descriptor": null,      "statement_descriptor_kana": null,      "statement_descriptor_kanji": null    },    "payouts": {      "debit_negative_balances": true,      "schedule": {        "delay_days": 2,        "interval": "daily"      },      "statement_descriptor": null    },    "sepa_debit_payments": {}  },  "tos_acceptance": {    "date": null,    "ip": null,    "user_agent": null  },  "type": "none"}
```

# [Retrieve account](/api/accounts/retrieve)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/accounts/:id

Retrieves the details of an account.

### Parameters

No parameters.

### Returns

Returns an [`Account`](/api/accounts/object) object if the call succeeds. If the account ID does not exist, this call raises [an error](/api/errors).

```
curl https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}} \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "id": "acct_1Nv0FGQ9RKHgCVdK",  "object": "account",  "business_profile": {    "annual_revenue": null,    "estimated_worker_count": null,    "mcc": null,    "name": null,    "product_description": null,    "support_address": null,    "support_email": null,    "support_phone": null,    "support_url": null,    "url": null  },  "business_type": null,  "capabilities": {},  "charges_enabled": false,  "controller": {    "fees": {      "payer": "application"    },    "is_controller": true,    "losses": {      "payments": "application"    },    "requirement_collection": "stripe",    "stripe_dashboard": {      "type": "express"    },    "type": "application"  },  "country": "US",  "created": 1695830751,  "default_currency": "usd",  "details_submitted": false,  "email": "jenny.rosen@example.com",  "external_accounts": {    "object": "list",    "data": [],    "has_more": false,    "total_count": 0,    "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/external_accounts"  },  "future_requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [],    "disabled_reason": null,    "errors": [],    "eventually_due": [],    "past_due": [],    "pending_verification": []  },  "login_links": {    "object": "list",    "total_count": 0,    "has_more": false,    "url": "/v1/accounts/acct_1Nv0FGQ9RKHgCVdK/login_links",    "data": []  },  "metadata": {},  "payouts_enabled": false,  "requirements": {    "alternatives": [],    "current_deadline": null,    "currently_due": [      "business_profile.mcc",      "business_profile.url",      "business_type",      "external_account",      "representative.first_name",      "representative.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "disabled_reason": "requirements.past_due",    "errors": [],    "eventually_due": [      "business_profile.mcc",      "business_profile.url",      "business_type",      "external_account",      "representative.first_name",      "representative.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "past_due": [      "business_profile.mcc",      "business_profile.url",      "business_type",      "external_account",      "representative.first_name",      "representative.last_name",      "tos_acceptance.date",      "tos_acceptance.ip"    ],    "pending_verification": []  },  "settings": {    "bacs_debit_payments": {      "display_name": null,      "service_user_number": null    },    "branding": {      "icon": null,      "logo": null,      "primary_color": null,      "secondary_color": null    },    "card_issuing": {      "tos_acceptance": {        "date": null,        "ip": null      }    },    "card_payments": {      "decline_on": {        "avs_failure": false,        "cvc_failure": false      },      "statement_descriptor_prefix": null,      "statement_descriptor_prefix_kanji": null,      "statement_descriptor_prefix_kana": null    },    "dashboard": {      "display_name": null,      "timezone": "Etc/UTC"    },    "invoices": {      "default_account_tax_ids": null    },    "payments": {      "statement_descriptor": null,      "statement_descriptor_kana": null,      "statement_descriptor_kanji": null    },    "payouts": {      "debit_negative_balances": true,      "schedule": {        "delay_days": 2,        "interval": "daily"      },      "statement_descriptor": null    },    "sepa_debit_payments": {}  },  "tos_acceptance": {    "date": null,    "ip": null,    "user_agent": null  },  "type": "none"}
```

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
