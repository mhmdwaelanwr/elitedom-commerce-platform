# Test Data Management & Fixtures Specification (TEST_DATA.md)

**Document Classification:** Internal / Quality Assurance & Testing  
**Version:** 2.1  
**Status:** Approved / Execution Ready  
**Target System:** Elitedom Storefront, FastAPI Backend, Odoo 17 ERP, PostgreSQL  

---

## 1. Executive Summary & Overview
This document defines the standard test data fixtures, mock datasets, and seed payloads required for automated and manual execution of test cases across the **Elitedom Store** platform. Consistent test data ensures reproducible results across staging environments and CI/CD pipelines.

---

## 2. Test Users & Authentication Fixtures
Pre-configured user accounts for testing Role-Based Access Control (RBAC), authentication flows, and regional checkout constraints.

| User ID / Alias | Role | Email / Username | Mobile Number | Region / Address |
| :--- | :--- | :--- | :--- | :--- |
| **USR-01** | Standard Customer | `mohamed.anwar@elitedom.store` | `+201012345678` | El Matareya, Cairo, Egypt |
| **USR-02** | Verified Buyer | `test.buyer@elitedom.store` | `+201298765432` | Nasr City, Cairo, Egypt |
| **ADM-01** | Store Administrator | `admin@elitedom.store` | `+201111222333` | Maadi, Cairo, Egypt |
| **WH-01** | Warehouse Operator | `warehouse@elitedom.store` | `+201555667788` | Smart Village, Giza, Egypt |

---

## 3. Product Catalog & Hardware Inventory Test Data
Standardized hardware items seeded in the PostgreSQL database and synchronized with Odoo 17 ERP.

| SKU / Product Code | Product Name & Specifications | Unit Price (EGP) | Initial Stock Count | Serial Number ($S/N$) Template |
| :--- | :--- | :--- | :--- | :--- |
| **GPU-RTX5090** | RTX 5090 Elite 32GB GDDR7 | `79,999` | `5` units | `SN-5090-2026-XXXX` |
| **CPU-R99950X** | AMD Ryzen 9 9950X 16-Core | `29,999` | `12` units | `SN-9950X-2026-XXXX` |
| **RAM-DDR5-64G**| Corsair Dominator Titanium 64GB | `8,499` | `25` units | `SN-DDR5-2026-XXXX` |
| **SSD-4TB-NVME**| Samsung 990 PRO 4TB PCIe 4.0 | `14,299` | `10` units | `SN-SSD4T-2026-XXXX` |

---

## 4. Order & Checkout Transaction Test Data
Sample JSON payload used for testing checkout calculations, tax rules (14% VAT), and shipping fees (EGP 150).

```json
{
  "customer_id": "USR-01",
  "shipping_address": {
    "full_name": "Mohamed Anwar",
    "street": "15 El-Horreya Street",
    "district": "El Matareya",
    "city": "Cairo",
    "country": "Egypt"
  },
  "items": [
    {
      "sku": "GPU-RTX5090",
      "quantity": 1,
      "unit_price_egp": 79999.00,
      "serial_number": "SN-5090-2026-0048"
    }
  ],
  "shipping_fee_egp": 150.00,
  "tax_rate": 0.14,
  "payment_method": "COD"
}
```

---

## 5. RMA & Warranty Support Test Data
Sample test dataset for validating warranty claims, hardware defect reporting, and Odoo Helpdesk ticket generation.

* **Valid Serial Number for RMA Test:** `SN-5090-2026-0048`
* **Issue Categories:** `Hardware Defect`, `Shipping Damage`, `RMA Return`, `Technical Inquiry`
* **Mock Attachment:** `test_evidence_gpu.png` (PNG format, exactly 4.2 MB, under the 50MB limit)
* **Expected SLA Response Time:** `24-48 hours`

---

## 6. Odoo 17 ERP Webhook Integration Payload
Sample webhook payload sent from the FastAPI backend to Odoo 17 upon successful order completion.

```json
{
  "event": "order.completed",
  "timestamp": "2026-07-24T03:42:22Z",
  "order_reference": "SO-2026-09481",
  "customer": {
    "email": "mohamed.anwar@elitedom.store",
    "phone": "+201012345678"
  },
  "total_amount_egp": 91369.00,
  "signature_hmac_sha256": "a3f5b8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8"
}
```

---
End of Document
