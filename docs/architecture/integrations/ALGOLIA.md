# Algolia Search Integration Specification (ALGOLIA.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Algolia Search API, PostgreSQL 15)  

---

## 1. Executive Summary & Architecture Overview
This document defines the technical integration specification for **Algolia Search** within the **Elitedom Store** platform. Algolia provides ultra-fast, typo-tolerant search and instant filtering capabilities for the e-commerce product catalog, ensuring lightning-fast search responses (under 300ms) for web and mobile clients [cite: 7].

In alignment with platform architecture principles (`AP-011 Event Driven Integration`), product data changes originating from Odoo 17 ERP or the FastAPI backend are asynchronously indexed into Algolia to maintain real-time consistency across stock quantities, pricing, and hardware specifications.

---

## 2. Data Synchronization & Indexing Pipeline

To keep the search index synchronized with the PostgreSQL database and Odoo 17 ERP master records, a background worker (Celery/Redis) manages index updates:

* **Trigger Events:** 
  * Product creation or update (`product.template` / `product.product`).
  * Inventory adjustments via Odoo webhooks (`POST /webhooks/odoo/inventory-sync`) [cite: 10, 11].
  * Price changes or tier pricelist modifications.
* **Batch Re-indexing:** A scheduled cron job performs a full catalog synchronization nightly to resolve any drift between PostgreSQL and Algolia indices.

---

## 3. Search API Endpoints & Query Parameters

The FastAPI backend acts as a secure proxy/wrapper for client search queries, handling authentication rate limits and request formatting before querying Algolia.

### 3.1. Typo-Tolerant Product Search
* **Endpoint (Internal FastAPI):** `GET /products/search` [cite: 7]
* **Query Parameters:** 
  * `q` (string): The user search query string (supports typo tolerance, synonym matching, and multi-word queries) [cite: 7].
  * `category_id` (integer, optional): Filter results by specific category facet.
  * `brand` (string, optional): Filter results by hardware brand (e.g., Intel, ASUS, Corsair).
  * `min_price` / `max_price` (float, optional): Price range numerical facets.
  * `page` / `limit` (integer, optional): Pagination parameters.
* **Response Payload Example (200 OK):**
  ```json
  {
    "total_count": 12,
    "page": 1,
    "limit": 20,
    "processing_time_ms": 42,
    "products": [
      {
        "id": 501,
        "name": "Intel Core i7-14700K",
        "sku": "CPU-INTEL-14700K",
        "price": 18500.00,
        "stock_qty": 14,
        "highlight_result": {
          "name": {
            "value": "Intel Core i7-<em>14700K</em>",
            "matchLevel": "full"
          }
        }
      }
    ]
  }
  ```

---

## 4. Algolia Index Schema & Configuration

The Algolia index (`elitedom_products_prod`) is structured with optimized attributes for e-commerce filtering and ranking:

* **Object ID (`objectID`):** Maps directly to the product database ID (`product_id`).
* **Searchable Attributes:** `name`, `sku`, `brand`, `description`, `category_name`, `tags`.
* **Custom Ranking:** Ranked descending by `stock_qty`, popularity score, and rating.
* **Attributes for Faceting:** `category_id`, `brand`, `price`, `is_dropship_enabled`, `in_stock`.
* **Typo Tolerance Settings:** Enabled by default with `minWordSizefor1Typo: 4` and `minWordSizefor2Typos: 8`.

---

## 5. Fault Tolerance & Fallback Strategy

To ensure high availability in the event of Algolia API downtime or network partitions:
* **Automatic Fallback:** If the Algolia API call fails or exceeds a 500ms timeout threshold, the FastAPI backend automatically falls back to PostgreSQL Full-Text Search (`ILIKE` / `to_tsvector`).
* **Error Mapping:** Search failures map to standard platform error codes (`ERROR_CODES.md`), ensuring clients receive structured error responses without breaking application flow.

---
End of Document
