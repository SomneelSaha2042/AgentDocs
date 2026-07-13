# [Product Feature](/api/product-feature)

Ask about this section

Copy for LLM

View as Markdown

A product\_feature represents an attachment between a feature and a product. When a product is purchased that has a feature attached, Stripe will create an entitlement to the feature for the purchasing customer.

Was this section helpful?YesNo

[](/api/product-feature/list)

List all features attached to a product

GET/v1/products/:id/features

[](/api/product-feature/attach)

Attach a feature to a product

POST/v1/products/:id/features

[](/api/product-feature/remove)

Remove a feature from a product

DELETE/v1/products/:id/features/:id

# [The ProductFeature object](/api/product-feature/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    entitlement\_featureobject
    
    The [Feature](/api/entitlements/feature) object attached to this product.
    
    Show child attributes
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    livemodeboolean
    

The ProductFeature object

```
{  "id": "prodft_BcMBZUWCIOEgEc",  "object": "product_feature",  "livemode": false,  "entitlement_feature": {    "id": "feat_test_61QGU1MWyFMSP9YBZ41ClCIKljWvsTgu",    "object": "entitlements.feature",    "livemode": false,    "name": "My super awesome feature",    "lookup_key": "my-super-awesome-feature",    "metadata": {}  }}
```

# [List all features attached to a product](/api/product-feature/list)

Ask about this section

Copy for LLM

View as Markdown

GET /v1/products/:id/features

Retrieve a list of features for a product

### Parameters

No parameters.

### More parameters

Expand all

-   #### 
    
    ending\_beforestring
    
-   #### 
    
    limitinteger
    
-   #### 
    
    starting\_afterstring
    

### Returns

Returns a list of features for a product

```
curl -G https://api.stripe.com/v1/products/{{PRODUCT_ID}}/features \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d limit=3
```

Response

```
{  "object": "list",  "url": "/v1/products/prod_NWjs8kKbJWmuuc/features",  "has_more": false,  "data": [    {      "id": "prodft_BcMBZUWCIOEgEc",      "object": "product_feature",      "livemode": false,      "entitlement_feature": {        "id": "feat_test_61QGU1MWyFMSP9YBZ41ClCIKljWvsTgu",        "object": "entitlements.feature",        "livemode": false,        "name": "My super awesome feature",        "lookup_key": "my-super-awesome-feature",        "metadata": {}      }    }  ]}
```
