# [Create an Account Session](/api/account_sessions/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/account\_sessions

Creates a AccountSession object that includes a single-use token that the platform can use on their front-end to grant client-side API access.

### Parameters

-   #### 
    
    accountstringRequired
    
    The identifier of the account to create an Account Session for.
    
-   #### 
    
    componentsobjectRequired
    
    Each key of the dictionary represents an embedded component, and each embedded component maps to its configuration (e.g. whether it has been enabled or not).
    
    Show child parameters
    

### Returns

Returns an Account Session object if the call succeeded.

```
curl https://api.stripe.com/v1/account_sessions \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d account={{ACCOUNT_ID}} \  -d "components[account_onboarding][enabled]=true" \  -d "components[payments][enabled]=true" \  -d "components[payouts][enabled]=true" \  -d "components[balances][enabled]=true"
```

Response

```
{  "object": "account_session",  "account": "acct_1NkDjjJyhOZfPCWt",  "client_secret": "_OXIKXxEihJokDBnDoe2sgG5OGSO2Q12shKvbeboxpALZGng",  "expires_at": 1693261123,  "livemode": false,  "components": {    "account_management": {      "enabled": false,      "features": {        "external_account_collection": true,        "disable_stripe_user_authentication": false      }    },    "account_onboarding": {      "enabled": true,      "features": {        "external_account_collection": true,        "disable_stripe_user_authentication": false      }    },    "balance_report": {      "enabled": false,      "features": {}    },    "balances": {      "enabled": true,      "features": {        "edit_payout_schedule": false,        "instant_payouts": "disabled",        "standard_payouts": false,        "external_account_collection": true,        "disable_stripe_user_authentication": false      }    },    "documents": {      "enabled": false,      "features": {}    },    "financial_account": {      "enabled": false,      "features": {        "disable_stripe_user_authentication": false,        "external_account_collection": false,        "money_movement": false,        "send_money": false,        "transfer_balance": false      }    },    "financial_account_transactions": {      "enabled": false,      "features": {        "card_spend_dispute_management": false      }    },    "issuing_card": {      "enabled": false,      "features": {        "card_management": false,        "card_spend_dispute_management": false,        "cardholder_management": false,        "spend_control_management": false      }    },    "issuing_cards_list": {      "enabled": false,      "features": {        "card_management": false,        "card_spend_dispute_management": false,        "cardholder_management": false,        "disable_stripe_user_authentication": false,        "spend_control_management": false      }    },    "notification_banner": {      "enabled": false,      "features": {        "external_account_collection": true,        "disable_stripe_user_authentication": false      }    },    "payment_details": {      "enabled": false,      "features": {        "capture_payments": true,        "destination_on_behalf_of_charge_management": false,        "dispute_management": true,        "refund_management": true      }    },    "payments": {      "enabled": true,      "features": {        "capture_payments": true,        "destination_on_behalf_of_charge_management": false,        "dispute_management": true,        "refund_management": true      }    },    "disputes_list": {      "enabled": false,      "features": {        "capture_payments": true,        "destination_on_behalf_of_charge_management": false,        "dispute_management": true,        "refund_management": true      }    },    "payment_disputes": {      "enabled": false,      "features": {        "destination_on_behalf_of_charge_management": false,        "dispute_management": true,        "refund_management": true      }    },    "payouts": {      "enabled": true,      "features": {        "edit_payout_schedule": false,        "instant_payouts": "disabled",        "standard_payouts": false,        "external_account_collection": true,        "disable_stripe_user_authentication": false      }    },    "payouts_list": {      "enabled": false,      "features": {}    },    "tax_registrations": {      "enabled": false,      "features": {}    },    "tax_settings": {      "enabled": false,      "features": {}    },    "instant_payouts_promotion": {      "enabled": false,      "features": {        "disable_stripe_user_authentication": false,        "external_account_collection": true,        "instant_payouts": "disabled"      }    },    "payout_details": {      "enabled": false,      "features": {}    },    "payout_reconciliation_report": {      "enabled": false,      "features": {}    }  }}
```
