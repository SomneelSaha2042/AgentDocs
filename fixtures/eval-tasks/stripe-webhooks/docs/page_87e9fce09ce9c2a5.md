# [Tax IDs](/api/tax_ids)

Ask about this section

Copy for LLM

View as Markdown

You can add one or multiple tax IDs to a [customer](/api/customers) or account. Customer and account tax IDs get displayed on related invoices and credit notes.

Related guides: [Customer tax identification numbers](/billing/taxes/tax-ids), [Account tax IDs](/invoicing/connect#account-tax-ids)

Was this section helpful?YesNo

[](/api/tax_ids/customer_create)

Create a Customer tax ID

POST/v1/customers/:id/tax\_ids

[](/api/tax_ids/create)

Create a tax ID

POST/v1/tax\_ids

[](/api/tax_ids/customer_retrieve)

Retrieve a Customer tax ID

GET/v1/customers/:id/tax\_ids/:id

[](/api/tax_ids/retrieve)

Retrieve a tax ID

GET/v1/tax\_ids/:id

[](/api/tax_ids/customer_list)

List all Customer tax IDs

GET/v1/customers/:id/tax\_ids

[](/api/tax_ids/list)

List all tax IDs

GET/v1/tax\_ids

[](/api/tax_ids/customer_delete)

Delete a Customer tax ID

DELETE/v1/customers/:id/tax\_ids/:id

[](/api/tax_ids/delete)

Delete a tax ID

DELETE/v1/tax\_ids/:id

# [The Tax ID object](/api/tax_ids/object)

Ask about this section

Copy for LLM

View as Markdown

### Attributes

-   #### 
    
    idstring
    
    Unique identifier for the object.
    
-   #### 
    
    countrynullable string
    
    Two-letter ISO code representing the country of the tax ID.
    
-   #### 
    
    customernullable stringExpandable
    
    ID of the customer.
    
-   #### 
    
    customer\_accountnullable string
    
    ID of the Account representing the customer.
    
-   #### 
    
    typeenum
    
    Type of the tax ID, one of `ad_nrt`, `ae_trn`, `al_tin`, `am_tin`, `ao_tin`, `ar_cuit`, `au_abn`, `au_arn`, `aw_tin`, `az_tin`, `ba_tin`, `bb_tin`, `bd_bin`, `bf_ifu`, `bg_uic`, `bh_vat`, `bj_ifu`, `bo_tin`, `br_cnpj`, `br_cpf`, `bs_tin`, `by_tin`, `ca_bn`, `ca_gst_hst`, `ca_pst_bc`, `ca_pst_mb`, `ca_pst_sk`, `ca_qst`, `cd_nif`, `ch_uid`, `ch_vat`, `cl_tin`, `cm_niu`, `cn_tin`, `co_nit`, `cr_tin`, `cv_nif`, `de_stn`, `do_rcn`, `ec_ruc`, `eg_tin`, `es_cif`, `et_tin`, `eu_oss_vat`, `eu_vat`, `fo_vat`, `gb_vat`, `ge_vat`, `gi_tin`, `gn_nif`, `hk_br`, `hr_oib`, `hu_tin`, `id_npwp`, `il_vat`, `in_gst`, `is_vat`, `it_cf`, `jp_cn`, `jp_rn`, `jp_trn`, `ke_pin`, `kg_tin`, `kh_tin`, `kr_brn`, `kz_bin`, `la_tin`, `li_uid`, `li_vat`, `lk_vat`, `ma_vat`, `md_vat`, `me_pib`, `mk_vat`, `mr_nif`, `mx_rfc`, `my_frp`, `my_itn`, `my_sst`, `ng_tin`, `no_vat`, `no_voec`, `np_pan`, `nz_gst`, `om_vat`, `pe_ruc`, `ph_tin`, `pl_nip`, `py_ruc`, `ro_tin`, `rs_pib`, `ru_inn`, `ru_kpp`, `sa_vat`, `sg_gst`, `sg_uen`, `si_tin`, `sn_ninea`, `sr_fin`, `sv_nit`, `th_vat`, `tj_tin`, `tr_tin`, `tw_vat`, `tz_vat`, `ua_vat`, `ug_tin`, `us_ein`, `uy_ruc`, `uz_tin`, `uz_vat`, `ve_rif`, `vn_tin`, `za_vat`, `zm_tin`, or `zw_tin`. Note that some legacy tax IDs have type `unknown`
    
    Possible enum values
    
    `ad_nrt`
    
    `ae_trn`
    
    `al_tin`
    
    `am_tin`
    
    `ao_tin`
    
    `ar_cuit`
    
    `au_abn`
    
    `au_arn`
    
    `aw_tin`
    
    `az_tin`
    
    Show 107 more
    
-   #### 
    
    valuestring
    
    Value of the tax ID.
    

### More attributes

Expand all

-   #### 
    
    objectstring
    
-   #### 
    
    createdtimestamp
    
-   #### 
    
    livemodeboolean
    
-   #### 
    
    ownernullable object
    
-   #### 
    
    verificationnullable object
    

The Tax ID object

```
{  "id": "txi_1NuMB12eZvKYlo2CMecoWkZd",  "object": "tax_id",  "country": "DE",  "created": 123456789,  "customer": null,  "livemode": false,  "type": "eu_vat",  "value": "DE123456789",  "verification": null,  "owner": {    "type": "self",    "customer": null  }}
```

# [Create a Customer tax ID](/api/tax_ids/customer_create)

Ask about this section

Copy for LLM

View as Markdown

POST /v1/customers/:id/tax\_ids

Creates a new `tax_id` object for a customer.

### Parameters

-   #### 
    
    typestringRequired
    
    Type of the tax ID, one of `ad_nrt`, `ae_trn`, `al_tin`, `am_tin`, `ao_tin`, `ar_cuit`, `au_abn`, `au_arn`, `aw_tin`, `az_tin`, `ba_tin`, `bb_tin`, `bd_bin`, `bf_ifu`, `bg_uic`, `bh_vat`, `bj_ifu`, `bo_tin`, `br_cnpj`, `br_cpf`, `bs_tin`, `by_tin`, `ca_bn`, `ca_gst_hst`, `ca_pst_bc`, `ca_pst_mb`, `ca_pst_sk`, `ca_qst`, `cd_nif`, `ch_uid`, `ch_vat`, `cl_tin`, `cm_niu`, `cn_tin`, `co_nit`, `cr_tin`, `cv_nif`, `de_stn`, `do_rcn`, `ec_ruc`, `eg_tin`, `es_cif`, `et_tin`, `eu_oss_vat`, `eu_vat`, `fo_vat`, `gb_vat`, `ge_vat`, `gi_tin`, `gn_nif`, `hk_br`, `hr_oib`, `hu_tin`, `id_npwp`, `il_vat`, `in_gst`, `is_vat`, `it_cf`, `jp_cn`, `jp_rn`, `jp_trn`, `ke_pin`, `kg_tin`, `kh_tin`, `kr_brn`, `kz_bin`, `la_tin`, `li_uid`, `li_vat`, `lk_vat`, `ma_vat`, `md_vat`, `me_pib`, `mk_vat`, `mr_nif`, `mx_rfc`, `my_frp`, `my_itn`, `my_sst`, `ng_tin`, `no_vat`, `no_voec`, `np_pan`, `nz_gst`, `om_vat`, `pe_ruc`, `ph_tin`, `pl_nip`, `py_ruc`, `ro_tin`, `rs_pib`, `ru_inn`, `ru_kpp`, `sa_vat`, `sg_gst`, `sg_uen`, `si_tin`, `sn_ninea`, `sr_fin`, `sv_nit`, `th_vat`, `tj_tin`, `tr_tin`, `tw_vat`, `tz_vat`, `ua_vat`, `ug_tin`, `us_ein`, `uy_ruc`, `uz_tin`, `uz_vat`, `ve_rif`, `vn_tin`, `za_vat`, `zm_tin`, or `zw_tin`
    
-   #### 
    
    valuestringRequired
    
    Value of the tax ID.
    

### Returns

The created `tax_id` object.

```
curl https://api.stripe.com/v1/customers/{{CUSTOMER_ID}}/tax_ids \  -u "sk_test_tR3PYbc...96tH88S4VQ2usk_test_tR3PYbcVNZZ796tH88S4VQ2u:" \  -d type=eu_vat \  -d value=DE123456789
```

Response

```
{  "id": "txi_1MoC8zLkdIwHu7ixEhgWcHzJ",  "object": "tax_id",  "country": "DE",  "created": 1679431857,  "customer": "cus_NZKoSNZZ58qtO0",  "livemode": false,  "type": "eu_vat",  "value": "DE123456789",  "verification": {    "status": "pending",    "verified_address": null,    "verified_name": null  }}
```
