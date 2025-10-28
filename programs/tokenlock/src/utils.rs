use anchor_lang::prelude::*;
#[cfg(not(test))]
use anchor_spl::token_2022::spl_token_2022::onchain::invoke_transfer_checked;
use sha2::{Digest, Sha256};
extern crate hex;
use anchor_lang::solana_program::program_memory::sol_memcpy;
#[cfg(not(target_os = "solana"))]
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(test))]
use transfer_restrictions::cpi::accounts::EnforceTransferRestrictions;

// Mock implementation for tests
#[cfg(test)]
fn invoke_transfer_checked(
    _token_program_id: &Pubkey,
    _from: AccountInfo,
    _mint: AccountInfo,
    _to: AccountInfo,
    _authority: AccountInfo,
    _remaining_accounts: &[AccountInfo],
    _amount: u64,
    _decimals: u8,
    _signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    // Mock implementation for tests - in real tests with CPI, use solana-program-test
    msg!("Mock transfer in test mode");
    Ok(())
}

pub const TOKENLOCK_PDA_SEED: &[u8] = b"tokenlock";

pub fn enforce_transfer_restrictions_cpi<'info>(
    authority_account_info: AccountInfo<'info>,
    mint_address_info: AccountInfo<'info>,
    to_info: AccountInfo<'info>,
    transfer_restrictions_data: AccountInfo<'info>,
    security_associated_account_from_info: AccountInfo<'info>,
    security_associated_account_to_info: AccountInfo<'info>,
    transfer_rule_info: AccountInfo<'info>,
    transfer_restrictions_program_info: AccountInfo<'info>,
) -> Result<()> {
    #[cfg(not(test))]
    {
        let cpi_accounts = EnforceTransferRestrictions {
            source_account: authority_account_info,
            mint: mint_address_info,
            destination_account: to_info,
            transfer_restriction_data: transfer_restrictions_data,
            security_associated_account_from: security_associated_account_from_info,
            security_associated_account_to: security_associated_account_to_info,
            transfer_rule: transfer_rule_info,
        };
        transfer_restrictions::cpi::enforce_transfer_restrictions(CpiContext::new(
            transfer_restrictions_program_info,
            cpi_accounts,
        ))?;
    }

    #[cfg(test)]
    {
        // Mock implementation for tests - in real tests with CPI, use solana-program-test
        msg!("Mock enforce_transfer_restrictions in test mode");
        // Prevent unused variable warnings
        let _ = (authority_account_info, mint_address_info, to_info, transfer_restrictions_data,
                 security_associated_account_from_info, security_associated_account_to_info, 
                 transfer_rule_info, transfer_restrictions_program_info);
    }

    Ok(())
}

pub fn transfer_spl_from_escrow<'info>(
    token_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    mint_info: &AccountInfo<'info>,
    tokenlock_account: &Pubkey,
    remaining_accounts: &[AccountInfo<'info>],
    decimals: u8,
    bump_seed: u8,
) -> Result<()> {
    let seeds = &[
        &TOKENLOCK_PDA_SEED[..],
        &mint_info.key.as_ref()[..],
        &tokenlock_account.as_ref()[..],
        &[bump_seed],
    ];

    invoke_transfer_checked(
        token_program.key,
        from.clone(),
        mint_info.clone(),
        to.clone(),
        authority.clone(),
        remaining_accounts,
        amount,
        decimals,
        &[&seeds[..]],
    )?;

    Ok(())
}

pub fn calc_signer_hash(key: &Pubkey, bump: [u8; 16]) -> [u8; 20] {
    let data = [&key.as_ref()[..], &bump].concat();

    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut res: [u8; 20] = [0; 20];
    sol_memcpy(&mut res, &result[0..20], 20);

    return res;
}

// in order to support unittest scenarion and solana prod
// we need to define implementation regarding architecture
// bpf - solana sealevel
pub fn get_unix_timestamp() -> u64 {
    // #[cfg(target_arch = "bpf")]
    #[cfg(target_os = "solana")]
    {
        let now_ts = Clock::get().expect("Time error").unix_timestamp as u64;
        return now_ts;
    }

    #[cfg(not(target_os = "solana"))]
    {
        let start = SystemTime::now();
        let since_the_epoch = start.duration_since(UNIX_EPOCH).expect("Time error");
        return since_the_epoch.as_secs();
    }
}

#[cfg(test)]
mod test {
    use {super::*, solana_program::pubkey::Pubkey, std::str::FromStr};

    static TEST_SOLANA_ACCOUNT: &str = "G6quj6Xdzgd6KURYWhxJxfB7TDWLUdCGLCeiVJrGT9vR";

    #[test]
    fn singer_hash_for_zero_nonce() {
        let key = Pubkey::from_str(TEST_SOLANA_ACCOUNT).unwrap();
        let bump: [u8; 16] = [0; 16];

        let result = calc_signer_hash(&key, bump);

        assert_eq!(
            result,
            [
                255, 106, 152, 202, 209, 154, 215, 13, 87, 90, 148, 51, 113, 141, 3, 157, 83, 108,
                9, 207
            ]
        )
    }

    #[test]
    fn singer_hash_for_ff_nonce() {
        let key = Pubkey::from_str(TEST_SOLANA_ACCOUNT).unwrap();
        let bump: [u8; 16] = [255; 16];

        let result = calc_signer_hash(&key, bump);

        assert_eq!(
            result,
            [
                213, 233, 101, 251, 234, 207, 180, 62, 251, 193, 122, 140, 81, 59, 64, 241, 239,
                244, 169, 238
            ]
        )
    }
}
