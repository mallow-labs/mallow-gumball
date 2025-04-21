# Metaplex Gumball Guard

## Overview

The new `Gumball Guard` program is designed to take away the **access control** logic from the `Gumball Machine` to handle the additional mint features, while the Gumball Machine program retains its core draw functionality &mdash; the selection of prizes. This not only provides a clear separation between **access controls** and **draw logic**, it also provides a modular and flexible architecture to add or remove mint features without having to modify the Gumball Machine program.

The access control on a Gumball Guard is encapsulated in individuals guards representing a specific rule that needs to be satisfied, which can be enabled or disabled. For example, the live date of the mint is represented as the `LiveDate` guard. This guard is satisfied only if the transaction time is on or after the configured start time on the guard. Other guards can validate different aspects of the access control – e.g., ensuring that the user holds a specific token (token gating).

> **Note**
> The Gumball Guard program can only be used in combination with `Gumball Machine` accounts. When a Gumball Guard is used in combination with a Gumball Machine, it becomes its mint authority and minting is only possible through the Gumball Guard.

### How the program works?

![image](https://user-images.githubusercontent.com/729235/192335006-d4f2c573-165f-4c5a-aef7-7428cd74bb2b.png)

The main purpose of the Gumball Guard program is to hold the configuration of draw **guards** and apply them before a user can draw from a gumball machine. If all enabled guard conditions are valid, the draw transaction is forwarded to the Gumball Machine.

When a draw transaction is received, the program performs the following steps:

1. Validates the transaction against all enabled guards.
   - If any of the guards fail at this point, the transaction is subject to the `BotTax` (when the `BotTax` guard is enabled) and the transaction is then aborted.
2. After evaluating that all guards are valid, it invokes the `pre_actions` function on each guard. This function is responsible to perform any action **before** the mint (e.g., take payment for the mint).
3. Then the transaction is forwarded to the Gumball Machine program to mint the NFT.
4. Finally, it invokes the `post_actions` function on each enabled guard. This function is responsible to perform any action **after** the mint (e.g., freeze the NFT, change the update authority).

A **guard** is a modular piece of code that can be easily added to the Gumball Guard program, providing great flexibility and simplicity to support specific features without having to modify directly the Gumball Machine program. Adding new guards is supported by conforming to specific interfaces, with changes isolated to the individual guard – e.g., each guard can be created and modified in isolation. This architecture also provides the flexibility to enable/disable guards without requiring code changes, as each guard has an enable/disable "switch".

The Gumball Guard program contains a set of core access control guards that can be enabled/disabled:

- `AddressGate`: restricts the mint to a single address
- `Allocation`: specify the maximum number of mints in a group (guard set)
- `AllowList`: uses a wallet address list to determine who is allowed to mint
- `BotTax`: configurable tax (amount) to charge invalid transactions
- `EndDate`: determines a date to end the mint
- `Gatekeeper`: captcha integration
- `MintLimit`: specified a limit on the number of mints per wallet
- `NftBurn`: restricts the mint to holders of a specified collection, requiring a burn of the NFT
- `NftGate`: restricts the mint to holders of a specified collection
- `NftPayment`: set the price of the mint as an NFT of a specified collection
- `ProgramGate`: restricts the programs that can be in a mint transaction
- `RedeemedAmount`: determines the end of the mint based on a total amount minted
- `SolPayment`: set the price of the mint in SOL
- `StartDate`: determines the start date of the mint
- `ThirdPartySigner`: requires an additional signer on the transaction
- `TokenBurn`: restricts the mint to holders of a specified spl-token, requiring a burn of the tokens
- `TokenGate`: restricts the mint to holders of a specified spl-token
- `TokenPayment`: set the price of the mint in spl-token amount
- `Token22Payment`: set the price of the mint in spl-token-22 amount

## Account

The Gumball Guard configuration is stored in a single account. The information regarding the guards that are enable is stored in a "hidden" section of the account to avoid unnecessary deserialization.

| Field             | Offset | Size | Description                                                                                                                 |
| ----------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| &mdash;           | 0      | 8    | Anchor account discriminator.                                                                                               |
| `base`            | 8      | 32   | `PubKey` to derive the PDA key. The seed is defined by `["gumball_guard", base pubkey]`.                                    |
| `bump`            | 40     | 1    | `u8` representing the bump of the derivation.                                                                               |
| `authority`       | 41     | 32   | `PubKey` of the authority address that controls the Gumball Guard.                                                          |
| _hidden section_  | 73     | ~    | Hidden data section to avoid unnecessary deserialization. This section of the account is used to serialize the guards data. |
| - _features_      | 73     | 8    | Feature flags indicating which guards are serialized.                                                                       |
| - _guard set_     | 81     | ~    | (optional) A sequence of serialized guard structs.                                                                          |
| - _group counter_ | ~      | 4    | `u32` specifying the number of groups in use.                                                                               |
| - _groups_        | ~      | ~    | (optional) A variable number of `Group` structs representing different guard sets. Each group is defined by:                |
| -- _label_        | ~      | 6    | The label of the group.                                                                                                     |
| -- _features_     | ~      | 8    | Feature flags indicating which guards are serialized for the group.                                                         |
| -- _guard set_    | ~      | ~    | (optional) A sequence of serialized guard structs.                                                                          |

Since the number of guards enabled and groups is variable, the account size is dynamically resized during the `update` instruction to accommodate the updated configuration.

## Instructions

### 📄 `initialize`

This instruction creates and initializes a new `GumballGuard` account.

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                             |
| ---------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------- |
| `gumball_guard`  |    ✅    |        | The `GumballGuard` account PDA key. The PDA is derived using the seed `["gumball_guard", base pubkey]`. |
| `base`           |          |   ✅   | Base public key for the PDA derivation.                                                                 |
| `authority`      |          |        | Public key of the gumball guard authority.                                                              |
| `payer`          |          |   ✅   | Payer of the transaction.                                                                               |
| `system_program` |          |        | `SystemProgram` account.                                                                                |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument                      | Offset | Size | Description               |
| ----------------------------- | ------ | ---- | ------------------------- |
| `data`                        | 0      | ~    | Serialized `GumballGuardData` object as `[u8]`. |

The instruction uses a [custom serialization](https://docs.rs/gumball-guard/0.1.1/gumball_guard/state/gumball_guard/struct.GumballGuardData.html#method.save) in order to maintain backwards compatibility with previous versions of the `GumballGuardData` struct.

</details>

### 📄 `draw`

This instruction draws an item from a Gumball Machine "wrapped" by a Gumball Guard. Only when the transaction is succesfully validated, it is forwarded to the Gumball Machine.

<details>
  <summary>Accounts</summary>

| Name                      | Writable | Signer | Description                                                                                             |
| ------------------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------- |
| `gumball_guard`           |          |        | The `GumballGuard` account PDA key. The PDA is derived using the seed `["gumball_guard", base pubkey]`. |
| `gumball_machine_program` |          |        | `GumballMachine` program ID (`mallow_gumball::id()`).                                                   |
| `gumball_machine`         |    ✅    |        | The `GumballMachine` account (must be owned by `gumball_guard`).                                        |
| `payer`                   |    ✅    |   ✅   | Payer for the mint transaction and SOL fees.                                                            |
| `buyer`                   |    ✅    |   ✅   | Buyer account for validation and non-SOL fees.                                                          |
| `token_metadata_program`  |          |        | Metaplex `TokenMetadata` program ID (`mpl_token_metadata::ID`).                                         |
| `spl_token_program`       |          |        | `spl-token` program ID.                                                                                 |
| `system_program`          |          |        | `SystemProgram` account.                                                                                |
| `sysvar_instructions`     |          |        | `sysvar::instructions` account.                                                                         |
| `recent_slothashes`       |          |        | SlotHashes sysvar cluster data (`sysvar::slot_hashes::id()`).                                           |
| `gumball_event_authority` |          |        | Authority for emitting Gumball Machine events.                                                          |
| _remaining accounts_      |          |        | (optional) A list of optional accounts required by individual guards.                                   |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument        | Offset | Size | Description               |
| --------------- | ------ | ---- | ------------------------- |
| `mint_args`     | 0      | ~    | `[u8]` representing arguments for guards; an empty `[u8]` if there are no arguments. |
| `label`         | ~      | 6    | (optional) `string` representing the group label to use for validation of guards. |
</details>

### 📄 `route`

This instruction routes the transaction to a guard, allowing the execution of custom guard instructions. The transaction can include any additional accounts required by the guard instruction. The guard that will received the transaction and any additional parameters is specified in the `RouteArgs` struct.

<details>
  <summary>Accounts</summary>

| Name                 | Writable | Signer | Description                                                               |
| -------------------- | :------: | :----: | ------------------------------------------------------------------------- |
| `gumball_guard`      |          |        | The `GumballGuard` account PDA key.                                       |
| `candy_machine`      |    ✅    |        | The `GumballMachine` account.                                             |
| `payer`              |    ✅    |   ✅   | Payer of the transaction.                                                 |
| _remaining accounts_ |          |        | (optional) A list of optional accounts required by the guard instruction. |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description               |
| -------------| ---- | ------------------------- |
| `args`       |      | `RouteArgs` struct.       |
| - *guard*    | 1    | Value of enum `GuardType` |
| - *data*     | ~    | `[u8]` representing arguments for the instruction; an empty `[u8]` if there are no arguments. |
| `label`      | 6    | (optional) string representing the group label to use for retrieving the guards set. |
</details>

### 📄 `unwrap`

This instruction removes a Gumball Guard from a Gumball Machine, setting the mint authority of the Gumball Machine to be the Gumball Machine authority. The Gumball Gard `public key` must match the Gumball Machine `mint_authority` for this instruction to succeed.

<details>
  <summary>Accounts</summary>

| Name                      | Writable | Signer | Description                                  |
| ------------------------- | :------: | :----: | -------------------------------------------- |
| `gumball_guard`           |          |        | The `GumballGuard` account PDA key.          |
| `authority`               |          |   ✅   | Public key of the `gumball_guard` authority. |
| `candy_machine`           |    ✅    |        | The `GumballMachine` account.                |
| `candy_machine_authority` |          |   ✅   | Public key of the `candy_machine` authority. |
| `candy_machine_program`   |          |        | `GumballMachine` program ID.                 |

</details>

<details>
  <summary>Arguments</summary>
  
None.
</details>

### 📄 `update`

This instruction updates the Gumball Guard configuration. Given that there is a flexible number of guards and groups that can be present, this instruction will resize the account accordingly, either increasing or decreasing the account size. Therefore, there will be either a charge for rent or a withdraw of rent lamports.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                                               |
| ----------------- | :------: | :----: | ------------------------------------------------------------------------- |
| `gumball_guard`   |    ✅    |        | The `GumballGuard` account PDA key.                                       |
| `gumball_machine` |    ✅    |        | The `GumballMachine` account. Constraints checked: `items_redeemed == 0`. |
| `authority`       |          |   ✅   | Public key of the `gumball_guard` authority.                              |
| `payer`           |    ✅    |   ✅   | Payer of the transaction and potential rent changes.                      |
| `system_program`  |          |        | `SystemProgram` account.                                                  |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument                      | Offset | Size | Description               |
| ----------------------------- | ------ | ---- | ------------------------- |
| `data`                        | 0      | ~    | Serialized `GumballGuardData` object as `[u8]`. |

The instruction uses a [custom serialization](https://docs.rs/gumball-guard/0.1.1/gumball_guard/state/gumball_guard/struct.GumballGuardData.html#method.save) in order to maintain backwards compatibility with previous versions of the `GumballGuardData` struct.

</details>

### 📄 `withdraw`

This instruction closes the `GumballGuard` account, transferring its rent lamports to the `authority`. It also invokes the `CloseGumballMachine` instruction on the associated `GumballMachine` program to close the gumball machine account. After executing this instruction, both the Gumball Guard and Gumball Machine accounts will not be operational.

<details>
  <summary>Accounts</summary>

| Name                            | Writable | Signer | Description                                                                   |
| ------------------------------- | :------: | :----: | ----------------------------------------------------------------------------- |
| `gumball_guard`                 |    ✅    |        | The `GumballGuard` account to close.                                          |
| `authority`                     |    ✅    |   ✅   | Public key of the `gumball_guard` authority (receives rent lamports).         |
| `gumball_machine`               |    ✅    |        | The associated `GumballMachine` account to close.                             |
| `authority_pda`                 |    ✅    |        | PDA authority for the `GumballMachine`.                                       |
| `authority_pda_payment_account` |    ✅    |        | (optional) Token account for the `authority_pda` if token payments were used. |
| `gumball_machine_program`       |          |        | `GumballMachine` program ID.                                                  |
| `token_program`                 |          |        | `spl-token` program ID.                                                       |

</details>

<details>
  <summary>Arguments</summary>
  
None.
</details>

### 📄 `wrap`

This instruction adds a Gumball Guard to a Gumball Machine. After the guard is added, minting is only allowed through the Gumball Guard.

<details>
  <summary>Accounts</summary>

| Name                      | Writable | Signer | Description                                  |
| ------------------------- | :------: | :----: | -------------------------------------------- |
| `gumball_guard`           |          |        | The `GumballGuard` account PDA key.          |
| `authority`               |          |   ✅   | Public key of the `gumball_guard` authority. |
| `candy_machine`           |    ✅    |        | The `GumballMachine` account.                |
| `candy_machine_authority` |          |   ✅   | Public key of the `candy_machine` authority. |
| `candy_machine_program`   |          |        | `GumballMachine` program ID.                 |

</details>

<details>
  <summary>Arguments</summary>
  
None.
</details>

## Guards

### `AddressGate`

```rust
pub struct AddressGate {
    address: Pubkey,
}
```

The `AddressGate` guard restricts the mint to a single `address` &mdash; the `address` must match the payer's address of the mint transaction.

### `Allocation`

```rust
pub struct Allocation {
    pub id: u8,
    pub size: u16,
}
```

The `Allocation` guard specifies the maximum number of mints allowed in a group (guard set). The `id` configuration represents the unique identification for the allocation &mdash; changing the `id` has the effect of restarting the limit, since a different tracking account will be created. The `size` indicates the maximum number of mints allocated.

<details>
  <summary>Accounts</summary>

| Name           | Writable | Signer | Description                                                                                                                       |
| -------------- | :------: | :----: | --------------------------------------------------------------------------------------------------------------------------------- |
| `mint_tracker` |    ✅    |        | Mint tracker PDA. The PDA is derived using the seed `["allocation", allocation id, gumball guard pubkey, gumball machine pubkey]` |

</details>

#### Route Instruction

The allocation PDA needs to be created before the first mint transaction is validated. This is done by a `route` instruction with the following accounts and `RouteArgs`:

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                                           |
| ---------------- | :------: | :----: | --------------------------------------------------------------------------------------------------------------------- |
| `proof_pda`      |    ✅    |        | PDA to represent the allocation (seed `["allocation", allocation id, gumball guard pubkey, gumball machine pubkey]`). |
| `authority`      |          |   ✅   | Gumball Guard authority                                                                                               |
| `system_program` |          |        | System program account.                                                                                               |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description               |
| -------------| ---- | ------------------------- |
| `args`       |      | `RouteArgs` struct        |
| - *guard*    | 1    | `GuardType.Allocation`    |
| - *data*     | 0    | Empty                     |
</details>

### `AllowList`

```rust
pub struct AllowList {
    pub merkle_root: [u8; 32],
}
```

The `AllowList` guard validates the payer's address against a merkle tree-based allow list of addresses. It required the root of the merkle tree as a configuration and the mint transaction must include the PDA of the merkle proof. The transaction will fail if no proof is specified.

<details>
  <summary>Accounts</summary>

| Name        | Writable | Signer | Description                                                                                                                  |
| ----------- | :------: | :----: | ---------------------------------------------------------------------------------------------------------------------------- |
| `proof_pda` |          |        | PDA of the merkle proof (seed `["allow_list", merkle tree root, minter key, gumball guard pubkey, gumball machine pubkey]`). |

</details>

#### Route Instruction

The merkle proof validation needs to be completed before the mint transaction. This is done by a `route` instruction with the following accounts and `RouteArgs`:

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                                                                  |
| ---------------- | :------: | :----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `proof_pda`      |    ✅    |        | PDA to represent the merkle proof (seed `["allow_list", merkle tree root, payer/minter key, gumball guard pubkey, gumball machine pubkey]`). |
| `system_program` |          |        | System program account.                                                                                                                      |
| `minter`         |          |        | (optional) Minter account to validate.                                                                                                       |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description               |
| -------------| ---- | ------------------------- |
| `args`       |      | `RouteArgs` struct         |
| - *guard*    | 1    | `GuardType.AllowList`    |
| - *data*     | ~    | `Vec` of the merkle proof hash values. |
</details>

### `BotTax`

```rust
pub struct BotTax {
    pub lamports: u64,
    pub last_instruction: bool,
}
```

The `BotTax` guard is used to:

- charge a penalty for invalid transactions. The value of the penalty is specified by the `lamports` configuration.
- validate that the mint transaction is the last transaction (`last_instruction = true`).

The `bot_tax` is applied to any error that occurs during the validation of the guards.

### `EndDate`

```rust
pub struct EndDate {
    pub date: i64,
}
```

The `EndDate` guard is used to specify a date to end the mint. Any transaction received after the end date will fail.

### `Gatekeeper`

```rust
pub struct Gatekeeper {
    pub gatekeeper_network: Pubkey,
    pub expire_on_use: bool,
}
```

The `Gatekeeper` guard validates if the payer of the transaction has a _token_ from a specified gateway network &mdash; in most cases, a _token_ after completing a captcha challenge. The `expire_on_use` configuration is used to indicate whether or not the token should expire after minting.

<details>
  <summary>Accounts</summary>

| Name                       | Writable | Signer | Description                 |
| -------------------------- | :------: | :----: | --------------------------- |
| `gatekeeper_token_account` |    ✅    |        | Gatekeeper token account.   |
| `gatekeeper_program`       |          |        | Gatekeeper program account. |
| `network_expire_feature`   |          |        | Gatekeeper expire account.  |

</details>

### `MintLimit`

```rust
pub struct MintLimit {
    pub id: u8,
    pub limit: u16,
}
```

The `MintLimit` guard allows to specify a limit on the number of mints for each individual address. The `id` configuration represents the unique identification for the limit &mdash; changing the `id` has the effect of restarting the limit, since a different tracking account will be created. The `limit` indicated the maximum number of mints allowed.

<details>
  <summary>Accounts</summary>

| Name         | Writable | Signer | Description                                                                                                                                  |
| ------------ | :------: | :----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mint_count` |    ✅    |        | Mint counter PDA. The PDA is derived using the seed `["mint_limit", mint guard id, payer key, gumball guard pubkey, gumball machine pubkey]` |

</details>

### `NftBurn`

```rust
pub struct NftBurn {
    pub required_collection: Pubkey,
}
```

The `NftBurn` guard restricts the mint to holders of another NFT (token), requiring that the NFT is burn in exchange of being allowed to mint.

<details>
  <summary>Accounts</summary>

| Name                           | Writable | Signer | Description                                |
| ------------------------------ | :------: | :----: | ------------------------------------------ |
| `nft_account`                  |    ✅    |        | Token account of the NFT.                  |
| `nft_metadata`                 |    ✅    |        | Metadata account of the NFT.               |
| `nft_edition`                  |    ✅    |        | Master Edition account of the NFT.         |
| `nft_mint_account`             |    ✅    |        | Mint account of the NFT.                   |
| `nft_mint_collection_metadata` |    ✅    |        | Collection metadata account of the NFT.    |
| `nft_token_record`             |    ✅    |        | (optional) Token Record of the NFT (pNFT). |

</details>

### `NftGate`

```rust
pub struct NftGate {
    pub required_collection: Pubkey,
}
```

The `NftGate` guard restricts the mint to holders of a specified `required_collection` NFT collection. The payer is required to hold at least one NFT of the collection.

<details>
  <summary>Accounts</summary>

| Name           | Writable | Signer | Description                  |
| -------------- | :------: | :----: | ---------------------------- |
| `nft_account`  |          |        | Token account of the NFT.    |
| `nft_metadata` |          |        | Metadata account of the NFT. |

</details>

### `NftPayment`

```rust
pub struct NftPayment {
    pub required_collection: Pubkey,
    pub destination: Pubkey,
}
```

The `NftPayment` guard is a payment guard that charges another NFT (token) from a specific collection for the mint. As a requirement of the mint, the specified NFT is transferred to the `destination` address.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                            |
| ----------------------------- | :------: | :----: | -------------------------------------------------------------------------------------- |
| `nft_account`                 |    ✅    |        | Token account of the NFT.                                                              |
| `nft_metadata`                |    ✅    |        | Metadata account of the NFT.                                                           |
| `nft_mint_account`            |          |        | Mint account of the NFT.                                                               |
| `destination`                 |          |        | Account to receive the NFT.                                                            |
| `destination_ata`             |    ✅    |        | Destination PDA key (seeds `[destination pubkey, token program id, nft_mint pubkey]`). |
| `atoken_progam`               |          |        | `spl-associate-token` program.                                                         |
| `owner_token_record`          |    ✅    |        | (optional) Owner token record account (pNFT).                                          |
| `destination_token_record`    |    ✅    |        | (optional) Freeze PDA token record account (pNFT).                                     |
| `authorization_rules_program` |          |        | (optional) Token Authorization Rules program (pNFT).                                   |
| `authorization_rules`         |          |        | (optional) Token Authorization Rules account (pNFT).                                   |

</details>

### `ProgramGate`

```rust
pub struct ProgramGate {
    pub additional: Vec<Pubkey>,
}
```

The `ProgramGate` guard restricts the programs that can be in a mint transaction. The guard allows the necessary programs for the mint and any other program specified in the configuration.

### `RedeemedAmount`

```rust
pub struct RedeemedAmount {
    pub maximum: u64,
}
```

The `RedeemedAmount` guard stops the mint when the number of `items_redeemed` of the Gumball Machine reaches the configured `maximum` amount.

### `SolPayment`

```rust
pub struct SolPayment {
    pub lamports: u64,
}
```

The `SolPayment` guard is used to charge an amount in SOL (`lamports`) for the mint. The `payment_mint` in the `GumballMachine` settings must be the native SOL mint (`spl_token::native_mint::id()`).

The specified `lamports` amount is transferred from the payer's account. If a marketplace fee is configured in the `GumballMachine` (version > 0), the fee is deducted from the `lamports` and transferred to the configured fee account. The remaining amount is then transferred to the Associated Token Account (ATA) owned by the `GumballMachine`'s derived authority PDA (`["gumball_authority", gumball_machine_key]`).

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                                                                                             |
| ----------------- | :------: | :----: | ----------------------------------------------------------------------------------------------------------------------- |
| `destination`     |    ✅    |        | The Gumball Machine authority PDA (`["gumball_authority", gumball_machine_key]`) where payment SOL (less fees) is sent. |
| `fee_destination` |    ✅    |        | (optional) The account for the marketplace fee, required if a fee is configured and `GumballMachine.version > 0`.       |

</details>

### `StartDate`

```rust
pub struct StartDate {
    pub date: i64,
}
```

The `StartDate` guard determines the start date of the mint. If this guard is not specified, mint is allowed &mdash; similar to say any date is valid.

### `ThirdPartySigner`

```rust
pub struct ThirdPartySigner {
    pub signer_key: Pubkey,
}
```

The `ThirdPartySigner` guard required an extra signer on the transaction.

<details>
  <summary>Accounts</summary>

| Name         | Writable | Signer | Description                |
| ------------ | :------: | :----: | -------------------------- |
| `signer_key` |          |   ✅   | Signer of the transaction. |

</details>

### `TokenBurn`

```rust
pub struct TokenBurn {
    pub amount: u64,
    pub mint: Pubkey,
}
```

The `TokenBurn` restrict the mint to holder of a specified spl-token and required the burn of the tokens. The `amount` determines how many tokens are required.

<details>
  <summary>Accounts</summary>

| Name            | Writable | Signer | Description                                |
| --------------- | :------: | :----: | ------------------------------------------ |
| `token_account` |    ✅    |        | Token account holding the required amount. |
| `token_mint`    |    ✅    |        | Token mint account.                        |

</details>

### `TokenGate`

```rust
pub struct TokenGate {
    pub amount: u64,
    pub mint: Pubkey,
}
```

The `TokenGate` restrict the mint to holder of a specified spl-token. The `amount` determines how many tokens are required.

<details>
  <summary>Accounts</summary>

| Name            | Writable | Signer | Description                               |
| --------------- | :------: | :----: | ----------------------------------------- |
| `token_account` |          |        | oken account holding the required amount. |

</details>

### `TokenPayment`

```rust
pub struct TokenPayment {
    pub amount: u64,
    pub mint: Pubkey,
}
```

The `TokenPayment` guard charges an amount in a specified spl-token as payment for the mint. The `mint` must match the `payment_mint` configured in the `GumballMachine` settings. The `amount` determines how many tokens are required from the payer.

The specified `amount` is transferred from the payer's token account. If a marketplace fee is configured in the `GumballMachine` (version > 0), the fee is deducted from the `amount` and transferred to the configured fee account. The remaining amount is then transferred to the Associated Token Account (ATA) owned by the `GumballMachine`'s derived authority PDA (`["gumball_authority", gumball_machine_key]`).

<details>
  <summary>Accounts</summary>

| Name                  | Writable | Signer | Description                                                                          |
| --------------------- | :------: | :----: | ------------------------------------------------------------------------------------ |
| `token_account`       |    ✅    |        | Payer's token account holding the required `amount` of the specified `mint`.         |
| `destination_ata`     |    ✅    |        | The ATA owned by the Gumball Machine authority PDA where payment tokens are sent.    |
| `fee_destination_ata` |    ✅    |        | (optional) The ATA for the marketplace fee account, required if a fee is configured. |

</details>
