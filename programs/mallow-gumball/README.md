# mallow Gumball Machine

## Overview

The mallow Gumball Machine is a fork of the Metaplex Protocol's Candy Machine, designed to enhance flexibility and collaboration in NFT distribution on Solana. This iteration allows for the use of pre-minted NFTs, supporting both Metaplex Legacy and Core NFT standards, instead of minting new ones during the distribution process. The NFTs selected on each sale use the same randomness as the original Candy Machine.

Key features of the mallow Gumball Machine include:

- Support for pre-minted NFTs: Users can add existing Metaplex Legacy and Core NFTs to Gumball Machines.
- Collaborative curation: Curators can invite multiple sellers to add their NFTs to a single Gumball Machine.
- Curator fee system: Curators can set and receive a fee for each sale from the Gumball Machine.
- Socialized proceeds: Sellers receive an equal share of the total proceeds per NFT they contribute to the Gumball Machine.

The mallow Gumball Machine is responsible for:

- NFT management: Configuration of how many pre-minted NFTs are available and their metadata information.
- Index generation and selection: For fair and random distribution of NFTs.
- NFT distribution: Transferring ownership of pre-minted NFTs to buyers.

### Why use pre-minted NFTs?

Using pre-minted NFTs offers several advantages:

1. Flexibility: Allows for the inclusion of existing NFTs from various collections.
2. Collaboration: Enables multiple artists or sellers to contribute to a single Gumball Machine.
3. Curation: Curators can create themed or curated collections from existing NFTs.
4. Allows for secondary sales of NFTs

### Who can add NFTs to a Gumball Machine?

The mallow Gumball Machine introduces a collaborative model:

- The `authority` of the Gumball Machine can add NFTs.
- Invited sellers can add their pre-minted NFTs to the Gumball Machine.

This model allows for community-driven curation and distribution of NFTs, while still providing a mechanism for curators to be compensated for their efforts.

### How are proceeds distributed?

The mallow Gumball Machine implements a socialized proceeds model:

- Total proceeds from sales are pooled together.
- Each seller receives an equal share of the total proceeds per NFT they contributed to the Gumball Machine.
- The optional curator fee and optional marketplace fee is deducted before the proceeds are distributed to sellers.

This model ensures fair compensation for all participating sellers, regardless of which specific NFTs are sold.

## Account

The `Gumball Machine` configuration is stored in a single account, which includes settings that
control the behaviour of the gumball machine and metadata information for the NFTs minted through it.
The account data is represented by the
[`GumballMachine`](https://github.com/metaplex-foundation/metaplex-program-library/blob/febo/mallow-gumball/mallow-gumball/program/src/state/gumball_machine.rs)
struct, which include references to auxiliary structs
[`Creator`](https://github.com/metaplex-foundation/metaplex-program-library/blob/febo/mallow-gumball/mallow-gumball/program/src/state/gumball_machine_data.rs),
[`ConfigLineSettings`](https://github.com/metaplex-foundation/metaplex-program-library/blob/febo/mallow-gumball/mallow-gumball/program/src/state/gumball_machine_data.rs)
and
[`HiddenSettings`](https://github.com/metaplex-foundation/metaplex-program-library/blob/febo/mallow-gumball/mallow-gumball/program/src/state/gumball_machine_data.rs).

| Field                    | Offset | Size | Description                                                                                |
| ------------------------ | ------ | ---- | ------------------------------------------------------------------------------------------ |
| &mdash;                  | 0      | 8    | Anchor account discriminator.                                                              |
| `version`                | 8      | 1    | Version of the account.                                                                    |
| `authority`              | 9      | 32   | Authority address.                                                                         |
| `mint_authority`         | 41     | 32   | Authority address allowed to mint from the gumball machine.                                |
| `marketplace_fee_config` | 73     | 34   | (Optional) Fee config for the marketplace this gumball is listed on.                       |
| `items_redeemed`         | 107    | 8    | Number of assets redeemed.                                                                 |
| `items_settled`          | 115    | 8    | Number of assets settled after sale.                                                       |
| `total_revenue`          | 123    | 8    | Amount of lamports/tokens received from purchases.                                         |
| `state`                  | 131    | 1    | State of the gumball machine (enum: None, DetailsFinalized, SaleLive, SaleEnded).          |
| `settings`               | 132    | ~    | User-defined settings (GumballSettings struct).                                            |
| - `uri`                  | ~      | 196  | Uri of off-chain metadata, max length 196.                                                 |
| - `item_capacity`        | ~      | 8    | Number of assets that can be added.                                                        |
| - `items_per_seller`     | ~      | 2    | Max number of items that can be added by a single seller.                                  |
| - `sellers_merkle_root`  | ~      | 32   | (Optional) Merkle root hash for sellers who can add items to the machine.                  |
| - `curator_fee_bps`      | ~      | 2    | Fee basis points paid to the machine authority.                                            |
| - `hide_sold_items`      | ~      | 1    | True if the front end should hide items that have been sold.                               |
| - `payment_mint`         | ~      | 32   | Payment token for the mint.                                                                |
| _hidden section_         | ~      | ~    | Hidden data section to avoid unnecessary deserialization.                                  |
| - _items_inserted_       | ~      | 4    | (u32) Number of actual lines of data currently inserted (eventually equals item_capacity). |
| - _config lines_         | ~      | ~    | (CONFIG_LINE_SIZE \* item_capacity) Config lines for storing asset data.                   |
| - _claimed items mask_   | ~      | ~    | (item_capacity / 8) + 1 bit mask to keep track of which items have been claimed.           |
| - _settled items mask_   | ~      | ~    | (item_capacity / 8) + 1 bit mask to keep track of which items have been settled.           |
| - _mint indices_         | ~      | ~    | (u32 \* item_capacity) mint indices.                                                       |

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

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |        | Public key of the gumball machine authority. |
| `payer`           |    ✅    |   ✅   | Payer of the transaction.                    |

</details>

<details>
  <summary>Arguments</summary>

| Argument     | Description                  |
| ------------ | ---------------------------- |
| `settings`   | `GumballSettings` object.    |
| `fee_config` | Optional `FeeConfig` object. |

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

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument            | Description                            |
| ------------------- | -------------------------------------- |
| `seller_proof_path` | Optional vector of 32-byte array path. |

</details>

### 📄 `add_core_asset`

This instruction adds a Core asset to the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument            | Description                            |
| ------------------- | -------------------------------------- |
| `seller_proof_path` | Optional vector of 32-byte array path. |

</details>

### 📄 `remove_nft`

This instruction removes a legacy NFT from the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                    |
| -------- | ------------------------------ |
| `index`  | The index of the NFT to remove |

</details>

### 📄 `remove_core_asset`

This instruction removes a Core asset from the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                           |
| -------- | ------------------------------------- |
| `index`  | The index of the Core asset to remove |

</details>

### 📄 `start_sale`

This instruction allows minting to begin.

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

This instruction mints an NFT from the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                       |
| ----------------- | :------: | :----: | ------------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                     |
| `mint_authority`  |          |   ✅   | Public key of the gumball machine mint authority. |
| `payer`           |    ✅    |   ✅   | Payer of the transaction.                         |
| `nft_mint`        |    ✅    |        | Mint account of the NFT.                          |

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

This instruction settles a Core asset sale.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                          |
| -------- | ------------------------------------ |
| `index`  | The index of the Core asset to claim |

</details>

### 📄 `claim_nft`

This instruction settles a legacy NFT sale.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                   |
| -------- | ----------------------------- |
| `index`  | The index of the NFT to claim |

</details>

### 📄 `settle_core_asset_sale`

This instruction settles a Core asset sale.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                                |
| -------- | ------------------------------------------ |
| `index`  | The index of the Core asset sale to settle |

</details>

### 📄 `settle_nft_sale`

This instruction settles a legacy NFT sale.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument | Description                         |
| -------- | ----------------------------------- |
| `index`  | The index of the NFT sale to settle |

</details>

### 📄 `set_authority`

This instruction sets a new authority for the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

| Argument        | Description                      |
| --------------- | -------------------------------- |
| `new_authority` | Public key of the new authority. |

</details>

### 📄 `set_mint_authority`

This instruction sets a new mint authority for the gumball machine.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |          |   ✅   | Public key of the gumball machine authority. |
| `mint_authority`  |          |   ✅   | Public key of the new mint authority.        |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>

### 📄 `withdraw`

This instruction withdraws the rent lamports and closes the gumball machine account.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                  |
| ----------------- | :------: | :----: | -------------------------------------------- |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account.                |
| `authority`       |    ✅    |   ✅   | Public key of the gumball machine authority. |

</details>

<details>
  <summary>Arguments</summary>

None.

</details>
