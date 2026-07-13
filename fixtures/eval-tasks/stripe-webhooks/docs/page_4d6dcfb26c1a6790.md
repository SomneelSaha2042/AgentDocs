# [Files](/api/files)

Ask about this section

Copy for LLM

View as Markdown

This object represents files hosted on Stripe’s servers. You can upload files with the [create file](#create_file) request (for example, when uploading dispute evidence). Stripe also creates files independently (for example, the results of a [Sigma scheduled query](#scheduled_queries)).

Related guide: [File upload guide](/file-upload)

Was this section helpful?YesNo

[](/api/files/create)

Create a file

POST/v1/files

[](/api/files/retrieve)

Retrieve a file

GET/v1/files/:id

[](/api/files/list)

List all files

GET/v1/files

# [The File object](/api/files/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    purposeenum
    
    The [purpose](/file-upload#uploading-a-file) of the uploaded file.
    
    Possible enum values
    
    `account_requirement`
    
    Additional documentation requirements that can be requested for an account.
    
    `additional_verification`
    
    Additional verification for custom accounts.
    
    `business_icon`
    
    A business icon.
    
    `business_logo`
    
    A business logo.
    
    `customer_signature`
    
    Customer signature image.
    
    `dispute_evidence`
    
    Evidence to submit with a dispute response.
    
    `finance_report_run`
    
    User-accessible copies of query results from the Reporting dataset.
    
    `financial_account_statement`
    
    Financial account statements.
    
    `identity_document`
    
    A document to verify the identity of an account owner during account provisioning.
    
    `identity_document_downloadable`
    
    Image of a document collected by Stripe Identity.
    
    Show 10 more
    
-   #### 
    
    typenullable string
    
    The returned file type (for example, `csv`, `pdf`, `jpg`, or `png`).
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    expires\_atnullable timestamp
    
-   #### 
    
    filenamenullable string
    
-   #### 
    
    linksnullable object
    
-   #### 
    
    sizeinteger
    
-   #### 
    
    titlenullable string
    
-   #### 
    
    urlnullable string
    

The File object

```
{  "id": "file_1Mr4LDLkdIwHu7ixFCz0dZiH",  "object": "file",  "created": 1680116847,  "expires_at": 1703444847,  "filename": "file.png",  "links": {    "object": "list",    "data": [],    "has_more": false,    "url": "/v1/file_links?file=file_1Mr4LDLkdIwHu7ixFCz0dZiH"  },  "purpose": "dispute_evidence",  "size": 8429,  "title": null,  "type": "png",  "url": "https://files.stripe.com/v1/files/file_1Mr4LDLkdIwHu7ixFCz0dZiH/contents"}
```

# [Create a file](/api/files/create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/files

To upload a file to Stripe, you need to send a request of type `multipart/form-data`. Include the file you want to upload in the request, and the parameters for creating a file.

All of Stripe’s officially supported Client libraries support sending `multipart/form-data`.

### Parameters

-   #### 
    
    fileobjectRequired
    
    A file to upload. Make sure that the specifications follow RFC 2388, which defines file transfers for the `multipart/form-data` protocol.
    
-   #### 
    
    purposeenumRequired
    
    The [purpose](/file-upload#uploading-a-file) of the uploaded file.
    
    Possible enum values
    
    `account_requirement`
    
    Additional documentation requirements that can be requested for an account.
    
    `additional_verification`
    
    Additional verification for custom accounts.
    
    `business_icon`
    
    A business icon.
    
    `business_logo`
    
    A business logo.
    
    `customer_signature`
    
    Customer signature image.
    
    `dispute_evidence`
    
    Evidence to submit with a dispute response.
    
    `identity_document`
    
    A document to verify the identity of an account owner during account provisioning.
    
    `issuing_regulatory_reporting`
    
    Additional regulatory reporting requirements for Issuing.
    
    `pci_document`
    
    A self-assessment PCI questionnaire.
    
    `platform_terms_of_service`
    
    A copy of the platform’s Terms of Service.
    
    Show 5 more
    

### More parameters

Expand all

-   #### 
    
    file\_link\_dataobject
    

### Returns

Returns the file object.

```
curl https://files.stripe.com/v1/files \  -u sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u: \  -F purpose=dispute_evidence \  -F file="@/path/to/a/file.jpg"
```

Response

```
{  "id": "file_1Mr4LDLkdIwHu7ixFCz0dZiH",  "object": "file",  "created": 1680116847,  "expires_at": 1703444847,  "filename": "file.png",  "links": {    "object": "list",    "data": [],    "has_more": false,    "url": "/v1/file_links?file=file_1Mr4LDLkdIwHu7ixFCz0dZiH"  },  "purpose": "dispute_evidence",  "size": 8429,  "title": null,  "type": "png",  "url": "https://files.stripe.com/v1/files/file_1Mr4LDLkdIwHu7ixFCz0dZiH/contents"}
```
