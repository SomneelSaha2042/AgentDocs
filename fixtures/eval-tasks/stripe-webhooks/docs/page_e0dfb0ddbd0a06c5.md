# [Login Links](/api/accounts/login_link)

Ask about this section

Copy for LLM

View as Markdown

Login Links are single-use URLs that takes an Express account to the login page for their Stripe dashboard. A Login Link differs from an [Account Link](/api/account_links) in that it takes the user directly to their [Express dashboard for the specified account](/connect/integrate-express-dashboard#create-login-link)

Was this section helpful?YesNo

[](/api/accounts/login_link/create)

Create a login link

POST/v1/accounts/:id/login\_links

# [The Login Link object](/api/accounts/login_link/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    urlstring
    
    The URL for the login link.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    createdtimestamp
    

The Login Link object

```
{  "object": "login_link",  "created": 1686084879,  "url": "https://connect.stripe.com/express/acct_1032D82eZvKYlo2C/F44eiGHh5sEV"}
```

# [Create a login link](/api/accounts/login_link/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/accounts/:id/login\_links

Creates a login link for a connected account to access the Express Dashboard.

**You can only create login links for accounts that use the [Express Dashboard](/connect/express-dashboard) and are connected to your platform**.

### Parameters

No parameters.

### Returns

Returns a login link object if the call succeeded.

```
curl -X POST https://api.stripe.com/v1/accounts/{{ACCOUNT_ID}}/login_links \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:"
```

Response

```
{  "object": "login_link",  "created": 1686084879,  "url": "https://connect.stripe.com/express/acct_1032D82eZvKYlo2C/F44eiGHh5sEV"}
```
