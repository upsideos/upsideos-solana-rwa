use access_control::{
    program::AccessControl as AccessControlProgram, AccessControl, WalletRole,
};
#[cfg(not(test))]
use access_control::cpi::accounts::MintSecurities;
use anchor_lang::{
    prelude::*, Discriminator,
    solana_program::{program_memory::{sol_memcmp, sol_memcpy}, pubkey::PUBKEY_BYTES},
};
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};

use crate::error::TokenlockErrors;
use crate::{TOKENLOCK_PDA_SEED, utils};
use tokenlock_accounts::{
    states::{TimelockData, TokenLockData, Timelock},
    wrappers::TokenLockDataWrapper,
};

#[derive(Accounts)]
#[instruction(uuid: [u8; 16], amount: u64, commencement_timestamp: u64, schedule_id: u16, cancelable_by: Vec<Pubkey>)]
pub struct MintReleaseSchedule<'info> {
    /// CHECK: implemented own serialization in order to save compute units
    pub tokenlock_account: AccountInfo<'info>,

    #[account(mut,
        realloc = timelock_account.expected_new_size(
            timelock_account.to_account_info().data_len(),
            &cancelable_by
        ),
        realloc::payer = authority,
        realloc::zero = false,
        constraint = timelock_account.tokenlock_account == *tokenlock_account.key,
    )]
    pub timelock_account: Account<'info, TimelockData>,

    #[account(mut,
        token::mint = mint_address,
        token::token_program = token_program,
        constraint = escrow_account.owner == escrow_account_owner.key(),
    )]
    pub escrow_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [
            TOKENLOCK_PDA_SEED,
            mint_address.key().as_ref(), 
            tokenlock_account.key().as_ref()
        ],
        bump
    )]
    /// CHECK: PDA which controls escrow account
    pub escrow_account_owner: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = authority_wallet_role.owner == authority.key(),
        constraint = authority_wallet_role.access_control == access_control.key(),
        owner = AccessControlProgram::id(),
    )]
    pub authority_wallet_role: Account<'info, WalletRole>,

    #[account(
        constraint = access_control.mint == mint_address.key(),
        owner = AccessControlProgram::id(),
    )]
    pub access_control: Account<'info, AccessControl>,

    #[account(mut,
        mint::token_program = token_program,
        constraint = mint_address.key() == access_control.mint,
    )]
    pub mint_address: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        constraint = *to.key == timelock_account.target_account,
    )]
    /// CHECK: System Account which identify target user wallet
    /// with which will be linked timelocks
    pub to: AccountInfo<'info>,

    pub token_program: Program<'info, Token2022>,

    pub access_control_program: Program<'info, AccessControlProgram>,

    pub system_program: Program<'info, System>,
}

pub fn mint_release_schedule<'info>(
    ctx: Context<'_, '_, '_, 'info, MintReleaseSchedule<'info>>,
    uuid: [u8; 16],
    amount: u64,
    commencement_timestamp: u64,
    schedule_id: u16,
    cancelable_by: Vec<Pubkey>,
) -> Result<()> {
    let tokenlock_account = &ctx.accounts.tokenlock_account;
    let tokenlock_account_data = tokenlock_account.try_borrow_data()?;
    let discriminator = TokenLockData::DISCRIMINATOR;
    if sol_memcmp(&discriminator, &tokenlock_account_data, discriminator.len()) != 0 {
        return Err(TokenlockErrors::IncorrectTokenlockAccount.into());
    }

    if !ctx.accounts.authority_wallet_role.has_role(access_control::Roles::ReserveAdmin) {
        return Err(TokenlockErrors::Unauthorized.into());
    }

    if ctx.accounts.access_control.key()
        != TokenLockDataWrapper::access_control(&tokenlock_account_data)
    {
        return Err(TokenlockErrors::InvalidAccessControlAccount.into());
    }

    let mint_address = TokenLockDataWrapper::mint_address(&tokenlock_account_data);
    let escrow_account = TokenLockDataWrapper::escrow_account(&tokenlock_account_data);
    //constraint
    if mint_address != ctx.accounts.mint_address.key() {
        return Err(TokenlockErrors::MisMatchedToken.into());
    }
    if escrow_account != *ctx.accounts.escrow_account.to_account_info().key {
        return Err(TokenlockErrors::MisMatchedEscrow.into());
    }

    //check param
    let now_ts = utils::get_unix_timestamp();
    if cancelable_by.len() > Timelock::CANCELABLE_BY_COUNT_MAX as usize {
        return Err(TokenlockErrors::Max10CancelableAddresses.into());
    }

    //check params
    if amount < TokenLockDataWrapper::min_timelock_amount(&tokenlock_account_data) {
        return Err(TokenlockErrors::AmountLessThanMinMintingAmount.into());
    }

    if schedule_id >= TokenLockDataWrapper::schedule_count(&tokenlock_account_data) {
        return Err(TokenlockErrors::InvalidScheduleId.into());
    }

    let schedule =
        TokenLockDataWrapper::get_schedule(&tokenlock_account_data, schedule_id).unwrap();
    if amount < (schedule.release_count as u64) {
        return Err(TokenlockErrors::PerReleaseTokenLessThanOne.into());
    }

    let max_delay: u64 = TokenLockDataWrapper::max_release_delay(&tokenlock_account_data);
    let commencement_ts = commencement_timestamp;
    let max_allowed_timestamp = now_ts.checked_add(max_delay).unwrap();
    if commencement_ts > max_allowed_timestamp {
        return Err(TokenlockErrors::CommencementTimeoutOfRange.into());
    }
    let first_release_ts =
        commencement_ts.checked_add(schedule.delay_until_first_release_in_seconds);
    if first_release_ts.is_none() || first_release_ts.unwrap() > max_allowed_timestamp {
        return Err(TokenlockErrors::InitialReleaseTimeoutOfRange.into());
    }

    //check cancelable duplicating
    for i in 0..cancelable_by.len() {
        for j in i + 1..cancelable_by.len() {
            if cancelable_by[i] == cancelable_by[j] {
                return Err(TokenlockErrors::DuplicatedCancelable.into());
            }
        }
    }

    let hash = utils::calc_signer_hash(ctx.accounts.authority.key, uuid);
    let mut timelock = Timelock {
        schedule_id,
        commencement_timestamp: commencement_ts,
        tokens_transferred: 0,
        total_amount: amount,
        cancelable_by_count: cancelable_by.len() as u8,
        cancelable_by: [0; 10],
        signer_hash: hash,
    };

    let timelock_account = &mut ctx.accounts.timelock_account;
    if timelock_account.is_duplicated_timelock(&timelock) == true {
        return Err(TokenlockErrors::HashAlreadyExists.into());
    }

    //check cancelables
    let mut cancelable_by_indexes: Vec<u8> = vec![];
    let mut cancelable_by_new_count: u8 = 0;
    for pubkey in &cancelable_by {
        let idx = timelock_account.get_cancelable_index(pubkey);
        if idx.is_none() {
            match (timelock_account.cancelables.len() as u8).checked_add(cancelable_by_new_count) {
                None => return Err(TokenlockErrors::CancelablesCountReachedMax.into()),
                Some(cancelable_by_idx_new) => {
                    cancelable_by_indexes.push(cancelable_by_idx_new);
                    cancelable_by_new_count = cancelable_by_new_count.checked_add(1).unwrap();
                }
            }
        } else {
            cancelable_by_indexes.push(idx.unwrap());
        }
    }

    //check total cancelables count
    let cancelable_by_new_len = timelock_account
        .cancelables
        .len()
        .checked_add(cancelable_by_new_count as usize);
    if cancelable_by_new_len.is_none()
        || cancelable_by_new_len.unwrap() > Timelock::MAX_CANCELABLES_COUNT
    {
        return Err(TokenlockErrors::CancelablesCountReachedMax.into());
    }

    let need_space = (cancelable_by_new_count as usize)
        .checked_mul(PUBKEY_BYTES)
        .unwrap()
        .checked_add(Timelock::DEFAULT_SIZE)
        .unwrap();
    let free_space = timelock_account.space(timelock_account.to_account_info().data_len());
    if free_space.is_none() || free_space.unwrap() < need_space {
        return Err(TokenlockErrors::InsufficientDataSpace.into());
    }

    mint_securities_cpi(
        &ctx.accounts.authority_wallet_role,
        &ctx.accounts.authority,
        &ctx.accounts.access_control,
        &ctx.accounts.mint_address,
        &ctx.accounts.escrow_account,
        &ctx.accounts.escrow_account_owner,
        &ctx.accounts.token_program,
        &ctx.accounts.access_control_program,
        amount,
    )?;

    //add new cancelables
    for i in 0..cancelable_by_indexes.len() {
        if cancelable_by_indexes[i] >= (timelock_account.cancelables.len()) as u8 {
            timelock_account.cancelables.push(cancelable_by[i]);
        }
    }
    sol_memcpy(
        &mut timelock.cancelable_by,
        &cancelable_by_indexes,
        cancelable_by_indexes.len(),
    );

    timelock_account.timelocks.push(timelock);

    Ok(())
}

/// Helper function to handle mint_securities CPI with conditional compilation
/// In production: calls the actual CPI
/// In tests: mocks the behavior by updating escrow account balance
#[allow(unused_variables)]
fn mint_securities_cpi<'info>(
    authority_wallet_role: &Account<'info, WalletRole>,
    authority: &Signer<'info>,
    access_control: &Account<'info, AccessControl>,
    mint_address: &Box<InterfaceAccount<'info, Mint>>,
    escrow_account: &Box<InterfaceAccount<'info, TokenAccount>>,
    escrow_account_owner: &AccountInfo<'info>,
    token_program: &Program<'info, Token2022>,
    access_control_program: &Program<'info, AccessControlProgram>,
    amount: u64,
) -> Result<()> {
    #[cfg(not(test))]
    {
        let cpi_accounts = MintSecurities {
            authority_wallet_role: authority_wallet_role.to_account_info(),
            authority: authority.to_account_info(),
            access_control: access_control.to_account_info(),
            security_mint: mint_address.to_account_info(),
            destination_account: escrow_account.to_account_info(),
            destination_authority: escrow_account_owner.to_account_info(),
            token_program: token_program.to_account_info(),
        };

        access_control::cpi::mint_securities(
            CpiContext::new(
                access_control_program.to_account_info(),
                cpi_accounts,
            ),
            amount,
        )?;
    }

    #[cfg(test)]
    {
        // Mock implementation for tests - update escrow balance manually
        msg!("Mock mint_securities CPI in test mode");
        use anchor_lang::solana_program::program_pack::Pack;
        use spl_token_2022::state::Account as TokenAccount;

        let escrow_info = escrow_account.to_account_info();
        let mut escrow_data = escrow_info.try_borrow_mut_data()?;
        let mut escrow_token_account = TokenAccount::unpack(&escrow_data)?;
        escrow_token_account.amount = escrow_token_account
            .amount
            .checked_add(amount)
            .expect("Overflow in test mock - amount too large");
        TokenAccount::pack(escrow_token_account, &mut escrow_data)?;
    }

    Ok(())
}
