use anchor_lang::prelude::*;
use num_enum::IntoPrimitive;

pub const DISCRIMINATOR_LEN: usize = 8;

pub const WALLET_ROLE_PREFIX: &[u8] = b"wallet_role";

#[repr(u8)]
#[derive(IntoPrimitive, AnchorDeserialize, AnchorSerialize, Clone, InitSpace, Copy, Debug)]
pub enum Roles {
    ContractAdmin = 1,  // 0001
    ReserveAdmin = 2,   // 0010
    WalletsAdmin = 4,    // 0100
    TransferAdmin = 8,  // 1000
    All = 15,           // 1000
}

pub const ADMIN_ROLES: u8 = Roles::ContractAdmin as u8
    | Roles::ReserveAdmin as u8
    | Roles::WalletsAdmin as u8
    | Roles::TransferAdmin as u8;

#[account]
#[derive(Default, InitSpace)]
pub struct WalletRole {
    pub owner: Pubkey,
    pub access_control: Pubkey,
    pub role: u8,
}

impl WalletRole {
    pub fn has_role(&self, role: Roles) -> bool {
      let role = role as u8;
      self.role & role == role
    }
  
    pub fn has_any_role(&self, roles: u8) -> bool {
      self.role & roles != 0
    }
  }
