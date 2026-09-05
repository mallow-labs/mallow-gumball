use anchor_lang::prelude::*;

use crate::state::{ConfigLine, ConfigLineInput, ConfigLineV2, ConfigLineV2Input};

/// IDL-only hint. This event is never emitted or constructed at runtime.
///
/// The gumball machine account is variable-size and manually (de)serialized, so
/// Anchor's IDL generator never encounters the config-line structs and omits
/// them from the IDL. Referencing them here forces them into `idl.types`, so the
/// generated JS client (codama) renders their codecs — which the hand-written
/// `clients/js/src/hooked/gumballMachineAccountData.ts` decoder depends on.
#[event]
#[allow(dead_code)]
pub struct IdlHints {
    pub config_line: ConfigLine,
    pub config_line_input: ConfigLineInput,
    pub config_line_v2: ConfigLineV2,
    pub config_line_v2_input: ConfigLineV2Input,
}
