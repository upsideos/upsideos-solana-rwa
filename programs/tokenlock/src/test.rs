use super::*;
use access_control::{AccessControl, Roles, WalletRole};
use anchor_lang::{solana_program::pubkey::PUBKEY_BYTES, Discriminator};
use core::result::Result;
use solana_sdk::{
    account::{create_account_for_test, Account as SolanaAccount},
    account_info::IntoAccountInfo,
    program_memory::sol_memcpy,
    program_pack::Pack,
    system_program,
    sysvar::SysvarId,
};
use spl_token_2022::state::{Account as TokenAccount, Mint};
use std::str::FromStr;
use tokenlock_accounts::states::{Timelock, TimelockData, TokenLockData};
use transfer_restrictions::{SecurityAssociatedAccount, TransferRestrictionData, TransferRule};
const TOKENLOCK_SIZE: usize = 10 * 1024 * 1024;

struct TestFixture {
    program_id: Pubkey,
    tokenlock_account: (Pubkey, SolanaAccount),
    timelock_account: (Pubkey, SolanaAccount),
    transfer_restrictions_data: (Pubkey, SolanaAccount),
    transfer_restrictions_program: (Pubkey, SolanaAccount),
    authority_account: (Pubkey, SolanaAccount),
    security_associated_account_from: (Pubkey, SolanaAccount),
    security_associated_account_to: (Pubkey, SolanaAccount),
    transfer_rule: (Pubkey, SolanaAccount),
    authority_wallet_role: (Pubkey, SolanaAccount),
    access_control: (Pubkey, SolanaAccount),
    access_control_program: (Pubkey, SolanaAccount),
    authority: (Pubkey, SolanaAccount),
    escrow_account: (Pubkey, SolanaAccount),
    mint_address: (Pubkey, SolanaAccount),
    target_account: (Pubkey, SolanaAccount),
    to: (Pubkey, SolanaAccount),
    pda_account: (Pubkey, SolanaAccount),
    target: (Pubkey, SolanaAccount),
    reclaimer: (Pubkey, SolanaAccount),
    target_assoc: (Pubkey, SolanaAccount),
    token_program: (Pubkey, SolanaAccount),
    system_program: (Pubkey, SolanaAccount),
    rent: (Pubkey, SolanaAccount),
}

impl Default for TestFixture {
    fn default() -> Self {
        let program_id = Pubkey::from_str("7CN3iHcRimZRa97M38cyMQAF68ecQYDqHfCUgBeSARG2").unwrap();
        let access_control_program_id = access_control::ID;
        let key = Pubkey::from_str("11111111111111111111111111111111").unwrap();

        let tokenlock_address = Pubkey::new_unique();
        let mint_address = key;
        let mut mint_acc = SolanaAccount::new(
            Self::min_balance(Mint::LEN),
            Mint::LEN,
            &anchor_spl::token_2022::ID,
        );
        Self::pack_mint(&mut mint_acc.data, 0, None).expect("Mint pack Error");

        let (pda, _) = Pubkey::find_program_address(
            &[
                TOKENLOCK_PDA_SEED,
                mint_address.as_ref(),
                tokenlock_address.as_ref(),
            ],
            &program_id,
        );

        let mut escrow_account_acc = SolanaAccount::new(
            Self::min_balance(TokenAccount::LEN),
            TokenAccount::LEN,
            &anchor_spl::token_2022::ID,
        );
        TokenAccount::pack(
            TokenAccount {
                state: spl_token_2022::state::AccountState::Initialized,
                amount: 0,
                owner: pda,
                ..Default::default()
            },
            &mut escrow_account_acc.data,
        )
        .unwrap();

        let mut from = SolanaAccount::new(
            Self::min_balance(TokenAccount::LEN),
            TokenAccount::LEN,
            &anchor_spl::token_2022::ID,
        );
        Self::pack_token_account(&mut from.data, 0).expect("From address pack Error");

        let mut to = SolanaAccount::new(
            Self::min_balance(TokenAccount::LEN),
            TokenAccount::LEN,
            &anchor_spl::token_2022::ID,
        );
        Self::pack_token_account(&mut to.data, 0).expect("To address pack Error");

        let mut reclaimer = SolanaAccount::new(
            Self::min_balance(TokenAccount::LEN),
            TokenAccount::LEN,
            &anchor_spl::token_2022::ID,
        );
        Self::pack_token_account(&mut reclaimer.data, 0)
            .expect("Reclaimer token wallet pack Error");

        let mut target_assoc = SolanaAccount::new(
            Self::min_balance(TokenAccount::LEN),
            TokenAccount::LEN,
            &anchor_spl::token_2022::ID,
        );
        Self::pack_token_account(&mut target_assoc.data, 0)
            .expect("Target token wallet pack Error");

        let mut token_program_account = SolanaAccount::default();
        token_program_account.executable = true;

        let mut system_program_account = SolanaAccount::default();
        system_program_account.executable = true;

        let mut transfer_restrictions_program_account = SolanaAccount::default();
        transfer_restrictions_program_account.executable = true;

        let mut access_control_program_account = SolanaAccount::default();
        access_control_program_account.executable = true;

        let access_control_address = Pubkey::new_unique();

        let authority_address = Pubkey::new_unique();
        let mut authority_account_acc = SolanaAccount::new(
            Self::min_balance(TokenAccount::LEN),
            TokenAccount::LEN,
            &anchor_spl::token_2022::ID,
        );
        TokenAccount::pack(
            TokenAccount {
                state: spl_token_2022::state::AccountState::Initialized,
                amount: 0,
                owner: authority_address,
                ..Default::default()
            },
            &mut authority_account_acc.data,
        )
        .unwrap();
        let transfer_restrictions_data_address = Pubkey::new_unique();

        Self {
            program_id,

            tokenlock_account: Self::create_tokenlock_account(
                &tokenlock_address,
                &program_id,
                &key,
                &access_control_address,
                &transfer_restrictions_data_address,
            ),
            timelock_account: (
                Pubkey::new_unique(),
                SolanaAccount::new(Self::min_balance(10240), 10240, &program_id),
            ),
            transfer_restrictions_data: Self::create_transfer_restrictions_data(
                &transfer_restrictions_data_address,
                &transfer_restrictions::ID,
            ),

            transfer_restrictions_program: (
                transfer_restrictions::ID,
                transfer_restrictions_program_account,
            ),
            authority_account: (Pubkey::new_unique(), authority_account_acc),
            security_associated_account_from: Self::create_security_associated_account(
                &Pubkey::new_unique(),
                &transfer_restrictions::ID,
            ),
            security_associated_account_to: Self::create_security_associated_account(
                &Pubkey::new_unique(),
                &transfer_restrictions::ID,
            ),
            transfer_rule: Self::create_transfer_rule_account(
                &Pubkey::new_unique(),
                &transfer_restrictions::ID,
            ),

            access_control: Self::create_access_control_account(
                &access_control_address,
                &access_control_program_id,
            ),
            access_control_program: (access_control_program_id, access_control_program_account),
            authority_wallet_role: Self::create_wallet_role_account(
                &Pubkey::new_unique(),
                &access_control_program_id,
            ),
            authority: (authority_address.clone(), SolanaAccount::default()),
            escrow_account: (key.clone(), escrow_account_acc),
            mint_address: (mint_address, mint_acc),
            target_account: (Pubkey::new_unique(), SolanaAccount::default()),
            to: (Pubkey::new_unique(), to),
            pda_account: (Pubkey::new_unique(), SolanaAccount::default()),
            target: (Pubkey::new_unique(), SolanaAccount::default()),
            reclaimer: (Pubkey::new_unique(), reclaimer),
            target_assoc: (Pubkey::new_unique(), target_assoc),

            token_program: (spl_token_2022::id(), token_program_account),
            system_program: (system_program::id(), system_program_account),
            rent: (Rent::id(), create_account_for_test(&Rent::default())),
        }
    }
}

impl<'a> TestFixture {
    fn initialize_tokenlock(
        tokenlock_account_info: &'a AccountInfo<'a>,
        escrow_account_info: &'a AccountInfo<'a>,
        mint_info: &'a AccountInfo<'a>,
        authority_wallet_role_info: &'a AccountInfo<'a>,
        access_control_info: &'a AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        token_program_info: &'a AccountInfo<'a>,
        transfer_restrictions_data_info: &'a AccountInfo<'a>,
    ) -> Result<InitializeTokenLock<'a>, ProgramError> {
        authority_info.is_signer = true;
        let escrow_account = Box::new(InterfaceAccount::try_from(escrow_account_info)?);
        let mint_address = Box::new(InterfaceAccount::try_from(mint_info)?);

        Ok(InitializeTokenLock {
            tokenlock_account: Account::try_from_unchecked(tokenlock_account_info)?,
            escrow_account,
            mint_address,
            authority_wallet_role: Account::try_from_unchecked(authority_wallet_role_info)?,
            access_control: Account::try_from_unchecked(access_control_info)?,
            authority: Signer::try_from(authority_info)?,
            token_program: Program::try_from(token_program_info)?,
            transfer_restrictions_data: Account::try_from_unchecked(
                transfer_restrictions_data_info,
            )?,
        })
    }

    fn initialize_timelock(
        tokenlock_account_info: AccountInfo<'a>,
        timelock_account_info: &'a AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        authority_wallet_role_info: &'a AccountInfo<'a>,
        access_control_info: &'a AccountInfo<'a>,
        target_account_info: AccountInfo<'a>,
        system_program_info: &'a AccountInfo<'a>,
        rent_info: &'a AccountInfo<'a>,
    ) -> Result<InitializeTimeLock<'a>, ProgramError> {
        authority_info.is_signer = true;
        let mut authority_wallet_role: Account<'a, WalletRole> =
            Account::try_from_unchecked(authority_wallet_role_info).unwrap();
        authority_wallet_role.role = Roles::ReserveAdmin as u8;

        Ok(InitializeTimeLock {
            tokenlock_account: tokenlock_account_info,
            timelock_account: Account::try_from_unchecked(timelock_account_info)?,
            authority: Signer::try_from(authority_info).unwrap(),
            payer: Signer::try_from(authority_info).unwrap(),
            access_control: Account::try_from_unchecked(access_control_info).unwrap(),
            authority_wallet_role,
            target_account: target_account_info,
            system_program: Program::try_from(system_program_info)?,
            rent: Sysvar::from_account_info(rent_info)?,
        })
    }

    fn create_release_schedule(
        tokenlock_account_info: AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        authority_wallet_role_info: &'a AccountInfo<'a>,
        access_control_info: &'a AccountInfo<'a>,
    ) -> Result<ManagementTokenlock<'a>, ProgramError> {
        authority_info.is_signer = true;
        let mut authority_wallet_role: Account<'a, WalletRole> =
            Account::try_from_unchecked(authority_wallet_role_info).unwrap();
        authority_wallet_role.role = Roles::ReserveAdmin as u8;

        Ok(ManagementTokenlock {
            tokenlock_account: tokenlock_account_info,
            authority: Signer::try_from(authority_info)?,
            authority_wallet_role,
            access_control: Account::try_from_unchecked(access_control_info)?,
        })
    }

    fn mint_release_schedule(
        escrow_account_info: &'a AccountInfo<'a>,
        tokenlock_account_info: &'a AccountInfo<'a>,
        timelock_account_info: &'a AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        authority_wallet_role_info: &'a AccountInfo<'a>,
        access_control_info: &'a AccountInfo<'a>,
        mint_info: &'a AccountInfo<'a>,
        to_account_info: AccountInfo<'a>,
        token_program_info: &'a AccountInfo<'a>,
        access_control_program_info: &'a AccountInfo<'a>,
        pda_account_info: AccountInfo<'a>,
        system_program_info: &'a AccountInfo<'a>,
    ) -> Result<MintReleaseSchedule<'a>, ProgramError> {
        let escrow_account = InterfaceAccount::try_from(escrow_account_info)?;
        let mut tokenlock_data: Account<TokenLockData> =
            Account::try_from_unchecked(tokenlock_account_info).unwrap();
        tokenlock_data.escrow_account = escrow_account_info.key();
        authority_info.is_signer = true;
        let mut authority_wallet_role: Account<'a, WalletRole> =
            Account::try_from_unchecked(authority_wallet_role_info).unwrap();
        authority_wallet_role.role = Roles::ReserveAdmin as u8;
        let mint_address = Box::new(InterfaceAccount::try_from(mint_info)?);

        Ok(MintReleaseSchedule {
            tokenlock_account: tokenlock_data.to_account_info(),
            timelock_account: Account::try_from_unchecked(&timelock_account_info).unwrap(),
            authority: Signer::try_from(authority_info)?,
            authority_wallet_role,
            access_control: Account::try_from_unchecked(access_control_info)?,
            mint_address,
            escrow_account: Box::new(escrow_account),
            to: to_account_info,
            token_program: Program::try_from(token_program_info)?,
            access_control_program: Program::try_from(access_control_program_info)?,
            escrow_account_owner: pda_account_info,
            payer: Signer::try_from(authority_info)?,
            system_program: Program::try_from(system_program_info)?,
        })
    }

    fn transfer(
        escrow_account_info: &'a AccountInfo<'a>,
        tokenlock_account_info: AccountInfo<'a>,
        timelock_account_info: &'a AccountInfo<'a>,
        pda_account_info: AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        to_info: &'a AccountInfo<'a>,
        mint_info: &'a AccountInfo<'a>,
        token_program_info: &'a AccountInfo<'a>,
        transfer_restrictions_program_info: &'a AccountInfo<'a>,
        authority_account_info: AccountInfo<'a>,
        security_associated_account_from_info: &'a AccountInfo<'a>,
        security_associated_account_to_info: &'a AccountInfo<'a>,
        transfer_rule_info: &'a AccountInfo<'a>,
    ) -> Result<TransferFrom<'a>, ProgramError> {
        let escrow_account = InterfaceAccount::try_from(&escrow_account_info)?;
        authority_info.is_signer = true;

        let transfer_restrictions_program =
            Program::try_from(transfer_restrictions_program_info).unwrap();

        Ok(TransferFrom {
            tokenlock_account: tokenlock_account_info,
            timelock_account: Account::try_from_unchecked(&timelock_account_info).unwrap(),
            escrow_account: Box::new(escrow_account),
            pda_account: pda_account_info,
            authority: Signer::try_from(authority_info)?,
            to: Box::new(InterfaceAccount::try_from(&to_info)?),
            mint_address: Box::new(InterfaceAccount::try_from(mint_info)?),
            token_program: Program::try_from(token_program_info)?,
            transfer_restrictions_program,
            authority_account: authority_account_info,
            security_associated_account_from: UncheckedAccount::try_from(
                security_associated_account_from_info,
            ),
            security_associated_account_to: UncheckedAccount::try_from(
                security_associated_account_to_info,
            ),
            transfer_rule: UncheckedAccount::try_from(transfer_rule_info),
        })
    }

    fn transfer_timelock(
        escrow_account_info: &'a AccountInfo<'a>,
        tokenlock_account_info: &'a AccountInfo<'a>,
        timelock_account_info: &'a AccountInfo<'a>,
        pda_account_info: AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        to_info: &'a AccountInfo<'a>,
        mint_info: &'a AccountInfo<'a>,
        token_program_info: &'a AccountInfo<'a>,
        transfer_restrictions_program_info: &'a AccountInfo<'a>,
        authority_account_info: AccountInfo<'a>,
        security_associated_account_from_info: &'a AccountInfo<'a>,
        security_associated_account_to_info: &'a AccountInfo<'a>,
        transfer_rule_info: &'a AccountInfo<'a>,
    ) -> Result<TransferTimelock<'a>, ProgramError> {
        let escrow_account = InterfaceAccount::try_from(&escrow_account_info)?;

        let mut tokenlock_data: Account<TokenLockData> =
            Account::try_from_unchecked(&tokenlock_account_info).unwrap();
        tokenlock_data.escrow_account = escrow_account_info.key();
        let timelock_data: Account<TimelockData> =
            Account::try_from_unchecked(&timelock_account_info).unwrap();

        authority_info.is_signer = true;

        Ok(TransferTimelock {
            tokenlock_account: tokenlock_data.to_account_info(),
            timelock_account: timelock_data,
            escrow_account: Box::new(escrow_account),
            pda_account: pda_account_info,
            authority: Signer::try_from(authority_info)?,
            to: Box::new(InterfaceAccount::try_from(&to_info)?),
            mint_address: Box::new(InterfaceAccount::try_from(mint_info)?),
            token_program: Program::try_from(token_program_info)?,
            transfer_restrictions_program: Program::try_from(transfer_restrictions_program_info)?,
            authority_account: authority_account_info,
            security_associated_account_from: UncheckedAccount::try_from(
                security_associated_account_from_info,
            ),
            security_associated_account_to: UncheckedAccount::try_from(
                security_associated_account_to_info,
            ),
            transfer_rule: UncheckedAccount::try_from(transfer_rule_info),
        })
    }

    fn cancel_timelock(
        escrow_account_info: &'a AccountInfo<'a>,
        tokenlock_account_info: &'a AccountInfo<'a>,
        timelock_account_info: &'a AccountInfo<'a>,
        target_info: AccountInfo<'a>,
        pda_account_info: AccountInfo<'a>,
        authority_info: &'a mut AccountInfo<'a>,
        reclaimer_info: &'a AccountInfo<'a>,
        target_assoc_info: &'a AccountInfo<'a>,
        mint_info: &'a AccountInfo<'a>,
        token_program_info: &'a AccountInfo<'a>,
        transfer_restrictions_program_info: &'a AccountInfo<'a>,
        security_associated_account_from_info: &'a AccountInfo<'a>,
        security_associated_account_to_info: &'a AccountInfo<'a>,
        transfer_rule_info: &'a AccountInfo<'a>,
    ) -> Result<CancelTimelock<'a>, ProgramError> {
        let escrow_account = InterfaceAccount::try_from(&escrow_account_info)?;
        let mut tokenlock_data: Account<TokenLockData> =
            Account::try_from_unchecked(&tokenlock_account_info).unwrap();
        tokenlock_data.escrow_account = escrow_account_info.key();
        authority_info.is_signer = true;

        Ok(CancelTimelock {
            tokenlock_account: tokenlock_data.to_account_info(),
            timelock_account: Account::try_from_unchecked(&timelock_account_info).unwrap(),
            escrow_account: Box::new(escrow_account),
            pda_account: pda_account_info,
            authority: Signer::try_from(authority_info)?,
            target: target_info,
            reclaimer: Box::new(InterfaceAccount::try_from(&reclaimer_info)?),
            target_assoc: Box::new(InterfaceAccount::try_from(&target_assoc_info)?),
            mint_address: Box::new(InterfaceAccount::try_from(mint_info)?),
            token_program: Program::try_from(token_program_info)?,
            transfer_restrictions_program: Program::try_from(transfer_restrictions_program_info)?,
            security_associated_account_from: UncheckedAccount::try_from(
                security_associated_account_from_info,
            ),
            security_associated_account_to: UncheckedAccount::try_from(
                security_associated_account_to_info,
            ),
            transfer_rule: UncheckedAccount::try_from(transfer_rule_info),
        })
    }
}

const UUID: [u8; 16] = [
    255, 106, 152, 202, 209, 154, 215, 13, 87, 90, 148, 51, 113, 141, 3, 157,
];

impl TestFixture {
    fn min_balance(size: usize) -> u64 {
        Rent::default().minimum_balance(size)
    }

    fn pack_mint(data: &mut [u8], supply: u64, decimals: Option<u8>) -> Result<(), ProgramError> {
        Mint::pack(
            Mint {
                is_initialized: true,
                supply: supply,
                decimals: decimals.unwrap_or(6),
                ..Default::default()
            },
            data,
        )
    }

    fn create_account(
        address: &Pubkey,
        program_id: &Pubkey,
        discriminator: &[u8],
        size: usize,
    ) -> (Pubkey, SolanaAccount) {
        let sol_account = SolanaAccount::new(Self::min_balance(size), size, &program_id);
        let mut account: (Pubkey, SolanaAccount) = (*address, sol_account);
        {
            let account_info = account.into_account_info();
            let mut account_data = account_info.try_borrow_mut_data().unwrap();
            sol_memcpy(&mut account_data, &discriminator, discriminator.len());
        }
        account
    }

    fn create_tokenlock_account(
        tokenlock_address: &Pubkey,
        program_id: &Pubkey,
        escrow_account_address: &Pubkey,
        access_control_address: &Pubkey,
        transfer_restrictions_address: &Pubkey,
    ) -> (Pubkey, SolanaAccount) {
        let discriminator = TokenLockData::DISCRIMINATOR;
        let mut account = Self::create_account(
            tokenlock_address,
            program_id,
            &discriminator,
            TOKENLOCK_SIZE,
        );
        {
            let account_info = account.into_account_info();
            let mut account_data = account_info.try_borrow_mut_data().unwrap();
            sol_memcpy(
                &mut account_data[discriminator.len()..],
                &access_control_address.to_bytes(),
                PUBKEY_BYTES,
            );
            sol_memcpy(
                &mut account_data[TokenLockData::ESCROW_ACCOUNT_OFFSET..],
                &escrow_account_address.to_bytes(),
                PUBKEY_BYTES,
            );
            sol_memcpy(
                &mut account_data[TokenLockData::TRANSFER_RESTRICTIONS_DATA_OFFSET..],
                &transfer_restrictions_address.to_bytes(),
                PUBKEY_BYTES,
            );
        }

        account
    }

    fn create_transfer_restrictions_data(
        transfer_restrictions_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, SolanaAccount) {
        let discriminator = TransferRestrictionData::DISCRIMINATOR;
        Self::create_account(
            transfer_restrictions_address,
            program_id,
            &discriminator,
            8 + TransferRestrictionData::INIT_SPACE,
        )
    }

    fn create_security_associated_account(
        security_associated_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, SolanaAccount) {
        let discriminator = SecurityAssociatedAccount::DISCRIMINATOR;
        Self::create_account(
            security_associated_address,
            program_id,
            &discriminator,
            8 + SecurityAssociatedAccount::INIT_SPACE,
        )
    }

    fn create_transfer_rule_account(
        transfer_rule_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, SolanaAccount) {
        let discriminator = TransferRule::DISCRIMINATOR;
        Self::create_account(
            transfer_rule_address,
            program_id,
            &discriminator,
            8 + TransferRule::INIT_SPACE,
        )
    }

    fn create_access_control_account(
        access_control_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, SolanaAccount) {
        let discriminator = AccessControl::DISCRIMINATOR;
        Self::create_account(
            access_control_address,
            program_id,
            &discriminator,
            8 + AccessControl::INIT_SPACE,
        )
    }

    fn create_wallet_role_account(
        wallet_role_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, SolanaAccount) {
        let discriminator = WalletRole::DISCRIMINATOR;
        Self::create_account(
            wallet_role_address,
            program_id,
            &discriminator,
            8 + WalletRole::INIT_SPACE,
        )
    }

    fn pack_token_account(data: &mut Vec<u8>, amount: u64) -> Result<(), ProgramError> {
        TokenAccount::pack(
            TokenAccount {
                state: spl_token_2022::state::AccountState::Initialized,
                amount: amount,
                ..Default::default()
            },
            data,
        )
    }
}

fn match_anchor_err(lh: Error, error_code: u32) -> () {
    match lh {
        Error::AnchorError(ae) => assert_eq!(ae.error_code_number, error_code),
        Error::ProgramError(pe) => panic!(
            "ProgramError {} received but expected Anchor error {}",
            pe, error_code
        ),
    }
}

#[test]
fn test_initialize_tokenlock() {
    let mut fixture = TestFixture::default();
    let program_id = fixture.program_id;

    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let mint_info = fixture.mint_address.into_account_info();
    let escrow_account_info = fixture.escrow_account.into_account_info();
    let token_program_info = fixture.token_program.into_account_info();
    let authority_wallet_role_info = fixture.authority_wallet_role.into_account_info();
    let access_control_info = fixture.access_control.into_account_info();
    let transfer_restrictions_data_info = fixture.transfer_restrictions_data.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let mut accounts = TestFixture::initialize_tokenlock(
        &tokenlock_account_info,
        &escrow_account_info,
        &mint_info,
        &authority_wallet_role_info,
        &access_control_info,
        &mut authority_info,
        &token_program_info,
        &transfer_restrictions_data_info,
    )
    .expect("Getting accounts error");

    let bumps = InitializeTokenLockBumps::default();
    let ctx: Context<InitializeTokenLock> = Context::new(&program_id, &mut accounts, &[], bumps);
    let max_release_delay = 3600;
    let min_timelock_amount = 10000;
    assert_eq!(
        tokenlock::initialize_tokenlock(ctx, max_release_delay, min_timelock_amount).is_ok(),
        true
    );
    assert_eq!(
        accounts.tokenlock_account.max_release_delay,
        max_release_delay,
    );
    assert_eq!(
        accounts.tokenlock_account.min_timelock_amount,
        min_timelock_amount,
    );
    assert_eq!(
        accounts.tokenlock_account.mint_address,
        accounts.mint_address.key()
    );
    assert_eq!(
        accounts.tokenlock_account.escrow_account,
        accounts.escrow_account.key()
    );

    let bumps = InitializeTokenLockBumps::default();
    let ctx: Context<InitializeTokenLock> = Context::new(&program_id, &mut accounts, &[], bumps);
    let max_release_delay = 0;
    match_anchor_err(
        tokenlock::initialize_tokenlock(ctx, max_release_delay, min_timelock_amount).unwrap_err(),
        6001,
    );

    let bumps = InitializeTokenLockBumps::default();
    let ctx: Context<InitializeTokenLock> = Context::new(&program_id, &mut accounts, &[], bumps);
    let max_release_delay = 3600;
    let min_timelock_amount = 0;
    match_anchor_err(
        tokenlock::initialize_tokenlock(ctx, max_release_delay, min_timelock_amount).unwrap_err(),
        6002,
    );
}

#[test]
fn test_initialize_timelock() {
    let mut fixture = TestFixture::default();
    let program_id = fixture.program_id;

    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let timelock_account_info = fixture.timelock_account.into_account_info();
    let authority_wallet_role_info = fixture.authority_wallet_role.into_account_info();
    let access_control_info = fixture.access_control.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let target_account_info = fixture.target_account.into_account_info();
    let system_program_info = fixture.system_program.into_account_info();
    let rent_info = fixture.rent.into_account_info();
    let mut accounts = TestFixture::initialize_timelock(
        tokenlock_account_info,
        &timelock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
        target_account_info,
        &system_program_info,
        &rent_info,
    )
    .expect("Getting accounts error");

    let bumps = InitializeTimeLockBumps::default();
    let ctx: Context<InitializeTimeLock> = Context::new(&program_id, &mut accounts, &[], bumps);
    assert_eq!(tokenlock::initialize_timelock(ctx).is_ok(), true);
    assert_eq!(
        accounts.timelock_account.target_account,
        accounts.target_account.key(),
    );
    assert_eq!(
        accounts.timelock_account.tokenlock_account,
        accounts.tokenlock_account.key(),
    );
    assert_eq!(accounts.timelock_account.cancelables.len(), 0);
    assert_eq!(accounts.timelock_account.timelocks.len(), 0);
}

#[test]
fn test_create_release_schedule() {
    let mut fixture = TestFixture::default();
    let program_id = fixture.program_id;
    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let authority_wallet_role_info = fixture.authority_wallet_role.into_account_info();
    let access_control_info = fixture.access_control.into_account_info();
    let mut accounts = TestFixture::create_release_schedule(
        tokenlock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
    )
    .expect("Getting accounts error");

    let release_count = 4;
    let delay_until_first_release_in_seconds = 0;
    let initial_release_portion_in_bips = 1000;
    let period_between_releases_in_seconds = 3600;

    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> = Context::new(&program_id, &mut accounts, &[], bumps);
    assert_eq!(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .is_ok(),
        true
    );

    let tokenlock_data: Account<TokenLockData> =
        Account::try_from_unchecked(accounts.tokenlock_account.as_ref()).unwrap();
    assert_eq!(tokenlock_data.release_schedules.len(), 1);
    let result_release_schedule = tokenlock_data.release_schedules.first().unwrap();
    assert_eq!(result_release_schedule.release_count, release_count);
    assert_eq!(
        result_release_schedule.delay_until_first_release_in_seconds,
        delay_until_first_release_in_seconds
    );
    assert_eq!(
        result_release_schedule.initial_release_portion_in_bips,
        initial_release_portion_in_bips
    );
    assert_eq!(
        result_release_schedule.period_between_releases_in_seconds,
        period_between_releases_in_seconds
    );

    let delay_until_first_release_in_seconds = 1000;
    let bumps = ManagementTokenlockBumps::default();
    let mut accounts = accounts.clone();
    let ctx: Context<ManagementTokenlock> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .unwrap_err(),
        6019,
    );

    let delay_until_first_release_in_seconds = 0;
    let release_count = 0;
    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .unwrap_err(),
        6020,
    );

    let release_count = 2;
    let initial_release_portion_in_bips = 10001;
    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .unwrap_err(),
        6021,
    );

    let initial_release_portion_in_bips = 1000;
    let period_between_releases_in_seconds = 0;
    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .unwrap_err(),
        6022,
    );

    let initial_release_portion_in_bips = 1000;
    let release_count = 1;
    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .unwrap_err(),
        6023,
    );
}

#[test]
fn test_mint_release_schedule() {
    let mut fixture_create_release = TestFixture::default();
    let program_id = fixture_create_release.program_id;
    let tokenlock_account_info = fixture_create_release.tokenlock_account.into_account_info();
    let mut authority_info = fixture_create_release.authority.into_account_info();
    let authority_wallet_role_info = fixture_create_release
        .authority_wallet_role
        .into_account_info();
    let access_control_info = fixture_create_release.access_control.into_account_info();
    let mut accounts_create_release = TestFixture::create_release_schedule(
        tokenlock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
    )
    .expect("Getting accounts error");

    let release_count = 4;
    let delay_until_first_release_in_seconds = 0;
    let initial_release_portion_in_bips = 1000;
    let period_between_releases_in_seconds = 3600;

    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> =
        Context::new(&program_id, &mut accounts_create_release, &[], bumps);
    assert_eq!(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .is_ok(),
        true
    );

    let mut fixture = TestFixture::default();
    let program_id = fixture.program_id;
    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let escrow_account_info = fixture.escrow_account.into_account_info();
    let timelock_account_info = fixture.timelock_account.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let authority_wallet_role_info = fixture.authority_wallet_role.into_account_info();
    let mint_info = fixture.mint_address.into_account_info();
    let to_info = fixture.to.into_account_info();
    let token_program_info = fixture.token_program.into_account_info();
    let access_control_program_info = fixture.access_control_program.into_account_info();
    let pda_account_info = fixture.pda_account.into_account_info();
    let system_program_info = fixture.system_program.into_account_info();
    let mut accounts = TestFixture::mint_release_schedule(
        &escrow_account_info,
        &tokenlock_account_info,
        &timelock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
        &mint_info,
        to_info,
        &token_program_info,
        &access_control_program_info,
        pda_account_info,
        &system_program_info,
    )
    .expect("Getting accounts error");
    accounts.tokenlock_account = accounts_create_release.tokenlock_account;

    let amount = 10000;
    let commencement_timestamp = 0;
    let schedule_id = 0;
    let cancelar = Pubkey::new_unique();
    let cancelable_by = vec![cancelar, Pubkey::new_unique()];
    let bumps = MintReleaseScheduleBumps::default();
    let ctx: Context<MintReleaseSchedule> = Context::new(&program_id, &mut accounts, &[], bumps);
    assert_eq!(
        tokenlock::mint_release_schedule(
            ctx,
            UUID,
            amount,
            commencement_timestamp,
            schedule_id,
            cancelable_by.clone()
        )
        .is_ok(),
        true
    );

    // BadCase: timelock already exists
    let bumps = MintReleaseScheduleBumps::default();
    let ctx: Context<MintReleaseSchedule> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::mint_release_schedule(
            ctx,
            UUID,
            amount,
            commencement_timestamp,
            schedule_id,
            cancelable_by.clone(),
        )
        .unwrap_err(),
        6027,
    );

    // BadCase: Commencement time out of range
    let commencement_timestamp = utils::get_unix_timestamp() + 10;
    let bumps = MintReleaseScheduleBumps::default();
    let ctx: Context<MintReleaseSchedule> = Context::new(&program_id, &mut accounts, &[], bumps);
    match_anchor_err(
        tokenlock::mint_release_schedule(
            ctx,
            UUID,
            amount,
            commencement_timestamp,
            schedule_id,
            cancelable_by.clone(),
        )
        .unwrap_err(),
        6008,
    );

    // BadCase: Max 10 cancelableBy addressees
    let bumps = MintReleaseScheduleBumps::default();
    let ctx: Context<MintReleaseSchedule> = Context::new(&program_id, &mut accounts, &[], bumps);
    let cancelable_by = vec![Pubkey::new_unique(); Timelock::CANCELABLE_BY_COUNT_MAX as usize + 1];
    match_anchor_err(
        tokenlock::mint_release_schedule(
            ctx,
            UUID,
            amount,
            commencement_timestamp,
            schedule_id,
            cancelable_by,
        )
        .unwrap_err(),
        6010,
    );
}

#[test]
fn test_transfer() {
    let mut fixture_create_release = TestFixture::default();
    let program_id = fixture_create_release.program_id;
    let tokenlock_account_info = fixture_create_release.tokenlock_account.into_account_info();
    let mut authority_info = fixture_create_release.authority.into_account_info();
    let authority_wallet_role_info = fixture_create_release
        .authority_wallet_role
        .into_account_info();
    let access_control_info = fixture_create_release.access_control.into_account_info();
    let mut accounts_create_release = TestFixture::create_release_schedule(
        tokenlock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
    )
    .expect("Getting accounts error");

    let release_count = 2;
    let delay_until_first_release_in_seconds = 0;
    let initial_release_portion_in_bips = 5000;
    let period_between_releases_in_seconds = 3600;

    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> =
        Context::new(&program_id, &mut accounts_create_release, &[], bumps);
    assert_eq!(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .is_ok(),
        true
    );

    let mut fixture = TestFixture::default();
    let total_amount = 1_000_000_000;
    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let escrow_account_info = fixture.escrow_account.into_account_info();
    let timelock_account_info = fixture.timelock_account.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let pda_info = fixture.pda_account.into_account_info();
    let to_info = fixture.to.into_account_info();
    let mint_info = fixture.mint_address.into_account_info();
    let token_program_info = fixture.token_program.into_account_info();
    let transfer_restrictions_program_info =
        fixture.transfer_restrictions_program.into_account_info();
    let authority_account_info = fixture.authority_account.into_account_info();
    let security_associated_account_from_info =
        fixture.security_associated_account_from.into_account_info();
    let security_associated_account_to_info =
        fixture.security_associated_account_to.into_account_info();
    let transfer_rule_info = fixture.transfer_rule.into_account_info();
    let mut accounts = TestFixture::transfer(
        &escrow_account_info,
        tokenlock_account_info,
        &timelock_account_info,
        pda_info,
        &mut authority_info,
        &to_info,
        &mint_info,
        &token_program_info,
        &transfer_restrictions_program_info,
        authority_account_info,
        &security_associated_account_from_info,
        &security_associated_account_to_info,
        &transfer_rule_info,
    )
    .expect("Getting accounts error");
    accounts.tokenlock_account = accounts_create_release.tokenlock_account;
    accounts.timelock_account.timelocks.push(Timelock {
        schedule_id: 0,
        commencement_timestamp: 123123513,
        tokens_transferred: 0,
        total_amount: total_amount,
        cancelable_by_count: 0,
        cancelable_by: [0; 10],
        signer_hash: [0; 20],
    });

    let amount = 10000;
    let bumps = TransferFromBumps::default();
    let remaining_accounts: &[AccountInfo] = &[fixture_create_release
        .transfer_restrictions_data
        .into_account_info()];
    let ctx: Context<TransferFrom> =
        Context::new(&program_id, &mut accounts, remaining_accounts, bumps);
    assert_eq!(tokenlock::transfer(ctx, amount).is_ok(), true);

    // BadCase: Amount bigger than unlocked
    let huge_amount = total_amount - amount + 1;
    let bumps = TransferFromBumps::default();
    let ctx: Context<TransferFrom> = Context::new(&program_id, &mut accounts, &[], bumps);

    match_anchor_err(tokenlock::transfer(ctx, huge_amount).unwrap_err(), 6014);
}

#[test]
fn test_transfer_timelock() {
    let mut fixture_create_release = TestFixture::default();
    let program_id = fixture_create_release.program_id;
    let tokenlock_account_info = fixture_create_release.tokenlock_account.into_account_info();
    let mut authority_info = fixture_create_release.authority.into_account_info();
    let authority_wallet_role_info = fixture_create_release
        .authority_wallet_role
        .into_account_info();
    let access_control_info = fixture_create_release.access_control.into_account_info();
    let mut accounts_create_release = TestFixture::create_release_schedule(
        tokenlock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
    )
    .expect("Getting accounts error");

    let release_count = 2;
    let delay_until_first_release_in_seconds = 0;
    let initial_release_portion_in_bips = 5000;
    let period_between_releases_in_seconds = 3600;

    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> =
        Context::new(&program_id, &mut accounts_create_release, &[], bumps);
    assert_eq!(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .is_ok(),
        true
    );

    let mut fixture = TestFixture::default();
    let program_id = fixture.program_id;
    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let escrow_account_info = fixture.escrow_account.into_account_info();
    let timelock_account_info = fixture.timelock_account.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let pda_info = fixture.pda_account.into_account_info();
    let to_info = fixture.to.into_account_info();
    let token_program_info = fixture.token_program.into_account_info();
    let mint_info = fixture.mint_address.into_account_info();
    let transfer_restrictions_program_info =
        fixture.transfer_restrictions_program.into_account_info();
    let authority_account_info = fixture.authority_account.into_account_info();
    let security_associated_account_from_info =
        fixture.security_associated_account_from.into_account_info();
    let security_associated_account_to_info =
        fixture.security_associated_account_to.into_account_info();
    let transfer_rule_info = fixture.transfer_rule.into_account_info();
    let mut accounts = TestFixture::transfer_timelock(
        &escrow_account_info,
        &tokenlock_account_info,
        &timelock_account_info,
        pda_info,
        &mut authority_info,
        &to_info,
        &mint_info,
        &token_program_info,
        &transfer_restrictions_program_info,
        authority_account_info,
        &security_associated_account_from_info,
        &security_associated_account_to_info,
        &transfer_rule_info,
    )
    .expect("Getting accounts error");
    let remaining_accounts: &[AccountInfo] = &[fixture_create_release
        .transfer_restrictions_data
        .into_account_info()];
    let timelock_amount = 1_000_000_000;
    accounts.tokenlock_account = accounts_create_release.tokenlock_account;
    accounts.timelock_account.timelocks.push(Timelock {
        schedule_id: 0,
        commencement_timestamp: 123123513,
        tokens_transferred: 0,
        total_amount: timelock_amount,
        cancelable_by_count: 0,
        cancelable_by: [0; 10],
        signer_hash: [0; 20],
    });

    let amount = 10000;
    let timelock_id = 0;
    let bumps = TransferTimelockBumps::default();
    let ctx: Context<TransferTimelock> =
        Context::new(&program_id, &mut accounts, remaining_accounts, bumps);

    assert_eq!(
        tokenlock::transfer_timelock(ctx, amount, timelock_id).is_ok(),
        true
    );

    // BadCase: Amount bigger than unlocked
    let huge_amount = timelock_amount - amount + 1;
    let timelock_id = 0;
    let bumps = TransferTimelockBumps::default();
    let ctx: Context<TransferTimelock> = Context::new(&program_id, &mut accounts, &[], bumps);

    match_anchor_err(
        tokenlock::transfer_timelock(ctx, huge_amount, timelock_id).unwrap_err(),
        6014,
    );
}

#[test]
fn test_cancel_timelock() {
    let mut fixture_create_release = TestFixture::default();
    let program_id = fixture_create_release.program_id;
    let tokenlock_account_info = fixture_create_release.tokenlock_account.into_account_info();
    let mut authority_info = fixture_create_release.authority.into_account_info();
    let authority_wallet_role_info = fixture_create_release
        .authority_wallet_role
        .into_account_info();
    let access_control_info = fixture_create_release.access_control.into_account_info();
    let mut accounts_create_release = TestFixture::create_release_schedule(
        tokenlock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
    )
    .expect("Getting accounts error");

    let release_count = 2;
    let delay_until_first_release_in_seconds = 0;
    let initial_release_portion_in_bips = 5000;
    let period_between_releases_in_seconds = 3600;

    let bumps = ManagementTokenlockBumps::default();
    let ctx: Context<ManagementTokenlock> =
        Context::new(&program_id, &mut accounts_create_release, &[], bumps);
    assert_eq!(
        tokenlock::create_release_schedule(
            ctx,
            UUID,
            release_count,
            delay_until_first_release_in_seconds,
            initial_release_portion_in_bips,
            period_between_releases_in_seconds,
        )
        .is_ok(),
        true
    );

    let mut fixture = TestFixture::default();
    let program_id = fixture.program_id;
    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let escrow_account_info = fixture.escrow_account.into_account_info();
    let timelock_account_info = fixture.timelock_account.into_account_info();
    let to_info = fixture.to.into_account_info();
    let token_program_info = fixture.token_program.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let authority_wallet_role_info = fixture.authority_wallet_role.into_account_info();
    let mint_info = fixture.mint_address.into_account_info();
    let access_control_program_info = fixture.access_control_program.into_account_info();
    let pda_account_info = fixture.pda_account.into_account_info();
    let system_program_info = fixture.system_program.into_account_info();
    let mut accounts_mint_release = TestFixture::mint_release_schedule(
        &escrow_account_info,
        &tokenlock_account_info,
        &timelock_account_info,
        &mut authority_info,
        &authority_wallet_role_info,
        &access_control_info,
        &mint_info,
        to_info,
        &token_program_info,
        &access_control_program_info,
        pda_account_info,
        &system_program_info,
    )
    .expect("Getting accounts error");
    accounts_mint_release.tokenlock_account = accounts_create_release.tokenlock_account;

    let amount = 10000;
    let commencement_timestamp = 0;
    let schedule_id = 0;
    let cancelar = Pubkey::new_unique();
    let cancelable_by = vec![cancelar, Pubkey::new_unique()];
    let bumps = MintReleaseScheduleBumps::default();
    let ctx: Context<MintReleaseSchedule> =
        Context::new(&program_id, &mut accounts_mint_release, &[], bumps);
    assert_eq!(
        tokenlock::mint_release_schedule(
            ctx,
            UUID,
            amount,
            commencement_timestamp,
            schedule_id,
            cancelable_by.clone()
        )
        .is_ok(),
        true
    );

    // BadCase: Invalid timelock id
    let timelock_id = 0;
    let mut fixture = TestFixture::default();
    let tokenlock_account_info = fixture.tokenlock_account.into_account_info();
    let escrow_account_info = fixture.escrow_account.into_account_info();
    let timelock_account_info = fixture.timelock_account.into_account_info();
    let mut authority_info = fixture.authority.into_account_info();
    let pda_info = fixture.pda_account.into_account_info();
    let target_info = fixture.target.into_account_info();
    let reclaimer_info = fixture.reclaimer.into_account_info();
    let target_assoc_info = fixture.target_assoc.into_account_info();
    let token_program_info = fixture.token_program.into_account_info();
    let mint_info = fixture.mint_address.into_account_info();
    let transfer_restrictions_program_info =
        fixture.transfer_restrictions_program.into_account_info();
    let security_associated_account_from_info =
        fixture.security_associated_account_from.into_account_info();
    let security_associated_account_to_info =
        fixture.security_associated_account_to.into_account_info();
    let transfer_rule_info = fixture.transfer_rule.into_account_info();
    let mut accounts = TestFixture::cancel_timelock(
        &escrow_account_info,
        &tokenlock_account_info,
        &timelock_account_info,
        target_info,
        pda_info,
        &mut authority_info,
        &reclaimer_info,
        &target_assoc_info,
        &mint_info,
        &token_program_info,
        &transfer_restrictions_program_info,
        &security_associated_account_from_info,
        &security_associated_account_to_info,
        &transfer_rule_info,
    )
    .expect("Getting accounts error");
    let bumps = CancelTimelockBumps::default();
    let ctx: Context<CancelTimelock> = Context::new(&program_id, &mut accounts, &[], bumps);

    match_anchor_err(
        tokenlock::cancel_timelock(ctx, timelock_id).unwrap_err(),
        6011,
    );

    // BadCase: You are not allowed to cancel this timelock
    accounts.timelock_account.timelocks.push(Timelock {
        schedule_id: 0,
        commencement_timestamp: utils::get_unix_timestamp(),
        tokens_transferred: 1_000_000_000,
        total_amount: 1_000_000_000,
        cancelable_by_count: 1,
        cancelable_by: [0; 10],
        signer_hash: [0; 20],
    });
    let bumps = CancelTimelockBumps::default();
    let ctx: Context<CancelTimelock> = Context::new(&program_id, &mut accounts, &[], bumps);

    match_anchor_err(
        tokenlock::cancel_timelock(ctx, timelock_id).unwrap_err(),
        6013,
    );

    // BadCase: Timelock has no value left
    let mut authority_info = accounts.authority.to_account_info();
    authority_info.is_signer = true;
    authority_info.key = &cancelar;
    accounts.authority = Signer::try_from(&authority_info).unwrap();
    // accounts.authority.key = &cancelar;
    accounts.timelock_account.cancelables.push(cancelar);
    let bumps = CancelTimelockBumps::default();
    let ctx: Context<CancelTimelock> = Context::new(&program_id, &mut accounts, &[], bumps);

    match_anchor_err(
        tokenlock::cancel_timelock(ctx, timelock_id).unwrap_err(),
        6012,
    );

    accounts.tokenlock_account = accounts_mint_release.tokenlock_account;
    accounts.timelock_account.timelocks.push(Timelock {
        schedule_id: 0,
        commencement_timestamp: utils::get_unix_timestamp(),
        tokens_transferred: 0,
        total_amount: 1_000_000_000,
        cancelable_by_count: 1,
        cancelable_by: [0; 10],
        signer_hash: [0; 20],
    });
    let remaining_accounts: &[AccountInfo] = &[fixture_create_release
        .transfer_restrictions_data
        .into_account_info()];

    let timelock_id = 1;
    let bumps = CancelTimelockBumps::default();
    let ctx: Context<CancelTimelock> =
        Context::new(&program_id, &mut accounts, remaining_accounts, bumps);
    assert_eq!(tokenlock::cancel_timelock(ctx, timelock_id).is_ok(), true);
}
