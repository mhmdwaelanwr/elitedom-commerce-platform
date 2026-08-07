# Stage 6 — Inventory, Orders, Fulfillment, and Shipping

## Scope

Stage 6 makes the post-checkout order lifecycle explicit and auditable without replacing the legacy Odoo-facing `sale_order.state` contract introduced in earlier stages.

The implementation deliberately builds on Stage 5 Paymob behavior. Checkout still performs its existing database-conditional stock decrement before an electronic payment is created. Stage 6 records that deduction as a durable reservation in the same request transaction and makes every later release, re-reservation, shipment, Odoo stock synchronization, and cancellation operate against that durable record.

## Inventory semantics

`product_template.stock_qty` remains the storefront's **available-to-sell** quantity for backward compatibility.

Stage 6 adds two persistence concepts:

- `elitedom_inventory_reservation`: one local-stock reservation per order/product pair.
- `elitedom_inventory_source_balance`: the last authoritative physical/on-hand quantity received from Odoo (or an inferred local baseline before the first Odoo snapshot).

Reservation states are:

- `reserved`: units were withheld from available-to-sell at checkout.
- `released`: an unpaid/cancelled order restored those units exactly once.
- `consumed_pending_source`: the local warehouse shipped units already withheld at checkout, but Odoo has not necessarily reflected the physical decrement yet.
- `consumed`: Odoo's authoritative physical stock decrease has reconciled the shipped reservation.

This prevents two failure modes that existed before Stage 6:

1. an Odoo absolute inventory sync overwriting a local checkout reservation; and
2. dispatch subtracting units a second time after checkout had already withheld them.

Dropship lines never create local inventory reservations. The reservation snapshot also makes fulfillment routing stable for historical orders if a product's dropship configuration is changed later.

## Concurrent checkout safety

The existing Stage 5 checkout conditional SQL update remains the first stock guard. Stage 6's reservation service also uses database-conditional updates (`stock_qty >= requested_quantity`) for direct reservation callers. Competing attempts therefore cannot both claim the final available unit based on a stale Python-side check.

## Order lifecycle

The legacy `SaleOrder.state` values are retained because Odoo and existing APIs still depend on them. Stage 6 adds `elitedom_order_fulfillment` with the customer/operations lifecycle:

- `payment_pending`
- `confirmed`
- `processing`
- `ready_to_ship`
- `shipped`
- `delivered`
- `cancelled`
- `return_requested`
- `returned`

Historical legacy `done` orders are backfilled conservatively as `shipped`, not `delivered`, because the previous local dispatch code used `done` at carrier handoff. A separate verified delivery transition is required before the explicit lifecycle becomes `delivered`.

## Payment transitions

Stage 5 Paymob verification remains authoritative.

- Verified payment failure releases only durable local reservations and does so once.
- A verified late success after a payment-failure cancellation attempts a database-safe re-reservation before reopening fulfillment.
- A verified late success after a **customer/operations cancellation** does not reopen shipment. The captured payment is recorded and an idempotent full refund request is created instead.
- Refund requests remain auditable `requested` records until a verified provider callback marks them completed. Stage 6 does not invent an undocumented Paymob refund endpoint.

## Cancellation

Customer/admin cancellation is allowed only before shipment.

Cancellation:

- is idempotent;
- moves explicit fulfillment to `cancelled`;
- preserves the cancellation reason for safe late-payment behavior;
- releases local reservations once;
- cancels draft system-generated dropship POs and their pending shipment legs;
- refuses automatic cancellation when a supplier PO has already advanced to `sent`, `partial`, or `received`, because that requires operations review;
- requests a provider refund for a paid electronic order without claiming the refund has completed.

## Shipping

Stage 6 adds provider-neutral `elitedom_shipment` records. A shipment can represent a local warehouse leg or a dropship supplier leg and stores:

- carrier;
- tracking number;
- external/picking reference;
- scheduled time;
- shipped time;
- delivered time;
- current shipment status.

The existing `stock_picking` table remains the Odoo compatibility mirror.

Local dispatch keeps the previous legacy `order_state=done` response for API compatibility, but the explicit lifecycle becomes only `shipped`. Delivery is a separate operation and moves fulfillment to `delivered`.

Mixed local/dropship orders do not report the overall order as shipped or delivered until all required fulfillment legs reach the corresponding stage.

## Dropshipping

A paid dropship order still creates deterministic supplier POs using the existing unique `fulfillment_key` retry guard.

Stage 6 additionally:

- creates one deterministic shipment leg per dropship PO;
- uses the checkout reservation snapshot to distinguish local from dropship lines;
- accepts controlled supplier shipment facts (tracking/carrier/status) through the authenticated operations endpoint;
- prevents a system-generated dropship PO marked `received` from adding stock to the Elitedom local warehouse.

No supplier API, email, or customer-data transmission is fabricated. The existing durable outbox boundary remains the integration handoff.

## Odoo integration

Signed Odoo callbacks remain HMAC-authenticated and `WebhookReceipt`-deduplicated.

Inventory callbacks and periodic Celery inventory sync now project Odoo's absolute physical quantity into available-to-sell through `elitedom_inventory_source_balance` instead of assigning `product.stock_qty` blindly.

Order-status callbacks:

- row-lock the order;
- use the explicit fulfillment record as the forward-only lifecycle guard;
- mirror compatible legacy `SaleOrder.state` and `StockPicking` values;
- persist shipment carrier/tracking facts;
- reconcile local reservation consumption at shipment;
- keep cancellation terminal;
- ignore stale out-of-order callbacks without mutating state.

Existing Odoo order creation retry behavior remains: the worker first looks up the remote sale order by Elitedom reference and persists the recovered remote id, preventing duplicate Odoo sale orders after retries.

## Customer account UI

The account now includes:

- a real `/account/orders` page backed by the orders API;
- `/account/orders/[orderId]` details backed by order + shipment tracking APIs;
- responsive loading, empty, error, and unauthenticated states;
- localized Arabic/English order and shipment copy;
- RTL/LTR through the shared preference system;
- semantic theme tokens for light/dark/system themes;
- local and supplier shipment cards;
- explicit fulfillment timeline;
- cancellation only while the backend reports a pre-shipment fulfillment state;
- clear pending-refund copy for paid cancellations.

No production mock order/tracking data is used.

## Migration

Migration: `0010_fulfillment_lifecycle`

Creates:

- `elitedom_inventory_source_balance`
- `elitedom_inventory_reservation`
- `elitedom_order_fulfillment`
- `elitedom_shipment`

The migration backfills existing reservations, physical-stock baselines, conservative fulfillment states, and existing delivery pickings without mutating `product_template.stock_qty` a second time.

CI must validate fresh upgrade, latest downgrade/replay, and full downgrade/replay on PostgreSQL before merge.

## Environment variables

Stage 6 adds no secrets and no new required environment variables.

## Security and idempotency decisions

- Paymob redirect data remains non-authoritative.
- Odoo inventory/order callbacks remain HMAC verified and fail closed.
- Duplicate Odoo callbacks are receipt-deduplicated before business mutations.
- Inventory releases and re-reservations operate on durable reservation state, not mutable product configuration.
- Refund completion is never inferred from an application request.
- Shipment ownership checks remain server-side.
- Customer cancellation is server-authorized against order ownership and current fulfillment state.

## Deferred

The following remain outside Stage 6 and are intentionally not pulled forward:

- carrier-specific shipping API integrations and label purchasing;
- supplier-specific outbound API/email adapters;
- automated return merchandise workflow beyond the explicit lifecycle states;
- Stage 7 granular admin RBAC/audit controls;
- Stage 8 transactional shipment notifications;
- Stage 9 distributed rate limiting/security/observability hardening;
- Paymob merchant sandbox/manual acceptance and provider-specific refund/void procedure.
