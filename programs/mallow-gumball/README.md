# mallow Gumball Machine

## Overview

The mallow Gumball Machine is a fork of the Metaplex Protocol's Candy Machine, designed to enhance flexibility and collaboration in NFT distribution on Solana. This iteration allows for the use of pre-minted NFTs, supporting both Metaplex Legacy and Core NFT standards, instead of minting new ones during the distribution process. SPL token prizes can also be loaded. The prize selected on each draw use the same randomness as the original Candy Machine implementation.

Key features of the mallow Gumball Machine include:

- Support for pre-minted NFTs: Users can add existing Metaplex Legacy and Core NFTs to Gumball Machines.
- Support for SPL token prizes
- Collaborative curation: Curators can invite multiple sellers to add their NFTs to a single Gumball Machine.
- Curator fee system: Curators can set and receive a fee for each sale from the Gumball Machine.
- Marketplace fee system: Marketplaces hosting the Gumball sale can set and receive a fee for each sale from the Gumball Machine.
- Socialized proceeds: Sellers receive an equal share of the total proceeds per NFT they contributed to the Gumball Machine.
- Enforced royalties: Native creator payouts use actual account rent, with shortfalls funded only from the item's seller proceeds. Unpayable creators or unaffordable shortfalls leave the share with the seller; ordinary payable creators must be writable.

The mallow Gumball Machine is responsible for:

- Prize management: Configuration of how many prizes are available and their metadata information.
- Index generation and selection: For fair and random distribution of NFTs.
- Prize distribution: Transferring ownership of prizes to buyers.

### Why use pre-minted NFTs?

Using pre-minted NFTs offers several advantages:

1. Secondaries: Allows users to re-sell their minted NFTs as a secondary sale.
2. Collaboration: Enables multiple artists or sellers to contribute to a single Gumball Machine.

### Who can add NFTs to a Gumball Machine?

The mallow Gumball Machine introduces a collaborative model:

- The `authority` of the Gumball Machine can add NFTs.
- Invited sellers can add their pre-minted NFTs to the Gumball Machine.
- Users can request to add a prize and the Curator can approve the addition.

This model allows for community-driven curation and distribution of NFTs, while still providing a mechanism for curators to be compensated for their efforts.

### How are proceeds distributed?

The mallow Gumball Machine implements a socialized proceeds model:

- Total proceeds from sales are pooled together.
- Each seller receives an equal share of the total proceeds per NFT they contributed to the Gumball Machine.
- The optional curator fee and optional marketplace fee is deducted before the proceeds are distributed to sellers.

This model ensures fair compensation for all participating sellers, regardless of which specific NFTs are sold.

## Account

The `GumballMachine` state is stored in a single account, which includes settings that
control the behaviour of the gumball machine and metadata information for the NFTs sold through it.
The account data is represented by the
[`GumballMachine`](https://github.com/mallow-labs/mallow-gumball/blob/febo/mallow-gumball/mallow-gumball/program/src/state/gumball_machine.rs)
struct, which include references to auxiliary structs
`ConfigLineSettings` and `HiddenSettings`.

| Field                     | Offset | Size | Description                                                                                                     |
| ------------------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------------- |
| &mdash;                   | 0      | 8    | Anchor account discriminator.                                                                                   |
| `version`                 | 8      | 1    | Version of the account.                                                                                         |
| `authority`               | 9      | 32   | Authority address.                                                                                              |
| `mint_authority`          | 41     | 32   | Authority address allowed to mint from the gumball machine.                                                     |
| `marketplace_fee_config`  | 73     | 34   | (Optional) Fee config for the marketplace this gumball is listed on.                                            |
| `items_redeemed`          | 107    | 8    | Number of assets redeemed.                                                                                      |
| `items_settled`           | 115    | 8    | Number of assets settled after sale.                                                                            |
| `total_revenue`           | 123    | 8    | Amount of lamports/tokens received from purchases.                                                              |
| `state`                   | 131    | 1    | State of the gumball machine (enum: None, DetailsFinalized, SaleLive, SaleEnded).                               |
| `settings`                | 132    | ~    | User-defined settings (GumballSettings struct).                                                                 |
| - `uri`                   | ~      | 196  | Uri of off-chain metadata, max length 196.                                                                      |
| - `item_capacity`         | ~      | 8    | Number of assets that can be added.                                                                             |
| - `items_per_seller`      | ~      | 2    | Max number of items that can be added by a single seller.                                                       |
| - `sellers_merkle_root`   | ~      | 32   | (Optional) Merkle root hash for sellers who can add items to the machine.                                       |
| - `curator_fee_bps`       | ~      | 2    | Fee basis points paid to the machine authority.                                                                 |
| - `hide_sold_items`       | ~      | 1    | True if the front end should hide items that have been sold.                                                    |
| - `payment_mint`          | ~      | 32   | Payment token for the mint.                                                                                     |
| _hidden section_          | ~      | ~    | Hidden data section to avoid unnecessary deserialization.                                                       |
| - _items_inserted_        | ~      | 4    | (u32) Number of actual lines of data currently inserted (eventually equals item_capacity).                      |
| - _config lines_          | ~      | ~    | (CONFIG_LINE_SIZE \* item_capacity) Config lines for storing asset data.                                        |
| - _claimed items mask_    | ~      | ~    | (item_capacity / 8) + 1 bit mask to keep track of which items have been claimed.                                |
| - _settled items mask_    | ~      | ~    | (item_capacity / 8) + 1 bit mask to keep track of which items have been settled.                                |
| - _mint indices_          | ~      | ~    | (u32 \* item_capacity) mint indices.                                                                            |
| - _disable_primary_split_ | ~      | 1    | (boolean) disable sale proceeds going to creators on a primary sale (all proceeds less royalties go to seller). |

### `GumballSettings`

| Field                 | Offset | Size | Description                                                               |
| --------------------- | ------ | ---- | ------------------------------------------------------------------------- |
| `uri`                 | 0      | 196  | Uri of off-chain metadata, max length 196.                                |
| `item_capacity`       | 196    | 8    | Number of assets that can be added.                                       |
| `items_per_seller`    | 204    | 2    | Max number of items that can be added by a single seller.                 |
| `sellers_merkle_root` | 206    | 33   | (Optional) Merkle root hash for sellers who can add items to the machine. |
| `curator_fee_bps`     | 239    | 2    | Fee basis points paid to the machine authority.                           |
| `hide_sold_items`     | 241    | 1    | True if the front end should hide items that have been sold.              |
| `payment_mint`        | 242    | 32   | Payment token for the mint.                                               |

### `FeeConfig`

Used by the marketplace/platform hosting the Gumball sale to take an optional fee from sales.

| Field         | Offset | Size | Description                 |
| ------------- | ------ | ---- | --------------------------- |
| `fee_account` | 0      | 32   | Where fees will go.         |
| `fee_bps`     | 32     | 2    | Sale basis points for fees. |

### `GumballState`

| Value              | Description                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `None`             | Initial state                                                                |
| `DetailsFinalized` | Sellers invited so only some details can be updated                          |
| `SaleLive`         | Sale started, can now mint items. Can no longer update details or add items. |
| `SaleEnded`        | Sale ended, can now settle items                                             |

## Instructions

### 📄 `initialize`

This instruction creates and initializes a new `GumballMachine` account with the specified settings and fee configuration.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                                         |
| ----------------- | :------: | :----: | ------------------------------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account (uninitialized).                       |
| `authority`       |          |        | Public key of the gumball machine authority.                        |
| `authority_pda`   |    ✅    |        | Authority PDA account (PDA, seeds: ["authority", gumball_machine]). |
| `payer`           |    ✅    |   ✅   | Payer of the transaction.                                           |
| `system_program`  |          |        | System program account.                                             |

</details>

<details>
  <summary>Arguments</summary>

| Argument                | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `settings`              | `GumballSettings` object.                                     |
| `fee_config`            | Optional `FeeConfig` object.                                  |
| `disable_primary_split` | Whether to disable primary sale creator splits for all items. |

</details>

### 📄 `update_settings`

This instruction updates the gumball machine settings.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument   | Description               |
| ---------- | ------------------------- |
| `settings` | `GumballSettings` object. |

</details>

### 📄 `add_nft`

This instruction adds a legacy NFT to the gumball machine.

<details>
  <summary>Accounts</summary>

| Name                     | Writable | Signer | Description                                                                       |
| ------------------------ | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`        |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`         |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `authority_pda`          |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `seller`                 |    ✅    |   ✅   | Seller of the NFT.                                                                |
| `mint`                   |          |        | Mint account of the NFT.                                                          |
| `token_account`          |    ✅    |        | Seller's token account for the NFT.                                               |
| `metadata`               |    ✅    |        | Metadata account of the NFT.                                                      |
| `edition`                |          |        | Edition account of the NFT.                                                       |
| `token_program`          |          |        | Token program account.                                                            |
| `token_metadata_program` |          |        | Token Metadata program account.                                                   |
| `system_program`         |          |        | System program account.                                                           |
| `seller_token_record`    |    ✅    |        | Seller token record account (pNFT, optional).                                     |
| `auth_rules`             |          |        | Auth rules account (pNFT, optional).                                              |
| `sysvar_instructions`    |          |        | Instructions sysvar (pNFT, optional).                                             |
| `auth_rules_program`     |          |        | Auth rules program (pNFT, optional).                                              |

</details>

<details>
  <summary>Arguments</summary>

| Argument            | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `seller_proof_path` | Merkle proof for seller verification if `sellers_merkle_root` is set. |

</details>

### 📄 `add_core_asset`

This instruction adds a Core asset to the gumball machine.

<details>
  <summary>Accounts</summary>

| Name               | Writable | Signer | Description                                                                       |
| ------------------ | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`  |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`   |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `authority_pda`    |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `seller`           |    ✅    |   ✅   | Seller of the asset.                                                              |
| `asset`            |    ✅    |        | Asset account.                                                                    |
| `collection`       |    ✅    |        | Collection account if asset is part of one (optional).                            |
| `mpl_core_program` |          |        | MPL Core program account.                                                         |
| `system_program`   |          |        | System program account.                                                           |

</details>

<details>
  <summary>Arguments</summary>

| Argument            | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `seller_proof_path` | Merkle proof for seller verification if `sellers_merkle_root` is set. |

</details>

### 📄 `add_tokens`

This instruction adds fungible tokens to the gumball machine.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                       |
| ----------------------------- | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`             |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`              |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `authority_pda`               |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `seller`                      |    ✅    |   ✅   | Seller of the tokens.                                                             |
| `mint`                        |          |        | Mint account of the tokens.                                                       |
| `token_account`               |    ✅    |        | Seller's token account for the mint.                                              |
| `authority_pda_token_account` |    ✅    |        | Authority PDA's token account for the mint.                                       |
| `token_program`               |          |        | Token program account.                                                            |
| `associated_token_program`    |          |        | Associated Token program account.                                                 |
| `system_program`              |          |        | System program account.                                                           |
| `rent`                        |          |        | Rent sysvar.                                                                      |

</details>

<details>
  <summary>Arguments</summary>

| Argument            | Description                                                           |
| ------------------- | --------------------------------------------------------------------- |
| `amount`            | The amount of tokens per item being added.                            |
| `quantity`          | The number of items being added (each containing `amount` tokens).    |
| `seller_proof_path` | Merkle proof for seller verification if `sellers_merkle_root` is set. |

</details>

### 📄 `remove_nft`

This instruction removes a legacy NFT from the gumball machine. It thaws and revokes the delegate from the seller's NFT and removes the item from the `GumballMachine` config lines. The signer (`authority`) must be either the gumball machine authority or the seller of the NFT being removed.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                       |
| ----------------------------- | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`             |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`              |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `authority_pda`               |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `authority`                   |          |   ✅   | Authority allowed to remove (gumball machine authority or item seller).           |
| `seller`                      |    ✅    |        | Seller account (owner of the NFT).                                                |
| `mint`                        |          |        | Mint account of the NFT.                                                          |
| `token_account`               |    ✅    |        | Seller's token account for the NFT.                                               |
| `authority_pda_token_account` |    ✅    |        | Authority PDA's token account for the NFT.                                        |
| `edition`                     |          |        | Edition account of the NFT.                                                       |
| `token_program`               |          |        | Token program account.                                                            |
| `associated_token_program`    |          |        | Associated Token program account.                                                 |
| `token_metadata_program`      |          |        | Token Metadata program account.                                                   |
| `system_program`              |          |        | System program account.                                                           |
| `rent`                        |          |        | Rent sysvar.                                                                      |
| `metadata`                    |    ✅    |        | Metadata account (pNFT, optional).                                                |
| `seller_token_record`         |    ✅    |        | Seller token record account (pNFT, optional).                                     |
| `auth_rules`                  |          |        | Auth rules account (pNFT, optional).                                              |
| `sysvar_instructions`         |          |        | Instructions sysvar (pNFT, optional).                                             |
| `auth_rules_program`          |          |        | Auth rules program (pNFT, optional).                                              |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                    |
| -------- | ------------------------------ |
| `index`  | The index of the NFT to remove |

</details>

### 📄 `remove_core_asset`

This instruction removes a Core asset from the gumball machine. It thaws and revokes the delegate from the seller's asset and removes the item from the `GumballMachine` config lines. The signer (`authority`) must be either the gumball machine authority or the seller of the asset being removed.

<details>
  <summary>Accounts</summary>

| Name               | Writable | Signer | Description                                                                       |
| ------------------ | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`  |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`   |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `authority_pda`    |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `authority`        |          |   ✅   | Authority allowed to remove (gumball machine authority or item seller).           |
| `seller`           |    ✅    |        | Seller account (owner of the asset).                                              |
| `asset`            |    ✅    |        | Asset account.                                                                    |
| `collection`       |    ✅    |        | Collection account if asset is part of one (optional).                            |
| `mpl_core_program` |          |        | MPL Core program account.                                                         |
| `system_program`   |          |        | System program account.                                                           |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                           |
| -------- | ------------------------------------- |
| `index`  | The index of the Core asset to remove |

</details>

### 📄 `start_sale`

This instruction allows drawing from the gumball machine to begin by setting the state to `SaleLive`. Requires the gumball machine to have at least one item.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                                               |
| ----------------- | :------: | :----: | ------------------------------------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                                             |
| `authority`       |          |   ✅   | Gumball Machine authority (can be `authority` or `mint_authority` field). |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `end_sale`

This instruction disables minting and allows sales to be settled.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `draw`

This instruction pseudo-randomly selects an available item from the `GumballMachine` config lines, assigns the `buyer` pubkey to it, and increments the `items_redeemed` count. Only callable by the `mint_authority` when the gumball machine state is `SaleLive`.

<details>
  <summary>Accounts</summary>

| Name                | Writable | Signer | Description                                       |
| ------------------- | :------: | :----: | ------------------------------------------------- |
| `gumball_machine`   |    ✅    |        | The `GumballMachine` account.                     |
| `mint_authority`    |          |   ✅   | Gumball Machine mint authority.                   |
| `payer`             |    ✅    |   ✅   | Payer for the transaction.                        |
| `buyer`             |          |        | Account that will receive the item (pubkey only). |
| `system_program`    |          |        | System program account.                           |
| `recent_slothashes` |          |        | SlotHashes sysvar cluster data.                   |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `increment_total_revenue`

This instruction increments the total revenue earned by the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                       |
| ----------------- | :------: | :----: | ------------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                     |
| `mint_authority`  |          |   ✅   | Public key of the gumball machine mint authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument  | Description                        |
| --------- | ---------------------------------- |
| `revenue` | The amount of revenue to increment |

</details>

### 📄 `claim_core_asset`

This instruction claims a Core asset from the gumball machine for a specific buyer. Transfers the asset from the PDA to the buyer. Can be called by anyone (`payer`).

<details>
  <summary>Accounts</summary>

| Name               | Writable | Signer | Description                                                          |
| ------------------ | :------: | :----: | -------------------------------------------------------------------- |
| `payer`            |    ✅    |   ✅   | Payer for the transaction (anyone can claim the item for the buyer). |
| `gumball_machine`  |    ✅    |        | The `GumballMachine` account (must be `SaleLive` or `SaleEnded`).    |
| `authority_pda`    |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).          |
| `seller`           |    ✅    |        | Seller account (from config line).                                   |
| `buyer`            |          |        | Buyer account (from config line).                                    |
| `system_program`   |          |        | System program account.                                              |
| `asset`            |    ✅    |        | Asset account (from config line).                                    |
| `collection`       |    ✅    |        | Collection account if asset is part of one (optional).               |
| `mpl_core_program` |          |        | MPL Core program account.                                            |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                          |
| -------- | ------------------------------------ |
| `index`  | The index of the Core asset to claim |

</details>

### 📄 `claim_nft`

This instruction claims a legacy NFT from the gumball machine for a specific buyer. Thaws and transfers the NFT from the PDA to the buyer. Can be called by anyone (`payer`).

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                          |
| ----------------------------- | :------: | :----: | -------------------------------------------------------------------- |
| `payer`                       |    ✅    |   ✅   | Payer for the transaction (anyone can claim the item for the buyer). |
| `gumball_machine`             |    ✅    |        | The `GumballMachine` account (must be `SaleLive` or `SaleEnded`).    |
| `authority_pda`               |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).          |
| `seller`                      |    ✅    |        | Seller account (from config line).                                   |
| `buyer`                       |          |        | Buyer account (from config line).                                    |
| `token_program`               |          |        | Token program account.                                               |
| `associated_token_program`    |          |        | Associated Token program account.                                    |
| `system_program`              |          |        | System program account.                                              |
| `rent`                        |          |        | Rent sysvar.                                                         |
| `mint`                        |          |        | Mint account (from config line).                                     |
| `buyer_token_account`         |    ✅    |        | Buyer's token account (must match mint and buyer).                   |
| `authority_pda_token_account` |    ✅    |        | Authority PDA's token account (must match mint and authority PDA).   |
| `metadata`                    |    ✅    |        | Metadata account of the NFT.                                         |
| `edition`                     |    ✅    |        | Edition account of the NFT.                                          |
| `token_metadata_program`      |          |        | Token Metadata program account.                                      |
| `seller_token_record`         |    ✅    |        | Seller token record account (pNFT, optional).                        |
| `authority_pda_token_record`  |    ✅    |        | Authority PDA token record account (pNFT, optional).                 |
| `buyer_token_record`          |    ✅    |        | Buyer token record account (pNFT, optional).                         |
| `auth_rules`                  |          |        | Auth rules account (pNFT, optional).                                 |
| `instructions`                |          |        | Instructions sysvar (pNFT, optional).                                |
| `auth_rules_program`          |          |        | Auth rules program (pNFT, optional).                                 |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                   |
| -------- | ----------------------------- |
| `index`  | The index of the NFT to claim |

</details>

### 📄 `settle_core_asset_sale`

This instruction settles a Core asset sale. If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified). Distributes proceeds according to royalties and fee configuration. Can be called by anyone (`payer`).

<details>
  <summary>Accounts</summary>

| Name                            | Writable | Signer | Description                                                                       |
| ------------------------------- | :------: | :----: | --------------------------------------------------------------------------------- |
| `payer`                         |    ✅    |   ✅   | Payer for the transaction (anyone can settle the sale).                           |
| `gumball_machine`               |    ✅    |        | The `GumballMachine` account (must be `SaleEnded`).                               |
| `authority_pda`                 |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `authority_pda_payment_account` |    ✅    |        | Authority PDA's payment token account (optional, required for non-native mint).   |
| `authority`                     |    ✅    |        | Gumball machine authority account (checked via `gumball_machine`).                |
| `authority_payment_account`     |    ✅    |        | Authority's payment token account (optional, required for non-native mint).       |
| `seller`                        |    ✅    |        | Seller account (from config line).                                                |
| `seller_payment_account`        |    ✅    |        | Seller's payment token account (optional, required for non-native mint).          |
| `seller_history`                |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `buyer`                         |          |        | Buyer account (from config line).                                                 |
| `fee_account`                   |    ✅    |        | Fee account (optional, from `gumball_machine.marketplace_fee_config`).            |
| `fee_payment_account`           |    ✅    |        | Fee's payment token account (optional, required for non-native mint).             |
| `payment_mint`                  |          |        | Payment mint (optional, required for non-native mint).                            |
| `token_program`                 |          |        | Token program account.                                                            |
| `associated_token_program`      |          |        | Associated Token program account.                                                 |
| `system_program`                |          |        | System program account.                                                           |
| `rent`                          |          |        | Rent sysvar.                                                                      |
| `asset`                         |    ✅    |        | Asset account (from config line).                                                 |
| `collection`                    |    ✅    |        | Collection account if asset is part of one (optional).                            |
| `mpl_core_program`              |          |        | MPL Core program account.                                                         |
| _Remaining accounts_            |    ✅    |        | Royalty recipients' main accounts, followed by their payment accounts if needed.  |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                                |
| -------- | ------------------------------------------ |
| `index`  | The index of the Core asset sale to settle |

</details>

### 📄 `settle_nft_sale`

This instruction settles a legacy NFT sale. If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified). Distributes proceeds according to royalties and fee configuration. Marks primary sale happened if applicable. Can be called by anyone (`payer`).

<details>
  <summary>Accounts</summary>

| Name                            | Writable | Signer | Description                                                                       |
| ------------------------------- | :------: | :----: | --------------------------------------------------------------------------------- |
| `payer`                         |    ✅    |   ✅   | Payer for the transaction (anyone can settle the sale).                           |
| `gumball_machine`               |    ✅    |        | The `GumballMachine` account (must be `SaleEnded`).                               |
| `authority_pda`                 |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `authority_pda_payment_account` |    ✅    |        | Authority PDA's payment token account (optional, required for non-native mint).   |
| `authority`                     |    ✅    |        | Gumball machine authority account (checked via `gumball_machine`).                |
| `authority_payment_account`     |    ✅    |        | Authority's payment token account (optional, required for non-native mint).       |
| `seller`                        |    ✅    |        | Seller account (from config line).                                                |
| `seller_payment_account`        |    ✅    |        | Seller's payment token account (optional, required for non-native mint).          |
| `seller_history`                |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `buyer`                         |          |        | Buyer account (from config line).                                                 |
| `fee_account`                   |    ✅    |        | Fee account (optional, from `gumball_machine.marketplace_fee_config`).            |
| `fee_payment_account`           |    ✅    |        | Fee's payment token account (optional, required for non-native mint).             |
| `payment_mint`                  |          |        | Payment mint (optional, required for non-native mint).                            |
| `token_program`                 |          |        | Token program account.                                                            |
| `associated_token_program`      |          |        | Associated Token program account.                                                 |
| `system_program`                |          |        | System program account.                                                           |
| `rent`                          |          |        | Rent sysvar.                                                                      |
| `mint`                          |          |        | Mint account (from config line).                                                  |
| `buyer_token_account`           |    ✅    |        | Buyer's token account (must match mint and buyer).                                |
| `authority_pda_token_account`   |    ✅    |        | Authority PDA's token account (must match mint and authority PDA).                |
| `metadata`                      |    ✅    |        | Metadata account of the NFT.                                                      |
| `edition`                       |    ✅    |        | Edition account of the NFT.                                                       |
| `token_metadata_program`        |          |        | Token Metadata program account.                                                   |
| `seller_token_record`           |    ✅    |        | Seller token record account (pNFT, optional).                                     |
| `authority_pda_token_record`    |    ✅    |        | Authority PDA token record account (pNFT, optional).                              |
| `buyer_token_record`            |    ✅    |        | Buyer token record account (pNFT, optional).                                      |
| `auth_rules`                    |          |        | Auth rules account (pNFT, optional).                                              |
| `instructions`                  |          |        | Instructions sysvar (pNFT, optional).                                             |
| `auth_rules_program`            |          |        | Auth rules program (pNFT, optional).                                              |
| _Remaining accounts_            |    ✅    |        | Royalty recipients' main accounts, followed by their payment accounts if needed.  |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                         |
| -------- | ----------------------------------- |
| `index`  | The index of the NFT sale to settle |

</details>

### 📄 `settle_tokens_sale_claimed`

This instruction settles a range of fungible token sales (`start_index` to `end_index`) that have either been claimed or were never assigned a buyer (`buyer == Pubkey::default()`). It marks items as settled, distributes proceeds based on the gumball machine's fee configuration (no royalties for fungible tokens), and transfers any unsold tokens back to the `seller`. Can be called by anyone (`payer`) when the gumball machine state is `SaleEnded`.

<details>
  <summary>Accounts</summary>

| Name                            | Writable | Signer | Description                                                                       |
| ------------------------------- | :------: | :----: | --------------------------------------------------------------------------------- |
| `payer`                         |    ✅    |   ✅   | Payer for the transaction (anyone can settle the sale).                           |
| `gumball_machine`               |    ✅    |        | The `GumballMachine` account (must be `SaleEnded`).                               |
| `authority_pda`                 |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `authority_pda_payment_account` |    ✅    |        | Authority PDA's payment token account (optional, required for non-native mint).   |
| `authority`                     |    ✅    |        | Gumball machine authority account (checked via `gumball_machine`).                |
| `authority_payment_account`     |    ✅    |        | Authority's payment token account (optional, required for non-native mint).       |
| `seller`                        |    ✅    |        | Seller account (from config line).                                                |
| `seller_payment_account`        |    ✅    |        | Seller's payment token account (optional, required for non-native mint).          |
| `seller_history`                |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `payment_mint`                  |          |        | Payment mint (optional, required for non-native mint).                            |
| `token_program`                 |          |        | Token program account.                                                            |
| `associated_token_program`      |          |        | Associated Token program account.                                                 |
| `system_program`                |          |        | System program account.                                                           |
| `rent`                          |          |        | Rent sysvar.                                                                      |
| `mint`                          |          |        | Mint account (from config lines in range).                                        |
| `seller_token_account`          |    ✅    |        | Seller's token account (for receiving unsold tokens).                             |
| `authority_pda_token_account`   |    ✅    |        | Authority PDA's token account for the mint.                                       |
| _Remaining accounts_            |    ✅    |        | Fee recipients' main accounts, followed by their payment accounts if needed.      |

</details>

<details>
  <summary>Arguments</summary>

| Argument      | Type  | Description                                  |
| ------------- | ----- | -------------------------------------------- |
| `start_index` | `u32` | The starting index (inclusive) of the range. |
| `end_index`   | `u32` | The ending index (inclusive) of the range.   |

</details>

### 📄 `set_authority`

This instruction sets a new authority for the gumball machine.
The new authority must accept the rotation by co-signing and must be an
on-curve, receivable wallet. Legacy idempotent calls may omit the appended signer.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |
| `new_authority_signer` |      |   ✅   | Optional signer; required when `new_authority` differs from the current authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument        | Description                      |
| --------------- | -------------------------------- |
| `new_authority` | Public key of the new authority. |

</details>

### 📄 `set_mint_authority`

This instruction sets a new mint authority for the gumball machine. Requires the current `authority` and the `new_mint_authority` to sign.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                         |
| ----------------- | :------: | :----: | ----------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.       |
| `authority`       |          |   ✅   | Current gumball machine authority.  |
| `mint_authority`  |          |   ✅   | New gumball machine mint authority. |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `withdraw`

This instruction closes the `GumballMachine` account and sends its rent lamports to the `authority`. It requires all items to be settled (`items_settled == config_count`) and all buy-back funds withdrawn. If a non-native `payment_mint` was used, it transfers only the surplus above parked token debt to the `authority`'s associated token account for that mint (provided in remaining accounts). The token vault closes when no unpaid token debt remains; the vault remains open while debt remains. The authority PDA and its payout ledger survive machine close for later withdrawals and rent recovery. Requires both the `authority` and `mint_authority` to sign.

<details>
  <summary>Accounts</summary>

| Name                            | Writable | Signer | Description                                                                   |
| ------------------------------- | :------: | :----: | ----------------------------------------------------------------------------- |
| `gumball_machine`               |    ✅    |        | The `GumballMachine` account (will be closed).                                |
| `authority`                     |    ✅    |   ✅   | Gumball machine authority (receiver of rent lamports).                        |
| `mint_authority`                |    ✅    |   ✅   | Gumball machine mint authority.                                               |
| `authority_pda`                 |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                   |
| `authority_pda_payment_account` |    ✅    |        | Authority PDA's payment token account (optional, needed for non-native mint). |
| `token_program`                 |          |        | Token program account.                                                        |
| _Remaining accounts (optional)_ |          |        |                                                                               |
| `payment_mint`                  |          |        | Payment mint (if non-native).                                                 |
| `authority_payment_account`     |    ✅    |        | Authority's payment token account (if non-native).                            |
| `associated_token_program`      |          |        | Associated Token program account (if non-native).                             |
| `system_program`                |          |        | System program account (if non-native).                                       |
| `rent`                          |          |        | Rent sysvar (if non-native).                                                  |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `withdraw_payout`

Withdraws a positive `amount: u64` of parked proceeds, bounded by the recipient's
recorded debt. The recipient must sign. Native payouts go to that recipient;
token payouts go to a receivable account owned by that recipient with the
recorded mint and token program. Partial withdrawals are supported, including
after machine close. The final post-close token withdrawal sweeps any remaining
vault surplus and closes the vault when its rent can be returned. Fully paid
entries release their recorded rent deposit.

### 📄 `recover_payout_rent`

Recovers the rent deposit of a ledger entry whose debt is zero. The recorded rent
payer must sign; the recipient need not sign and the machine may already be
closed. Its argument is `recipient: Pubkey`.

For both instructions' account order, currency validation, vault sweeping and
rent-return fallback, see [Parked payouts and compatibility](../../docs/cnft-v2.md#parked-payouts-and-compatibility).

### 📄 `request_add_nft`

This instruction requests to add a legacy NFT to the gumball machine. It freezes the seller's NFT and creates an `AddItemRequest` account.

<details>
  <summary>Accounts</summary>

| Name                     | Writable | Signer | Description                                                                       |
| ------------------------ | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`        |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`         |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `add_item_request`       |    ✅    |        | Add item request account (PDA, seeds: ["add_item_request", mint]).                |
| `authority_pda`          |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `seller`                 |    ✅    |   ✅   | Seller of the NFT.                                                                |
| `mint`                   |          |        | Mint account of the NFT.                                                          |
| `token_account`          |    ✅    |        | Seller's token account for the NFT.                                               |
| `metadata`               |    ✅    |        | Metadata account of the NFT.                                                      |
| `edition`                |          |        | Edition account of the NFT.                                                       |
| `token_program`          |          |        | Token program account.                                                            |
| `token_metadata_program` |          |        | Token Metadata program account.                                                   |
| `system_program`         |          |        | System program account.                                                           |
| `seller_token_record`    |    ✅    |        | Seller token record account (pNFT, optional).                                     |
| `auth_rules`             |          |        | Auth rules account (pNFT, optional).                                              |
| `sysvar_instructions`    |          |        | Instructions sysvar (pNFT, optional).                                             |
| `auth_rules_program`     |          |        | Auth rules program (pNFT, optional).                                              |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `request_add_core_asset`

This instruction requests to add a Core asset to the gumball machine. It freezes the seller's asset and creates an `AddItemRequest` account.

<details>
  <summary>Accounts</summary>

| Name               | Writable | Signer | Description                                                                       |
| ------------------ | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`  |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`   |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `add_item_request` |    ✅    |        | Add item request account (PDA, seeds: ["add_item_request", asset]).               |
| `authority_pda`    |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `seller`           |    ✅    |   ✅   | Seller of the asset.                                                              |
| `asset`            |    ✅    |        | Asset account.                                                                    |
| `collection`       |    ✅    |        | Collection account if asset is part of one (optional).                            |
| `mpl_core_program` |          |        | MPL Core program account.                                                         |
| `system_program`   |          |        | System program account.                                                           |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `cancel_add_nft_request`

This instruction cancels a request to add a legacy NFT to the gumball machine. It thaws and revokes the delegate from the seller's NFT and closes the `AddItemRequest` account.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                        |
| ----------------------------- | :------: | :----: | ---------------------------------------------------------------------------------- |
| `seller_history`              |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).  |
| `add_item_request`            |    ✅    |        | Add item request account (PDA, seeds: ["add_item_request", mint]). Will be closed. |
| `authority_pda`               |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                        |
| `seller`                      |    ✅    |   ✅   | Seller of the NFT.                                                                 |
| `mint`                        |          |        | Mint account of the NFT.                                                           |
| `seller_token_account`        |    ✅    |        | Seller's token account for the NFT.                                                |
| `authority_pda_token_account` |    ✅    |        | Authority PDA's token account for the NFT.                                         |
| `edition`                     |          |        | Edition account of the NFT.                                                        |
| `token_program`               |          |        | Token program account.                                                             |
| `associated_token_program`    |          |        | Associated Token program account.                                                  |
| `token_metadata_program`      |          |        | Token Metadata program account.                                                    |
| `system_program`              |          |        | System program account.                                                            |
| `rent`                        |          |        | Rent sysvar.                                                                       |
| `metadata`                    |    ✅    |        | Metadata account (pNFT, optional).                                                 |
| `seller_token_record`         |    ✅    |        | Seller token record account (pNFT, optional).                                      |
| `auth_rules`                  |          |        | Auth rules account (pNFT, optional).                                               |
| `sysvar_instructions`         |          |        | Instructions sysvar (pNFT, optional).                                              |
| `auth_rules_program`          |          |        | Auth rules program (pNFT, optional).                                               |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `cancel_add_core_asset_request`

This instruction cancels a request to add a Core asset to the gumball machine. It thaws and revokes the delegate from the seller's asset and closes the `AddItemRequest` account.

<details>
  <summary>Accounts</summary>

| Name               | Writable | Signer | Description                                                                                        |
| ------------------ | :------: | :----: | -------------------------------------------------------------------------------------------------- |
| `seller_history`   |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller]). |
| `add_item_request` |    ✅    |        | Add item request account (PDA, seeds: ["add_item_request", asset]). Will be closed.                |
| `authority_pda`    |    ✅    |        | Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine]).                       |
| `seller`           |    ✅    |   ✅   | Seller of the asset.                                                                               |
| `asset`            |    ✅    |        | Asset account.                                                                                     |
| `collection`       |    ✅    |        | Collection account if asset is part of one (optional).                                             |
| `mpl_core_program` |          |        | MPL Core program account.                                                                          |
| `system_program`   |          |        | System program account.                                                                            |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `approve_add_item`

This instruction approves a request to add an item (NFT or Core asset) to the gumball machine. It moves the item details from the `AddItemRequest` account to the `GumballMachine` config lines and closes the `AddItemRequest` account.

<details>
  <summary>Accounts</summary>

| Name               | Writable | Signer | Description                                                                                 |
| ------------------ | :------: | :----: | ------------------------------------------------------------------------------------------- |
| `gumball_machine`  |    ✅    |        | The `GumballMachine` account.                                                               |
| `add_item_request` |    ✅    |        | Add item request account (PDA, seeds: ["add_item_request", asset_or_mint]). Will be closed. |
| `authority_pda`    |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                                 |
| `authority`        |          |   ✅   | Authority of the gumball machine.                                                           |
| `seller`           |    ✅    |        | Seller account (receiver of closed request account rent).                                   |
| `asset`            |          |        | Asset/Mint account pubkey (checked via add_item_request constraint).                        |
| `system_program`   |          |        | System program account.                                                                     |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `remove_tokens_span`

This instruction removes fungible token items from the gumball machine within a specified index range. The signer (`authority`) must be either the gumball machine authority or the seller of the tokens being removed. The removed tokens are transferred back to the seller.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                       |
| ----------------------------- | :------: | :----: | --------------------------------------------------------------------------------- |
| `gumball_machine`             |    ✅    |        | The `GumballMachine` account.                                                     |
| `seller_history`              |    ✅    |        | Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]). |
| `authority_pda`               |    ✅    |        | Authority PDA (PDA, seeds: ["authority", gumball_machine]).                       |
| `authority`                   |    ✅    |   ✅   | Authority allowed to remove (gumball machine authority or item seller).           |
| `seller`                      |    ✅    |        | Seller account (owner of the tokens).                                             |
| `mint`                        |          |        | Mint account of the tokens.                                                       |
| `token_account`               |    ✅    |        | Seller's token account for the mint.                                              |
| `authority_pda_token_account` |    ✅    |        | Authority PDA's token account for the mint.                                       |
| `token_program`               |          |        | Token program account.                                                            |
| `associated_token_program`    |          |        | Associated Token program account.                                                 |
| `system_program`              |          |        | System program account.                                                           |
| `rent`                        |          |        | Rent sysvar.                                                                      |

</details>

<details>
  <summary>Arguments</summary>

| Argument      | Description                                                                |
| ------------- | -------------------------------------------------------------------------- |
| `amount`      | The amount of tokens per item being removed (must match the added amount). |
| `start_index` | The starting index (inclusive) of the token items to remove.               |
| `end_index`   | The ending index (inclusive) of the token items to remove.                 |

</details>

## Bubblegum v2 compressed NFTs

Use `add_cnft_v2`, `request_add_cnft_v2`, `cancel_add_cnft_request_v2`,
`remove_cnft_v2`, `claim_cnft_v2`, and `settle_cnft_sale_v2` for MPL-compression
owned trees. The original instructions and their serialized argument/account
layouts remain compatible with SPL-compression owned v1 trees. Both versions
use `TokenStandard::Compressed` and store the derived Bubblegum asset ID in the
existing config-line mint field.

`CnftArgsV2` carries `root`, `meta_hash`, raw `seller_fee_basis_points`, proof
`creators`, `nonce`, `index`, `version` (2), optional `asset_data_hash`, and `flags`.
`meta_hash` must be the inner keccak of Borsh `MetadataArgsV2`. A missing asset-data
hash means Bubblegum's default empty-data hash; preserve nondefault hashes.
Entry accepts only zero flags and refuses Core collections with permanent
freeze, transfer, or burn delegates. TransferV2 validates deliverability rather
than applying a collection-size cutoff. Every collected leaf requires its actual
`core_collection` account, authenticated by the leaf proof. Supply the real
`leaf_delegate` on add/request; it is a read-only non-signer account. Transfers
reset the delegate to the new owner, so escrow exits use the authority PDA as
both owner and delegate. Tree configs are writable for v2 transfers.

The transfer fee payer is the seller for add/request/cancel, the removing
`authority` for remove, and the instruction `payer` for claim/settle. Bubblegum
collects its protocol fee from that signing wallet, independently of custody
funds and sale proceeds. The program never hard-codes that fee.

Settlement uses leaf royalties when the raw rate is not 65535 and leaf creators
are present. Otherwise it uses the authenticated Core collection Royalties
plugin, or zero if none exists. It remains a secondary sale. Remaining accounts
are **payout** creator wallets (wallet and token account for SPL payments),
preceded by the Token-2022 program slot when applicable, followed by proof nodes.
For collection inheritance, payout creators can differ from proof creators.
Collection payout creators are verified only by verified signatures in the
Core `VerifiedCreators` plugin; update authority equality does not verify them.
Eligibility and inherited payouts borrow the internal plugin registry in place.
Inherited payouts read the collection base once and deserialize only Royalties
and VerifiedCreators. External adapter records and unrelated plugin bodies never
allocate; claimed settlement supports collections with hundreds of adapters.
Already-claimed settlement verifies a reconstructed v2 leaf against MPL
Account Compression using the current owner/delegate, collection hash,
asset-data hash, flags, root, and proof.
For a claimed leaf burned by its owner, set `args.flags = 255` (`u8::MAX`),
use the current empty-node proof, and supply `nonce == index` for that asset.
If the recorded tree is closed (data-empty and no longer MPL-owned), pass its
key and canonical tree-config PDA with zero root and no proof nodes instead.
Owner/delegate arguments are ignored on this path; clients may use
`Pubkey::default()` for both. Every other flags value verifies a live leaf,
including when its owner and delegate are both default keys. Live leaves use
only flags bits 0–2. No creator payout accounts are needed for the burnt path
(except the Token-2022 program slot for Token-2022 proceeds). The program verifies
the empty slot against the current tree and settles with zero royalties, as for
burned Core assets. Undrawn items on every machine version now require
`SaleEnded` before settlement; drawn items retain live solo settlement.

### Undeliverable escrow recovery

Collection eligibility is a snapshot: a collection/tree authority can change a
leaf's collection after escrow, then a new permanent delegate may freeze, burn,
or move it. `refund_cnft_sale_v2` is permissionless and requires MPL compression
`verify_leaf` evidence of the **current** root that the recorded item is empty,
owned by someone other than the machine authority PDA, or has nonzero flags.
Historical roots are rejected even if compression would otherwise accept them.
The tree and nonce derive the stored asset ID; the proof slot is derived from
nonce (Bubblegum allocates nonce == index). Before claim, the recorded buyer
may also sign a refund when the current proof-bound Core collection has any
Permanent* delegate plugin; ordinary claim and transfer settlement remain available.
A claimed item cannot be refunded. Collection/tree authorities may change metadata
or collection membership after delivery, and permanent delegates may then claw back
or burn the leaf while the seller remains paid; there is no post-claim refund.
Unsold items can use this exit only after the sale ends, with the recorded
seller or current machine authority signing as payer. Drawn-item evidence
refunds remain permissionless.

V2 escrow entry requires a version-5 or newer machine. An authorized direct v2 add
or authority approval of a v2 request upgrades an unused version-5 machine to
version 6 and enables a hidden
payment ledger (`40 + 16 * item_capacity` bytes). Current clients preallocate this
space; an older small machine grows only with rent paid by the machine authority.
Invited sellers use authority-approved requests when initial growth is needed.
Minimal v5 allocations fit through capacity 637 (638 with current clients' nineteen
padding bytes); larger growth returns 6078, and invited-seller-funded growth
returns 6079. Recreate larger accounts with v6 space. Both exact u64 ledgers are
retained for original payment history and O(1) cumulative payout accounting.
A pending v2 request leaves the machine version and allocation unchanged and
appends a v2 version marker and a live-accounting marker to its legacy request prefix. Upgrade
is allowed only before a draw or revenue; historical payments are never guessed.
Machines needing more than 10,240 extra bytes in one entry must be created with
preallocated space. Re-adds during a live sale require the ledger to exist.

Each draw stores its actual gross payment, including marketplace fees, in its
item's ledger slot. Undelivered compressed draws reserve their entire payment.
The guard retains marketplace fees in escrow on version-6 machines; normal
settlement pays the configured marketplace fee, then curator fees on the net
amount, then royalties and seller proceeds. Legacy versions retain their
existing draw-time fee behavior. On v6, both revenue reporting and direct draws
require a signing mint authority owned by the canonical gumball-guard program;
a wallet mint authority cannot add unpaid revenue or draw.

Upgrade **gumball-guard first** and verify it before extending and upgrading
**mallow-gumball**. Otherwise the old guard deducts marketplace fees on draw
while the v6 ledger records and reserves the gross payment, underfunding escrow
and charging settlement fees again. Release the clients, backend and SDK/web
with the ordered program upgrades behind `MALLOW_PROGRAMS_V2_READY`.

A successful claim releases that item's reserve. V6 settlement pays available
resolved revenue while retaining the complete pending refund reserve. Per-item
payout records and an unfinalized-proceeds counter preserve cumulative shares:
repeated settlement pays only the increase owed. Partial settlements keep seller
history and their settlement bits open; finalize them after all outstanding draws
(including zero-price draws) resolve and the sale ends or all inventory is drawn.
Early solo live payouts also stay open for later-draw refunds. Batch token settlement follows the same
rule. Unsold inventory settles only after `SaleEnded`. Solo re-adds require no
outstanding draws or unfinalized partial proceeds. Normal v6 draws cannot refill
mid-sale: payouts remain provisional while inventory is drawable, and the last
draw automatically ends the sale. SaleEnded rejects re-add even after payouts
are finalized. Create a new machine for replacement inventory.

Both refund paths return the recorded buyer's full gross draw payment, remove it
from revenue, release its reserve and forfeit its pooled share. They mark the item
claimed and settled, update seller history and emit the same refund event. Unsold
recovery refunds zero, marks delivery skipped and retains the item's seller
history and full pooled entitlement. Run ordinary `settle_cnft_sale_v2` afterwards
with current proof/metadata (empty proof for a burnt leaf, or zero root/no proof
for its missing recorded tree). It skips TransferV2
and pays the normal share, before or after other payouts, without changing the
remaining sellers' divisor.

Permissionless evidence is the current proof-verified leaf: empty,
owner outside escrow, or nonzero flags. A drawn item's proof-bound Permanent*
collection plugin also qualifies when the recorded buyer signs. Collection byte
length and unrelated plugin shapes never authorize a refund.
`admin_refund_cnft_sale_v2` handles other collection-level
claim failures; its remaining accounts start with the marketplace fee authority
signer and canonical guard `GlobalConfig`, then proof nodes. The program checks
config address/owner/discriminator and requires its `account_fee_authority` to
sign. Machine creators cannot authorize this path. It shares the existing refund's named accounts
and argument layout. Operator tooling must simulate the same claim and refuse a
refund if delivery succeeds. Umi's `prepareAdminRefundCnftSaleV2` performs these
checks without sending transactions; the backend must enforce the same rule.

The approximate collection-size entry rejection and its exported constant are
removed. TransferV2 validates deliverability on entry. Shape-specific tests cover
the review's single-attribute boundary (22,213 bytes transfers, 22,214 fails), a
fixture with a different base name (22,210 transfers, 22,211 fails), short
Attributes vectors (170 transfers; 180 fails below 2 KiB), and large AppData
(30,000/60,000 data bytes transfer). These are measurements, not thresholds.

For all versions, payment mint locks after inventory, finalized details, a live
add request, or sale start. Pending requests also forbid raising curator fees,
lowering items per seller or changing hide-sold-items on state-None machines.
Before sale, roots may be set or replaced, while invited inventory or live
requests prevent clearing collab mode. A live u64 request count uses header bytes
411..419 and decreases on approval/cancellation; cancelled uninvited requests
leave no permanent lock. An authority-signed `reject_add_item_request` resolves
an unwanted request without growing the machine ledger or transferring assets;
byte 106 becomes 2, approval is forbidden, and the seller still cancels normally.
A rejected request must be omitted from pending/approval lists.
New requests keep the legacy 105-byte prefix and append
a version byte plus a live-accounting marker (107 bytes total).
All cancellation paths append the writable machine address after any proof nodes;
closure or address recreation cannot block returning the requested asset.
Kit/Umi's `withRequestCancellationMachine` does this without RPC calls. Legacy
requests without the accounting marker accept the original account list.
A pre-upgrade machine holds economic and mint-path locks until the marketplace
attests a complete request scan through `migrate_add_item_requests`. Header byte
410 is 1 only after reconciliation, or on newly initialized machines. Migration
counts legacy requests once, preserves their asset version, and sets byte 106 to
1. Migrated cancellations append the machine; unmigrated and rejected requests
retain their original cancellation account list. Guard changes, wrap/unwrap to
another authority, and direct mint-authority changes share the collaborator lock
for all account versions. Initial wrapping before any custody remains available.
See the deploy-time legacy-request scan and exact migration interface in the
[rollout guide](../../docs/cnft-v2.md).
Shared approval requires collab mode: set the root before approval in the same
transaction or confirm the root update first. Confirm that transaction before
sending later approval groups. All existing instruction discriminators, arguments and
named-account positions remain unchanged. Reclaim binds the receipt's machine
address only, so recreating that closed address cannot block recovery.

See [the recovery and sync guide](../../docs/cnft-v2.md) for the exact v6 layout,
partial-payout formula, operator checks, current artifact and allocation bytes.

For an undeliverable leaf still in escrow, refund creates a 208-byte `CnftRecovery`
receipt at seeds `["cnft_recovery", machine, tree, nonce_le_u64]`. The caller pays
its rent. The receipt retains the machine address, its authority at refund,
seller, asset, tree, nonce and rent payer; it survives machine closure.
`reclaim_cnft_v2` requires the current marketplace fee authority from the
canonical guard `GlobalConfig` to sign and transfers only to the recorded seller.
Its first remaining account is that config, then fresh proof nodes. Pass the
machine address even after closure; machine authority rotation and closure never
remove the marketplace's ability to recover. The receipt's creator snapshot is
historical and does not authorize reclaim. Transfer rules
must permit recovery (for example the collection delegate must thaw its flag).
The signing authority pays Bubblegum's fee; receipt rent returns to its original
payer. A seller signature alone cannot recover the refunded item.

No receipt is retained for a burnt or moved leaf. If a retained leaf is later
burnt or leaves escrow, `close_missing_cnft_recovery_v2` permissionlessly verifies
current-root evidence or `leaf = None` with its closed recorded tree, and returns
receipt rent to its original payer. It cannot
close a receipt while the live leaf remains in escrow, even when flagged.
Missing-tree evidence includes foreign-owned accounts with data, invalid MPL
headers and slots outside a replacement tree's append index/capacity. Slots
below the append index retain ordinary current-root empty-leaf verification.
SPL-owned replacements use the marketplace-admin no-leaf refund; burnt settlement
prefixes remaining accounts with the marketplace signer and canonical guard
GlobalConfig before the Token-2022 slot, if any. This protects live v1 config
lines. Typed v2 recovery receipts accept SPL replacement evidence without a
signer. Admin refunds with no leaf are tree-independent, and operator tooling
must simulate the same claim before authorizing skipped delivery. See the
[closed-tree rules](../../docs/cnft-v2.md#closed-trees).

Occupied/unprovable MPL replacements require marketplace-authorized exits after
off-chain verification. For claimed or recovered-unsold settlement, use a zero
root, `args.flags = 255`, `nonce == index`, and the marketplace signer/canonical
GlobalConfig prefix before any Token-2022 slot. Receipt cleanup uses no leaf,
zero root and the same prefix, returning rent to its recorded payer. Normal
machine close follows settlement. No on-chain permissionless predicate changes.

`RefundCnftSaleEvent` identifies machine, asset, seller, buyer, payment mint,
refund amount and any retained receipt. V1 instruction layouts and config-line storage remain unchanged. Version 6 adds
its payment ledger after the version-5 hidden section. See [recovery interfaces](../../docs/cnft-v2.md).

Approval and Gumball Guard draw remain shared between versions: approval moves
request state into config lines; draw records the buyer and does not move a leaf.
Neither forwards an asset-transfer instruction.

Generate all clients with `pnpm generate:clients` after the documented program
build. Run narrow cNFT regression tests using:

```sh
heavy -c 2 'cd clients/umi && pnpm exec tsup && pnpm exec ava test/cnft.test.ts test/cnftV2.test.ts'
heavy -c 2 'cd clients/umi && CNFT_V2_METRICS_OUT=../../docs/cnft-v2-metrics.json pnpm exec ava test/cnftV2Budget.test.ts'
```

The budget fixture uses fixed test keypairs to make PDA bump costs reproducible.
It measures v0 transactions with one leaf royalty recipient, zero asset flags,
and the default asset-data hash, at transmitted proof depths 0/5/10/14. It also
measures inherited collection royalties with two recipients and SOL, SPL Token,
and Token-2022 payment at depths 5/14. Transfer settlement uses 4 KB Attributes;
claimed settlement grows the collection to 40 KB after claim. Each measurement
asserts a CU ceiling (110,000 for the standard leaf/SOL fixture, 135,000 for the
four leaf `settle_cnft_sale_v2_transfer` rows, and 170,000 for collection
fixtures) and every LUT transaction must fit the 1232-byte packet limit. Normal
runs compare every row against the committed JSON: byte sizes and packet-fit
results must match exactly, and CU may differ by at most 3% (minimum 100 CU).
An explicit `CNFT_V2_METRICS_OUT` run records a new baseline for review. Depth
zero uses a depth-five tree with a full canopy. It simulates both
lookup-table variants and sends the LUT form. Packet-fit results must be checked
against the 1232-byte transaction limit when adding collection accounts,
creators, token payments, or extra instructions.

The measured results are in [cnft-v2-metrics.json](../../docs/cnft-v2-metrics.json).
All 58 rows pass committed-baseline comparison: 61,003–165,460 CU and 371–509 bytes
with a LUT (641–1537 bytes without one). The asserted ceilings cover these
fixtures, not every possible creator count.
Depth-14 leaf settlement is 1343 bytes without a LUT and 509 bytes with one,
so it requires a LUT. A single-leaf tree's
zero first sibling deduplicates with the System Program account; a nonzero
sibling adds 32 bytes. Different production keys can incur different PDA bump
costs.
Oversized forms are simulated locally as raw bytes for compute measurement and
marked as exceeding the packet limit; only the LUT forms are sent.

The loaded Bubblegum binary disables `updateAssetDataV2` with error 6050, so the
nondefault asset-data lifecycle fixture is explicitly skipped for that upstream
limitation.
The Rust client codec test still round-trips nondefault asset-data hashes.

The loaded Bubblegum binary fully deserializes the Core collection during
`TransferV2` and runs out of heap with the 40 KB Attributes fixture. Targeted
gumball collection reads fix claimed settlement and entry eligibility checks,
but this upstream limit still applies to transfers, including unclaimed
settlement. The registry regression asserts `InvalidAssetPlugin` before the
transfer CPI on a permanent-delegate collection with 40 KB Attributes.
