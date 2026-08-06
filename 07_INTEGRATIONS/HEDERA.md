# Hedera Consensus Service (HCS) Integration Specification (HEDERA.md)

**Document Classification:** Internal  
**Version:** 1.0  
**Status:** Approved / Production Ready  
**Target System:** Elitedom E-Commerce & Odoo 17 ERP Integration (FastAPI Backend, Hedera Hashgraph HCS, PostgreSQL 15)  

---

## 1. Executive Summary & Architecture Overview
This document defines the technical integration specification for **Hedera Consensus Service (HCS)** within the **Elitedom Store** platform. HCS provides decentralized, cryptographically verifiable, and immutable audit logging for high-value B2B transactions, order state transitions, and supply chain tracking, ensuring tamper-proof record-keeping synchronized with Odoo 17 ERP.

In alignment with platform security standards (`API_SECURITY.md`) and event-driven architecture principles (`AP-011 Event Driven Integration`), all blockchain message submissions are orchestrated asynchronously via background workers (Celery/Redis) to prevent blocking the FastAPI e-commerce request lifecycle.

---

## 2. Core Use Cases & Triggers

### 2.1. Immutable Order Audit Trail
* **Trigger:** Successful high-value B2B checkout or corporate contract finalization (`POST /checkout/b2b-order`).
* **Action:** FastAPI generates a cryptographic hash of the order payload and submits it as a consensus message to a designated Hedera Consensus Service (HCS) Topic ID, storing the resulting sequence number and consensus timestamp in PostgreSQL.

### 2.2. Supply Chain & Inventory Provenance Tracking
* **Trigger:** Stock lot receipt or warehouse transfer confirmation in Odoo 17 ERP (`WH/IN/...`).
* **Action:** Submits serial number (`stock_lot`) ownership and provenance logs to Hedera to maintain a decentralized ledger of hardware component authenticity (e.g., high-end processors, graphics cards).

---

## 3. Core API Integration Endpoints & Payloads

### 3.1. Internal Hedera HCS Dispatcher Service
The FastAPI backend utilizes the official Hedera SDK interacting with the Hedera Mainnet/Testnet nodes and Mirror Nodes (`https://testnet.mirrornode.hedera.com/api/v1/...`).

* **Request Payload Structure (Internal Service Call / HCS Message Submission):**
  ```json
  {
    "topic_id": "0.0.4829192",
    "message": {
      "event_type": "B2B_ORDER_COMMITTED",
      "order_number": "SO2026-00142",
      "customer_id": "CUST-98412",
      "payload_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "timestamp": "2026-07-24T03:22:00Z"
    },
    "memo": "Elitedom Secure Order Audit Log"
  }
  ```

* **Hedera Mirror Node Response (Consensus Verification):**
  ```json
  {
    "consensus_timestamp": "1753327320.123456789",
    "topic_id": "0.0.4829192",
    "message": "eyJldmVudF90eXBlIjoi...",
    "sequence_number": 14205,
    "running_hash": "a8f5c...3e1d"
  }
  ```

---

## 4. Webhook & Mirror Node Event Verification (`/webhooks/hedera/verify`)

The Elitedom backend queries or listens via Mirror Node webhooks to verify consensus confirmation and update order verification status in PostgreSQL.

### 4.1. Endpoint Configuration
* **Endpoint:** `POST /webhooks/hedera/verify`
* **Security:** Cryptographic signature validation matching the operator public key and transaction fee payer constraints.

---

## 5. Error Handling & Error Codes Mapping

Hedera network submission failures map directly to standard platform error codes (`ERROR_CODES.md`):
* **`ELITE_1001` (HTTP 500):** `HEDERA_NETWORK_UNAVAILABLE` — Hedera node gRPC timeout or network congestion.
* **`ELITE_4003` (HTTP 400):** `INVALID_HCS_TOPIC` — The target HCS topic ID is invalid or inactive.
* **`ELITE_7002` (HTTP 504):** `MIRROR_NODE_TIMEOUT` — Hedera mirror node failed to return consensus confirmation within SLA limits.

---

## 6. Security & Key Management

* **Operator Credentials:** Hedera Operator ID and Private Keys are strictly stored in encrypted environment vaults (`HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`).
* **Data Privacy:** PII is never written directly to the ledger; only salted cryptographic hashes and public event references are submitted to HCS topics.

---
End of Document
