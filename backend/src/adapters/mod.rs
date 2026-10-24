//! Concrete adapters for external systems used by the backend.
//!
//! Domain handlers are being migrated incrementally into `application` use
//! cases and adapters. Keep new HTTP and persistence code in the submodules
//! here instead of adding infrastructure dependencies to domain rules.
pub mod inbound;
pub mod outbound;
