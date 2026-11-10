use anchor_lang::{
    prelude::Result,
    solana_program::{
        program::invoke, program_error::ProgramError, program_pack::Pack,
        system_instruction::transfer,
    },
    Lamports,
};
use anchor_spl::token_2022::{self, spl_token_2022::state::Multisig};

use crate::{AccountInfo, Rent, SolanaSysvar};

const MAX_MULTISIG_SIGNERS: usize = 11;

pub fn update_account_lamports_to_minimum_balance<'info>(
    account: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
) -> Result<()> {
    let extra_lamports = Rent::get()?.minimum_balance(account.data_len()) - account.get_lamports();
    if extra_lamports > 0 {
        invoke(
            &transfer(payer.key, account.key, extra_lamports),
            &[payer, account, system_program],
        )?;
    }
    Ok(())
}

/// Authorize `authority` either as a transaction signer or as a Token-2022 multisig.
///
/// Multisig member accounts must be passed in `signers` (instruction remaining accounts).
/// The multisig account's own signature does not count toward its threshold.
pub fn verify_token2022_authority<'info>(
    authority: &AccountInfo<'info>,
    signers: &[AccountInfo<'info>],
) -> Result<()> {
    if *authority.owner == token_2022::ID && authority.data_len() == Multisig::LEN {
        let data = authority.try_borrow_data()?;
        let multisig = Multisig::unpack(&data)?;
        let n = multisig.n as usize;
        if multisig.signers.len() != MAX_MULTISIG_SIGNERS
            || multisig.m == 0
            || n > multisig.signers.len()
            || multisig.m as usize > n
        {
            return Err(ProgramError::InvalidAccountData.into());
        }

        let mut num_signers = 0usize;
        let mut matched = [false; MAX_MULTISIG_SIGNERS];
        for signer in signers.iter() {
            for (position, key) in multisig.signers[..n].iter().enumerate() {
                if key == signer.key && !matched[position] {
                    if !signer.is_signer {
                        return Err(ProgramError::MissingRequiredSignature.into());
                    }
                    matched[position] = true;
                    num_signers += 1;
                }
            }
        }
        if num_signers < multisig.m as usize {
            return Err(ProgramError::MissingRequiredSignature.into());
        }
        return Ok(());
    }

    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature.into());
    }
    Ok(())
}
