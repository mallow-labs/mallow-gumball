use anchor_lang::prelude::*;

use crate::guards::*;

/// IDL-only hint. This event is never emitted or constructed at runtime.
///
/// The gumball guard (de)serializes its guard configuration through opaque
/// `Vec<u8>` instruction arguments, so Anchor's IDL generator never encounters
/// the individual guard structs and omits them from the IDL. Referencing every
/// guard type here forces them into `idl.types`, so the generated JS client
/// (codama) renders their codecs — which the hand-written guard modules in
/// `clients/js/src/{guards,defaultGuards}` depend on.
#[event]
#[allow(dead_code)]
pub struct IdlHints {
    pub address_gate: AddressGate,
    pub allocation: Allocation,
    pub allocation_tracker: AllocationTracker,
    pub allow_list: AllowList,
    pub allow_list_proof: AllowListProof,
    pub bot_tax: BotTax,
    pub end_date: EndDate,
    pub gatekeeper: Gatekeeper,
    pub machine_type: MachineType,
    pub mint_counter: MintCounter,
    pub mint_limit: MintLimit,
    pub nft_burn: NftBurn,
    pub nft_gate: NftGate,
    pub nft_payment: NftPayment,
    pub program_gate: ProgramGate,
    pub redeemed_amount: RedeemedAmount,
    pub sol_payment: SolPayment,
    pub start_date: StartDate,
    pub third_party_signer: ThirdPartySigner,
    pub token2022_payment: Token2022Payment,
    pub token_burn: TokenBurn,
    pub token_gate: TokenGate,
    pub token_payment: TokenPayment,
}
