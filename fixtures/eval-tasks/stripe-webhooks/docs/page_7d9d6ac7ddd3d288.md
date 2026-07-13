# [Retrieve balance settings](/api/balance-settings/retrieve)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/balance\_settings

Retrieves balance settings for a given connected account. Related guide: [Making API calls for connected accounts](/connect/authentication)

### Parameters

No parameters.

### Returns

Returns a balance settings object for the account specified in the request.

```
curl https://api.stripe.com/v1/balance_settings \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -H "Stripe-Account: {{CONNECTED_ACCOUNT_ID}}"
```

Response

```
{  "object": "balance_settings",  "payments": {    "debit_negative_balances": true,    "payouts": {      "automatic_transfer_rules_by_currency": {        "usd": [          {            "type": "transfer_all",            "payout_method": "fa_1ABC"          }        ]      },      "minimum_balance_by_currency": {        "usd": 1500,        "cad": 8000      },      "schedule": {        "interval": "weekly",        "weekly_payout_days": [          "monday",          "wednesday"        ]      },      "statement_descriptor": null,      "status": "enabled"    },    "settlement_timing": {      "delay_days_override": 3,      "delay_days": 3    }  }}
```
