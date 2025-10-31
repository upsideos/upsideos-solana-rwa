use anchor_lang::{
    prelude::*,
    solana_program::{program_memory::sol_memcmp, pubkey::PUBKEY_BYTES},
};

use crate::{ReleaseSchedule, TokenLockDataWrapper};

pub const VEC_LEN_SIZE: usize = 4;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Timelock {
    pub schedule_id: u16,
    pub commencement_timestamp: u64,
    pub tokens_transferred: u64,
    pub total_amount: u64,
    pub cancelable_by_count: u8,
    pub cancelable_by: [u8; 10],
    pub signer_hash: [u8; 20],
}
impl Timelock {
    pub const MAX_CANCELABLES_COUNT: usize = 256;
    pub const CANCELABLE_BY_COUNT_MAX: u8 = 10;
    pub const DEFAULT_SIZE: usize = 2 + 8 + 8 + 8 + 1 + 10 + 20;

    pub fn has_cancelable_by(&self, cancelable_by_index: u8) -> bool {
        for i in 0..self.cancelable_by_count {
            if self.cancelable_by[i as usize] == cancelable_by_index {
                return true;
            }
        }
        return false;
    }
    pub fn is_equal(&self, src: &Timelock) -> bool {
        //compare hash
        if sol_memcmp(&self.signer_hash, &src.signer_hash, 20) != 0 {
            return false;
        }

        return true;
    }
}

#[account]
#[derive(Default)]
pub struct TimelockData {
    pub tokenlock_account: Pubkey,
    pub target_account: Pubkey,
    pub cancelables: Vec<Pubkey>,
    pub timelocks: Vec<Timelock>,
}

impl TimelockData {
    pub const BIPS_PRECISION: u32 = 10000;

    pub const HEADERS_LEN: usize = 8 + PUBKEY_BYTES + PUBKEY_BYTES;
    pub fn space(&self, total_size: usize) -> Option<usize> {
        let cancelable_by_used_size = self.cancelables.len().checked_mul(PUBKEY_BYTES)?;
        let timelock_used_size = Timelock::DEFAULT_SIZE.checked_mul(self.timelocks.len())?;
        let total_used: usize = timelock_used_size
            .checked_add(cancelable_by_used_size)?
            .checked_add(Self::HEADERS_LEN)?
            .checked_add(VEC_LEN_SIZE * 2)?;
        return total_size.checked_sub(total_used);
    }

    /// Calculate the expected new size for the timelock account after adding a new timelock and cancelables
    /// 
    /// # Arguments
    /// * `current_data_len` - Current size of the timelock account data
    /// * `cancelable_by` - Slice of cancelable addresses to add (duplicates will be counted only once)
    /// 
    /// # Returns
    /// The expected new size including space for the new timelock and any new cancelables
    pub fn expected_new_size(&self, current_data_len: usize, cancelable_by: &[Pubkey]) -> usize {
        // Count how many cancelables in cancelable_by are NOT already in self.cancelables
        let mut new_cancelable_count = 0usize;
        for cancelable in cancelable_by {
            if self.get_cancelable_index(cancelable).is_none() {
                new_cancelable_count = new_cancelable_count.checked_add(1).unwrap();
            }
        }

        let cancelables_space = if self.cancelables.len()
            .checked_add(new_cancelable_count)
            .unwrap() < Timelock::MAX_CANCELABLES_COUNT
        {
            // We're below the max, allocate space for all new cancelables
            new_cancelable_count.checked_mul(PUBKEY_BYTES).unwrap()
        } else {
            // We would exceed the max, only allocate space for the cancelables we can actually add
            let available_slots = Timelock::MAX_CANCELABLES_COUNT
                .checked_sub(self.cancelables.len())
                .unwrap();
            available_slots.checked_mul(PUBKEY_BYTES).unwrap()
        };
        
        current_data_len
            .checked_add(cancelables_space)
            .unwrap()
            .checked_add(Timelock::DEFAULT_SIZE)
            .unwrap()
    }

    pub fn get_cancelable_index(&self, canceler: &Pubkey) -> Option<u8> {
        for i in 0..self.cancelables.len() {
            if self.cancelables[i] == *canceler {
                return Some(i as u8);
            }
        }
        None
    }

    pub fn is_duplicated_timelock(&self, timelock: &Timelock) -> bool {
        let len = self.timelocks.len();
        if len == 0 {
            return false;
        }

        self.timelocks
            .iter()
            .any(|timelock_item| timelock.is_equal(timelock_item))
    }

    pub fn get_timelock(&self, id: u32) -> Option<&Timelock> {
        return self.timelocks.get(id as usize);
    }

    pub fn exist_timelock(&self, id: u32) -> bool {
        return id < (self.timelocks.len() as u32);
    }

    pub fn get_timelock_mut(&mut self, id: u32) -> Option<&mut Timelock> {
        return self.timelocks.get_mut(id as usize);
    }

    //////////utils//////////////////////
    pub fn unlocked_balance_of(&self, tokenlock_data: &[u8], now_ts: u64) -> Option<u64> {
        let mut amount: u64 = 0;
        for id in 0..self.timelocks.len() {
            amount = amount.checked_add(self.unlocked_balance_of_timelock(
                id as u32,
                tokenlock_data,
                now_ts,
            ))?;
        }
        Some(amount)
    }

    pub fn unlocked_balance_of_timelock(
        &self,
        timelock_id: u32,
        tokenlock_data: &[u8],
        now_ts: u64,
    ) -> u64 {
        if let Some(timelock) = self.get_timelock(timelock_id) {
            if timelock.total_amount <= timelock.tokens_transferred {
                return 0;
            } else {
                return self
                    .total_unlocked_to_date_of_timelock(timelock_id, tokenlock_data, now_ts)
                    .checked_sub(timelock.tokens_transferred)
                    .unwrap();
            }
        }
        return 0;
    }

    pub fn total_unlocked_to_date_of_timelock(
        &self,
        timelock_id: u32,
        tokenlock_data: &[u8],
        now_ts: u64,
    ) -> u64 {
        if let Some(timelock) = self.get_timelock(timelock_id) {
            if let Some(release_schedule) =
                TokenLockDataWrapper::get_schedule(tokenlock_data, timelock.schedule_id)
            {
                return Self::calculate_unlocked(
                    timelock.commencement_timestamp,
                    now_ts,
                    timelock.total_amount,
                    &release_schedule,
                );
            }
        }
        return 0;
    }

    pub fn calculate_unlocked(
        commencement_timestamp: u64,
        current_timestamp: u64,
        amount: u64,
        release_schedule: &ReleaseSchedule,
    ) -> u64 {
        return Self::calculate_unlocked_0(
            commencement_timestamp,
            current_timestamp,
            amount,
            release_schedule.release_count,
            release_schedule.delay_until_first_release_in_seconds,
            release_schedule.initial_release_portion_in_bips,
            release_schedule.period_between_releases_in_seconds,
        );
    }

    pub fn calculate_unlocked_0(
        commencement_timestamp: u64,
        current_timestamp: u64,
        amount: u64,
        release_count: u32,
        delay_until_first_release_in_seconds: u64,
        initial_release_portion_in_bips: u32,
        period_between_releases_in_seconds: u64,
    ) -> u64 {
        if commencement_timestamp > current_timestamp {
            return 0;
        }
        let seconds_elapsed = current_timestamp
            .checked_sub(commencement_timestamp)
            .unwrap();

        let release_count_wo_initital = release_count.checked_sub(1).unwrap() as u64;
        // return the full amount if the total lockup period has expired
        // unlocked amounts in each period are truncated and round down remainders smaller than the smallest unit
        // unlocking the full amount unlocks any remainder amounts in the final unlock period
        // this is done first to reduce computation
        let period_for_release_count_in_seconds =
            period_between_releases_in_seconds * release_count_wo_initital;
        if seconds_elapsed
            >= delay_until_first_release_in_seconds
                .checked_add(period_for_release_count_in_seconds)
                .unwrap()
        {
            return amount as u64;
        }

        match seconds_elapsed.checked_sub(delay_until_first_release_in_seconds) {
            None => return 0, // when the time is not passed for first release than we identify as zero balance
            // unlock the initial release if the delay has elapsed
            Some(seconds_elapsed_after_first_release) => {
                let mut unlocked: u64 = (amount
                    .checked_mul(initial_release_portion_in_bips as u64)
                    .unwrap())
                    / (Self::BIPS_PRECISION as u64);

                // if at least one period after the delay has passed
                if seconds_elapsed_after_first_release >= period_between_releases_in_seconds {
                    // calculate the number of additional periods that have passed (not including the initial release)
                    // this discards any remainders (ie it truncates / rounds down)
                    let additional_unlocked_periods =
                        seconds_elapsed_after_first_release / period_between_releases_in_seconds;
                    // calculate the amount of unlocked tokens for the additionalUnlockedPeriods
                    // multiplication is applied before division to delay truncating to the smallest unit
                    // this distributes unlocked tokens more evenly across unlock periods
                    // than truncated division followed by multiplication
                    let locked_amount = amount.checked_sub(unlocked).unwrap();
                    unlocked = unlocked
                        .checked_add(
                            (locked_amount
                                .checked_mul(additional_unlocked_periods)
                                .unwrap() as u64)
                                / release_count_wo_initital,
                        )
                        .unwrap();
                }
                return unlocked;
            }
        }
    }

    pub fn locked_balance_of_timelock(
        &self,
        timelock_index: u32,
        tokenlock_data: &[u8],
        now_ts: u64,
    ) -> u64 {
        if let Some(timelock) = self.get_timelock(timelock_index) {
            if timelock.total_amount <= timelock.tokens_transferred {
                return 0;
            } else {
                return timelock
                    .total_amount
                    .checked_sub(self.total_unlocked_to_date_of_timelock(
                        timelock_index,
                        tokenlock_data,
                        now_ts,
                    ))
                    .unwrap();
            }
        }
        return 0;
    }

    pub fn locked_balance_of(&self, tokenlock_data: &[u8], now_ts: u64) -> u64 {
        let mut amount: u64 = 0;
        for id in 0..self.timelocks.len() {
            amount = amount
                .checked_add(self.locked_balance_of_timelock(id as u32, tokenlock_data, now_ts))
                .unwrap();
        }
        return amount;
    }

    pub fn balance_of(&self, tokenlock_data: &[u8], now_ts: u64) -> Option<u64> {
        return self
            .unlocked_balance_of(tokenlock_data, now_ts)?
            .checked_add(self.locked_balance_of(tokenlock_data, now_ts));
    }

    pub fn balance_of_timelock(&self, timelock_id: u32, tokenlock_data: &[u8], now_ts: u64) -> u64 {
        return self
            .unlocked_balance_of_timelock(timelock_id, tokenlock_data, now_ts)
            .checked_add(self.locked_balance_of_timelock(timelock_id, tokenlock_data, now_ts))
            .unwrap();
    }
}
