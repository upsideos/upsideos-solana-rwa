use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    token_metadata_initialize, Mint, Token2022, TokenMetadataInitialize
};

use crate::contexts::common::{DISCRIMINATOR_LEN, WalletRole, WALLET_ROLE_PREFIX};

pub const ACCESS_CONTROL_SEED: &[u8] = b"ac"; // access_control



#[account()]
#[derive(InitSpace)]
pub struct AccessControl {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub max_total_supply: u64,
    pub lockup_escrow_account: Option<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeAccessControlArgs {
    pub decimals: u8,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub hook_program_id: Pubkey,
    pub max_total_supply: u64,
}

#[derive(Accounts)]
#[instruction(args: InitializeAccessControlArgs)]
pub struct InitializeAccessControl<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account()]
    /// CHECK: can be any account which controls the mint metadata
    pub authority: UncheckedAccount<'info>,

    #[account(
      init,
      signer,
      payer = payer,
      mint::token_program = token_program,
      mint::decimals = args.decimals,
      mint::authority = access_control.key(),
      mint::freeze_authority = access_control.key(),
      extensions::transfer_hook::authority = authority,
      extensions::transfer_hook::program_id = args.hook_program_id,
      extensions::group_member_pointer::authority = access_control.key(),
      extensions::group_member_pointer::member_address = mint,
      extensions::group_pointer::authority = access_control.key(),
      extensions::group_pointer::group_address = mint,
      extensions::metadata_pointer::authority = access_control.key(),
      extensions::metadata_pointer::metadata_address = mint,
      extensions::permanent_delegate::delegate = access_control.key(),
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + AccessControl::INIT_SPACE,
      seeds = [
        ACCESS_CONTROL_SEED,
        mint.key().as_ref(),
      ],
      bump,
    )]
    pub access_control: Box<Account<'info, AccessControl>>,
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + WalletRole::INIT_SPACE,
      seeds = [
        WALLET_ROLE_PREFIX,
        &mint.key().to_bytes(),
        &payer.key().to_bytes(),
      ],
      bump,
    )]
    pub wallet_role: Account<'info, WalletRole>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

impl<'info> InitializeAccessControl<'info> {
    pub fn initialize_token_metadata(
        &self,
        program_id: &Pubkey,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        let cpi_accounts = TokenMetadataInitialize {
            program_id: self.token_program.to_account_info(),
            mint: self.mint.to_account_info(),
            metadata: self.mint.to_account_info(), // metadata account is the mint, since data is stored in mint
            mint_authority: self.access_control.to_account_info(),
            update_authority: self.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        let mint = self.mint.key();
        let (_pda, bump_seed) =
            Pubkey::find_program_address(&[ACCESS_CONTROL_SEED, mint.as_ref()], program_id);

        let seeds = &[ACCESS_CONTROL_SEED, mint.as_ref(), &[bump_seed]];

        token_metadata_initialize(cpi_ctx.with_signer(&[&seeds[..]]), name, symbol, uri)?;

        Ok(())
    }
}
