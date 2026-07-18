# [Country Specs](/api/country_specs)

Ask about this section

Copy for LLM

View as Markdown

Stripe needs to collect certain pieces of information about each account created. These requirements can differ depending on the account’s country. The Country Specs API makes these rules available to your integration.

You can also view the information from this API call as [an online guide](/connect/required-verification-information).

Was this section helpful?YesNo

[](/api/country_specs/retrieve)

Retrieve a Country Spec

GET/v1/country\_specs/:id

[](/api/country_specs/list)

List Country Specs

GET/v1/country\_specs

# [The Country Spec object](/api/country_specs/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object. Represented as the ISO country code for this country.
    
-   #### 
    
    default\_currencystring
    
    The default currency for this country. This applies to both payment methods and bank accounts.
    
-   #### 
    
    supported\_bank\_account\_currenciesobject
    
    Currencies that can be accepted in the specific country (for transfers).
    
-   #### 
    
    supported\_payment\_currenciesarray of strings
    
    Currencies that can be accepted in the specified country (for payments).
    
-   #### 
    
    supported\_payment\_methodsarray of strings
    
    Payment methods available in the specified country. You may need to enable some payment methods (e.g., [ACH](https://stripe.com/docs/ach)) on your account before they appear in this list. The `stripe` payment method refers to [charging through your platform](https://stripe.com/docs/connect/destination-charges).
    
-   #### 
    
    supported\_transfer\_countriesarray of strings
    
    Countries that can accept transfers from the specified country.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    verification\_fieldsobject
    

The Country Spec object

```
{  "id": "US",  "object": "country_spec",  "default_currency": "usd",  "supported_bank_account_currencies": {    "usd": [      "US"    ]  },  "supported_payment_currencies": [    "usd",    "aed",    "afn",    "..."  ],  "supported_payment_methods": [    "ach",    "card",    "stripe"  ],  "supported_transfer_countries": [    "US",    "AE",    "AG",    "AL",    "AM",    "AR",    "AT",    "AU",    "BA",    "BE",    "BG",    "BH",    "BO",    "CA",    "CH",    "CI",    "CL",    "CO",    "CR",    "CY",    "CZ",    "DE",    "DK",    "DO",    "EC",    "EE",    "EG",    "ES",    "ET",    "FI",    "FR",    "GB",    "GH",    "GM",    "GR",    "GT",    "GY",    "HK",    "HR",    "HU",    "ID",    "IE",    "IL",    "IS",    "IT",    "JM",    "JO",    "JP",    "KE",    "KH",    "KR",    "KW",    "LC",    "LI",    "LK",    "LT",    "LU",    "LV",    "MA",    "MD",    "MG",    "MK",    "MN",    "MO",    "MT",    "MU",    "MX",    "MY",    "NA",    "NG",    "NL",    "NO",    "NZ",    "OM",    "PA",    "PE",    "PH",    "PL",    "PT",    "PY",    "QA",    "RO",    "RS",    "RW",    "SA",    "SE",    "SG",    "SI",    "SK",    "SN",    "SV",    "TH",    "TN",    "TR",    "TT",    "TZ",    "UY",    "UZ",    "VN",    "ZA",    "BD",    "BJ",    "MC",    "NE",    "SM",    "AZ",    "BN",    "BT",    "AO",    "DZ",    "TW",    "BS",    "BW",    "GA",    "LA",    "MZ",    "KZ",    "PK"  ],  "verification_fields": {    "company": {      "additional": [],      "minimum": [        "business_profile.mcc",        "business_profile.url",        "business_type",        "company.address.city",        "company.address.line1",        "company.address.postal_code",        "company.address.state",        "company.name",        "company.owners_provided",        "company.phone",        "company.tax_id",        "external_account",        "owners.address.city",        "owners.address.line1",        "owners.address.postal_code",        "owners.address.state",        "owners.dob.day",        "owners.dob.month",        "owners.dob.year",        "owners.email",        "owners.first_name",        "owners.id_number",        "owners.last_name",        "owners.phone",        "owners.ssn_last_4",        "owners.verification.document",        "representative.address.city",        "representative.address.line1",        "representative.address.postal_code",        "representative.address.state",        "representative.dob.day",        "representative.dob.month",        "representative.dob.year",        "representative.email",        "representative.first_name",        "representative.id_number",        "representative.last_name",        "representative.phone",        "representative.relationship.executive",        "representative.relationship.title",        "representative.ssn_last_4",        "representative.verification.document",        "tos_acceptance.date",        "tos_acceptance.ip"      ]    },    "individual": {      "additional": [],      "minimum": [        "business_profile.mcc",        "business_profile.url",        "business_type",        "external_account",        "individual.address.city",        "individual.address.line1",        "individual.address.postal_code",        "individual.address.state",        "individual.dob.day",        "individual.dob.month",        "individual.dob.year",        "individual.email",        "individual.first_name",        "individual.id_number",        "individual.last_name",        "individual.phone",        "individual.ssn_last_4",        "individual.verification.document",        "tos_acceptance.date",        "tos_acceptance.ip"      ]    }  }}
```

# [Retrieve a Country Spec](/api/country_specs/retrieve)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/country\_specs/:id

Returns a Country Spec for a given Country code.

### Parameters

No parameters.

### Returns

Returns a [country\_spec](#country_spec_object) object if a valid country code is provided, and raises [an error](#errors) otherwise.

```
curl https://api.stripe.com/v1/country_specs/US \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "id": "US",  "object": "country_spec",  "default_currency": "usd",  "supported_bank_account_currencies": {    "usd": [      "US"    ]  },  "supported_payment_currencies": [    "usd",    "aed",    "afn",    "..."  ],  "supported_payment_methods": [    "ach",    "card",    "stripe"  ],  "supported_transfer_countries": [    "US",    "AE",    "AG",    "AL",    "AM",    "AR",    "AT",    "AU",    "BA",    "BE",    "BG",    "BH",    "BO",    "CA",    "CH",    "CI",    "CL",    "CO",    "CR",    "CY",    "CZ",    "DE",    "DK",    "DO",    "EC",    "EE",    "EG",    "ES",    "ET",    "FI",    "FR",    "GB",    "GH",    "GM",    "GR",    "GT",    "GY",    "HK",    "HR",    "HU",    "ID",    "IE",    "IL",    "IS",    "IT",    "JM",    "JO",    "JP",    "KE",    "KH",    "KR",    "KW",    "LC",    "LI",    "LK",    "LT",    "LU",    "LV",    "MA",    "MD",    "MG",    "MK",    "MN",    "MO",    "MT",    "MU",    "MX",    "MY",    "NA",    "NG",    "NL",    "NO",    "NZ",    "OM",    "PA",    "PE",    "PH",    "PL",    "PT",    "PY",    "QA",    "RO",    "RS",    "RW",    "SA",    "SE",    "SG",    "SI",    "SK",    "SN",    "SV",    "TH",    "TN",    "TR",    "TT",    "TZ",    "UY",    "UZ",    "VN",    "ZA",    "BD",    "BJ",    "MC",    "NE",    "SM",    "AZ",    "BN",    "BT",    "AO",    "DZ",    "TW",    "BS",    "BW",    "GA",    "LA",    "MZ",    "KZ",    "PK"  ],  "verification_fields": {    "company": {      "additional": [],      "minimum": [        "business_profile.mcc",        "business_profile.url",        "business_type",        "company.address.city",        "company.address.line1",        "company.address.postal_code",        "company.address.state",        "company.name",        "company.owners_provided",        "company.phone",        "company.tax_id",        "external_account",        "owners.address.city",        "owners.address.line1",        "owners.address.postal_code",        "owners.address.state",        "owners.dob.day",        "owners.dob.month",        "owners.dob.year",        "owners.email",        "owners.first_name",        "owners.id_number",        "owners.last_name",        "owners.phone",        "owners.ssn_last_4",        "owners.verification.document",        "representative.address.city",        "representative.address.line1",        "representative.address.postal_code",        "representative.address.state",        "representative.dob.day",        "representative.dob.month",        "representative.dob.year",        "representative.email",        "representative.first_name",        "representative.id_number",        "representative.last_name",        "representative.phone",        "representative.relationship.executive",        "representative.relationship.title",        "representative.ssn_last_4",        "representative.verification.document",        "tos_acceptance.date",        "tos_acceptance.ip"      ]    },    "individual": {      "additional": [],      "minimum": [        "business_profile.mcc",        "business_profile.url",        "business_type",        "external_account",        "individual.address.city",        "individual.address.line1",        "individual.address.postal_code",        "individual.address.state",        "individual.dob.day",        "individual.dob.month",        "individual.dob.year",        "individual.email",        "individual.first_name",        "individual.id_number",        "individual.last_name",        "individual.phone",        "individual.ssn_last_4",        "individual.verification.document",        "tos_acceptance.date",        "tos_acceptance.ip"      ]    }  }}
```
