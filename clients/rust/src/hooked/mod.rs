//! Hand-written runtime codecs for the two manually-serialized accounts whose
//! Codama-generated structs only cover the fixed base header. These mirror the
//! hand-written codecs in the js/umi clients' `src/hooked`.

mod gumball_guard;
mod gumball_machine;

pub use gumball_guard::*;
pub use gumball_machine::*;
