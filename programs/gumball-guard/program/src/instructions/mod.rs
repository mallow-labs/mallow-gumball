use crate::state::GumballGuard;
use anchor_lang::prelude::*;
pub use draw::*;
pub use draw_jellybean::*;
pub use initialize::*;
pub use route::*;
pub use set_authority::*;
pub use unwrap::*;
pub use update::*;
pub use withdraw::*;
pub use wrap::*;

pub mod draw;
pub mod draw_jellybean;
pub mod initialize;
pub mod route;
pub mod set_authority;
pub mod unwrap;
pub mod update;
pub mod withdraw;
pub mod wrap;

/// Accounts to mint an NFT.
pub(crate) struct DrawAccounts<'b, 'c, 'info> {
    pub(crate) gumball_guard: &'b Account<'info, GumballGuard>,
    pub(crate) machine: AccountInfo<'info>,
    pub(crate) payer: AccountInfo<'info>,
    pub(crate) buyer: AccountInfo<'info>,
    pub(crate) _machine_program: AccountInfo<'info>,
    pub(crate) spl_token_program: AccountInfo<'info>,
    pub(crate) system_program: AccountInfo<'info>,
    pub(crate) sysvar_instructions: AccountInfo<'info>,
    pub(crate) recent_slothashes: AccountInfo<'info>,
    pub(crate) remaining: &'c [AccountInfo<'info>],
    pub(crate) event_authority: AccountInfo<'info>,
    /// Only required for Gumball.
    pub(crate) token_metadata_program: Option<AccountInfo<'info>>,
    /// Only required for Jellybean.
    pub(crate) authority_pda: Option<AccountInfo<'info>>,
    pub(crate) unclaimed_prizes: Option<AccountInfo<'info>>,
    pub(crate) print_fee_account: Option<AccountInfo<'info>>,
    pub(crate) rent: Option<AccountInfo<'info>>,
}

#[derive(Debug, Clone)]
pub struct Token;

impl anchor_lang::Id for Token {
    fn id() -> Pubkey {
        anchor_spl::token::ID
    }
}

#[derive(Debug, Clone)]
pub struct AssociatedToken;

impl anchor_lang::Id for AssociatedToken {
    fn id() -> Pubkey {
        anchor_spl::associated_token::ID
    }
}
