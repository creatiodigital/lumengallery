# Order lifecycle — buyer journeys (visual reference)

> Open this in **VS Code → Markdown preview** (or GitHub) to see the diagrams rendered.
> Living reference for the print order flow. Reflects the capture/place split + re-order
> design (specs `2026-06-24-capture-place-split-design.md`,
> `2026-06-26-reorder-reprint-design.md`) and the money rules in
> `memory/project_capture_tps_money_flow.md`.

## Legend

| Icon | Meaning |
|---|---|
| 👤 | Buyer action |
| 🛠 | Admin action (you, in /admin/orders) |
| 🖨 | The Print Space (TPS) |
| 💳 | Money event |
| 📧 | Buyer email sent |
| 📦 | Delivery |
| ⟳ | Reprint / replacement |

**Money rules (the spine of everything):**
- **Authorize** (at checkout) = a *hold*, no money taken yet.
- **Capture** (admin, step ①) = card actually *charged*; the limited edition number flips to **SOLD**.
- **Cancel before capture** = hold released, buyer *never charged*, **no fee**, edition number freed.
- **Refund after capture** = money returned, edition number freed — but **Stripe keeps its fee**.
- **Re-order (reprint)** = **no new charge**, edition number **kept** (same numbered copy remade).
- **Pay TPS only AFTER a successful capture** (TPS charges immediately; capture-first protects your cash).

---

## Master state machine

Every journey below is a path through this.

```mermaid
stateDiagram-v2
    [*] --> New: "👤 pays — 💳 card AUTHORIZED (hold)"
    New --> Cancelled: "🛠 Cancel — hold released, never charged, edition freed (no fee)"
    New --> ToPlace: "🛠 ① Capture payment — 💳 charged, edition → SOLD"
    ToPlace --> AtTPS: "🛠 place + pay TPS → ② Mark placed"
    ToPlace --> Refunded: "🛠 Refund (buyer changed mind post-capture, pre-TPS)"
    AtTPS --> InProduction: "🛠 Mark in production — 📧"
    InProduction --> Shipped: "🛠 Mark shipped — 📧 tracking"
    Shipped --> Delivered: "🛠 Mark delivered — 📧"
    Delivered --> ArtistPaid: "🛠 Pay artist (14-day gate)"
    Delivered --> ToPlace: "🛠 ⟳ Re-order (reprint) — reason, NO re-charge, edition kept"
    AtTPS --> Refunded: "🛠 Refund (faulty)"
    InProduction --> Refunded: "🛠 Refund (faulty)"
    Shipped --> Refunded: "🛠 Refund (faulty)"
    Delivered --> Refunded: "🛠 Refund (faulty)"
    ArtistPaid --> [*]
    Refunded --> [*]
    Cancelled --> [*]
```

---

## Case 1 — Single limited print, happy path (no refund)

```mermaid
flowchart TD
    A["👤 Buyer picks 1 Limited print<br/>checkout + pay"] --> B["💳 Card AUTHORIZED (hold)<br/>edition No. reserved · tab: New"]
    B --> C["🛠 ① Capture payment<br/>💳 charged · edition → SOLD · tab: To place at TPS"]
    C --> D["🛠 Place + pay order at TPS<br/>② Mark placed · tab: At TPS"]
    D --> E["🖨 TPS printing<br/>🛠 Mark in production · 📧 buyer"]
    E --> F["🖨 TPS ships<br/>🛠 Mark shipped · 📧 tracking"]
    F --> G["📦 Delivered<br/>🛠 Mark delivered · 📧 buyer"]
    G --> H["🛠 Pay artist (after 14-day gate)<br/>tab: Artist paid ✓ DONE"]
```

---

## Case 2 — Multiple artworks (Limited + Open) in one cart, happy path

One **order**, one **PaymentIntent**, multiple **items**. Only the Limited item reserves a
number; the Open item carries none. Capture / place / advance act on the **whole order**.

```mermaid
flowchart TD
    A["👤 Cart: 1 Limited + 1 Open<br/>one checkout + pay"] --> B["💳 ONE PI AUTHORIZED<br/>Limited No. reserved · Open: no number · tab: New"]
    B --> C["🛠 ① Capture once<br/>whole order charged · Limited → SOLD · To place at TPS"]
    C --> D["🛠 Place BOTH items at TPS<br/>② Mark placed · At TPS"]
    D --> E["🖨 In production · 🛠 Mark · 📧"]
    E --> F["🖨 Shipped · 🛠 Mark · 📧 tracking"]
    F --> G["📦 Delivered · 🛠 Mark · 📧"]
    G --> H["🛠 Pay EACH artist (per-item payout)<br/>14-day gate · DONE"]
```

---

## Case 3 — Cancel before production

The outcome depends entirely on **whether you've captured yet** — the argument for
capturing *late* (only when about to place at TPS).

```mermaid
flowchart TD
    A["👤 Buyer asks to cancel"] --> B{"Captured yet?"}
    B -->|"No — still New (authorized hold)"| C["🛠 Cancel order<br/>hold released · buyer NEVER charged · edition freed · NO fee"]
    B -->|"Yes — already captured (To place / At TPS), before TPS production"| D["🛠 Refund buyer<br/>money returned · edition freed · ⚠️ Stripe keeps the fee"]
    C --> E["tab: Cancelled"]
    D --> F["tab: Refunded"]
```

---

## Case 4 — Capture fails (dead / expired card)

The safety gate: a failed capture costs you nothing because **TPS hasn't been paid**.

```mermaid
flowchart TD
    A["🛠 ① Capture payment on a New order"] --> B{"Capture succeeds?"}
    B -->|"Yes"| C["→ To place at TPS · proceed normally"]
    B -->|"No — card canceled / hold expired"| D["❌ clear error · order stays New<br/>💡 TPS paid NOTHING · contact buyer or cancel (no loss)"]
```

---

## Case 5 — Damaged / wrong on arrival → refund **or** reprint

The faulty-goods branch (always remedied, even post-delivery).

```mermaid
flowchart TD
    A["📦 Buyer receives DAMAGED / wrong print<br/>order = Delivered"] --> B["👤 complains · 🛠 ask for proof photos"]
    B --> C["🛠 claim to TPS with proof"]
    C --> D{"TPS confirms their fault → reprint or refund?"}
    D -->|"Buyer chooses REFUND"| E["🛠 Refund buyer<br/>💳 money back · edition FREED · TPS refunds YOU the print cost"]
    D -->|"Buyer chooses REPRINT"| F["🛠 ⟳ Re-order — reason: damaged<br/>reset → To place at TPS · NO re-charge · edition KEPT · ⟳ badge"]
    F --> G["🛠 place reprint at TPS → walk the pipeline again<br/>In production → Shipped → Delivered"]
    E --> H["tab: Refunded"]
    G --> I["📦 Delivered again ✓ · ⟳ Replacement badge stays"]
```

> Reprint soft cap: frictionless for the first 2; from the 3rd on the dashboard warns
> ("reprinted twice already — a refund may serve the buyer better") and asks you to confirm.

---

## Quick reference — what each off-ramp does to money + edition

| Action | When | Buyer money | Edition number | Stripe fee |
|---|---|---|---|---|
| **Cancel** | before capture | never charged (hold released) | freed | none |
| **Refund** | after capture | returned in full | freed | **kept by Stripe** |
| **Re-order (reprint)** | after delivery (faulty) | unchanged (no charge) | **kept** (same copy) | none |
| **Pay artist** | after delivery (+14d gate) | — | — | — |
</content>
