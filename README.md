# Upside OS Solana RWA

# Overview

RWA smart contract implementation from Upside.
The core purpose of the token is to enforce transfer restrictions for certain groups.

This implementation attempts to balance simplicity and sufficiency for smart contract RWAs that need to comply with regulatory authorities - without adding unnecessary complexity for simple use cases.

Solana RWA consists of several modules:
* **Access Management**
* **Transfer Groups and Rules Management**
* **Token2022 RWA Transfer**

### Disclaimer

This open or closed source software is provided with no warranty. This is not legal advice. CoMakery, Inc. dba Upside is not a legal firm and is not your lawyer. Securities are highly regulated across multiple jurisdictions. Issuing a RWA incorrectly can result in financial penalties or jail time if done incorrectly. Consult a lawyer and tax advisor. Conduct an independent security audit of the code.

## On-Chain Holder/Wallet Management

Active Holder/Wallet management is conducted on-chain and autonomously, with multiple admin configurations that allow flexibility of transfer rule configuration. This greatly simplifies the off-chain accounting and effort required from Transfer (and other) Admins, removing the need to track Wallet holdings across different Holders.

Wallets are not programatically prohibited from assuming multiple Admin roles. We advise against this in practice; however, this must be enforced off-chain.

Holders are allowed to keep multiple Wallet addresses, which can be spread across multiple Transfer Groups (in which case, they would be added to each group's holder count) as well as _within_ Transfer Groups. These Wallets are consolidated under a common `holderId`.

- Ex.: Holder A can have 4 wallets spread across two Transfer Groups, X and Y. The Holder can have Wallets 1 & 2 in Group X, and Wallets 3 & 4 in Group Y. They will still count overall as one single Holder, but it will also be considered as a unique holder in Group X and one unique holder in Group Y.

To manage these Holders and their Wallets:

- A initialized Holder account is enforced on SecurityAssociatedAccount creation for wallet, automatically checking that recipient Wallet addresses of tokens are cataloged and assigned `holderId`s as needed.
- If a "new" Wallet address receives a token, a new `holderId` is created for that Wallet address.
- Admins can also separately create Holders from Wallet addresses and append Wallet addresses to existing Holder accounts

## Transfer Restrictions

The RWA can be configured after deployment to enforce transfer restrictions such as the ones shown in the diagram below. Each Holder's blockchain Wallet address corresponds to a different group.

This is enforced by TransferRestrictions Program and Transfer Hook.

### Example

Only transfers between wallet address groups in the direction of the arrows are allowed:

```mermaid
stateDiagram-v2
    state "Group 5: Founders (2 Yr Lockup)" as g5
    state "Group 3: Reg S Non-US Approved" as g3
    state "Group 2: Regulated Exchange" as g2
    state "Group 1: Issuer Token Reserves" as g1
    state "Group 0: Default Group" as g0
    g1 --> g5
    g1 --> g1
    g1 --> g2
    g2 --> g2
    g2 --> g1
    g3 --> g2
    g2 --> g3
```

Here's an example overview of how transfer restrictions could be configured and enforced.

```mermaid
sequenceDiagram
  autonumber
  actor Buyer
  actor Investor
  actor TransferAdmin

  participant TransferRestrictionsProgram
  participant Token22

  Investor ->> TransferAdmin: send AML/KYC and accreditation info
  TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionHolder(investorAddress)
  TransferAdmin ->> TransferRestrictionsProgram: initializeHolderGroup(investorAddress, transferGroup)
  TransferAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(investorAddress, transferGroup)

  Buyer ->> TransferAdmin: send AML/KYC and accreditation info
  TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionHolder(buyerAddress)
  TransferAdmin ->> TransferRestrictionsProgram: initializeHolderGroup(buyerAddress, transferGroup)
  TransferAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(buyerAddress, transferGroup)
  TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRule(fromGroup, toGroup, afterTimestamp)

  Investor ->>+ Token22: transfer(buyerAddress, amount)
  Token22 ->>- TransferRestrictionsProgram: execute(from, to, value)
  Note left of TransferRestrictionsProgram: Transfer or Revert depending on the resulting code where execute transfer hook enforces transfer restrictions
```

The Transfer Admin for the TransferRestrictionsProgram can provision wallet addresses to transfer and receive tokens under certain defined conditions. This is the process for configuring transfer restrictions and executing token transfers:

1. An Investor sends their Anti Money Laundering and Know Your Customer (AML/KYC) information to the Transfer Admin or to a proxy vetting service off-chain to verify this information.
    - The benefit of using a qualified third party provider is to avoid needing to store privately identifiable information.
    - We recommend implementations use off-chain mechanisms (such as a 3rd party AML/KYC provider) that ensure a given address is approved and is a non-malicious smart contract wallet. However, generally multi-signature type wallets must be allowed in order to provide adequate security for investors.
    - This smart contract implementation does not provide a solution for collecting AML/KYC information.

2. The Transfer Admin or Wallet Admin calls `initialalizeHolder(buyerAddress)`, `initializeHolderGroup(buyerAddress, transferGroup)` and `initializeSecurityAssociatedAccount(buyerAddress, transferGroup)` to provision their account. Initially this will be done for the Primary Issuance of tokens to Investors where tokens are distributed directly from the Issuer to Holder wallets, where:

   - `buyerAddress`: Buyer/Investor wallet address for which to set permissions
   - `transferGroup`: desired transfer group ID for wallet address

3. A potential Investor sends their AML/KYC information to the Transfer Admin or Wallet Admin or a **trusted** AML/KYC provider.

4. The Transfer Admin or Wallet Admin calls `initialalizeHolder(investorAddress)`, `initializeHolderGroup(investorAddress, transferGroup)` and `initializeSecurityAssociatedAccount(investorAddress, transferGroup)` to provision the Investor account.

5. At this time (or potentially earlier), the Transfer Admin or Wallet Admin authorizes the transfer of tokens between account groups with `initializeTransferRule(fromGroup, toGroup, afterTimestamp)`. Note that allowing a transfer from group A to group B by default does not allow the reverse transfer from group B to group A. This would need to be configured separately.

   - Ex.: Reg CF unaccredited Investors may be allowed to sell to Accredited US Investors but not vice versa.

**Note:** For most instructions, the `payer` account (which pays account rent) can be different from the `authority` account (which signs the transaction and has the required admin role). This allows for more flexible transaction payment scenarios.

Relevant methods:
```typescript
/**
  * @dev Initialize new transfer group
  * @param groupId Unique id of the group
  * @accounts
  * @param transferRestrictionGroup The transfer restriction group PDA as ["trg", transferRestrictionData, groupId].
  * @param transferRestrictionData The Transfer Restricition data initialized for securityToken
  * @param accessControlAccount Access Control Account.
  * @param authorityWalletRole The authority's wallet role account for permission check
  * @param authority Wallet which signs the transaction. Must be Transfer Admin
  * @param payer Wallet which pays account rent. Can be different from authority
  * @param systemProgram Solana System Program which is required for new on-chain account data initialization
  */
.initializeTransferRestrictionGroup(groupId)
  .accountsStrict({
    transferRestrictionGroup,
    transferRestrictionData,
    accessControlAccount,
    authorityWalletRole,
    authority,
    payer,
    systemProgram,
  })
```

```typescript
/**
  * @dev Sets an allowed transfer from a group to another group beginning at a specific time.
  * There is only one definitive rule per from and to group.
  * @param transferGroupIdFrom The transfer group ID the transfer is coming from.
  * @param transferGroupIdTo The transfer group ID the transfer is going to.
  * @param lockedUntil The unix timestamp that the transfer is locked until. 0 is a special number. 0 means the transfer is not allowed.
  * This is because in the smart contract mapping all pairs are implicitly defined with a default lockedUntil value of 0.
  * But no transfers should be authorized until explicitly allowed. Thus 0 must mean no transfer is allowed.
  * @accounts
  * @param transferRule The transfer rule PDA as ["tr", transferRestrictionGroupFrom, transferRestrictionGroupTo].
  * @param transferRestrictionData The Transfer Restriction data initialized for securityToken
  * @param transferRestrictionGroupFrom The group the transfer is coming from.
  * @param transferRestrictionGroupTo The group the transfer is going to.
  * @param accessControlAccount Access Control Account.
  * @param authorityWalletRole The authority's wallet role account for permission check
  * @param authority Wallet which signs the transaction. Must be Transfer Admin
  * @param payer Wallet which pays account rent. Can be different from authority
  * @param systemProgram Solana System Program which is required for new on-chain account data initialization
  */
initializeTransferRule(transferGroupIdFrom, transferGroupIdTo, lockedUntil)
  .accountsStrict({
    transferRule,
    transferRestrictionData,
    transferRestrictionGroupFrom,
    transferRestrictionGroupTo,
    accessControlAccount,
    authorityWalletRole,
    authority,
    payer,
    systemProgram,
  })
```

```typescript
/**
  * @dev A convenience method for initializing the new holder.
  * @param holderId The created holderId
  * @accounts
  * @param transferRestrictionHolder The transfer restriction holder PDA as ["trh", transferRestrictionData, holderId].
  * @param transferRestrictionData The Transfer Restriction data initialized for securityToken
  * @param accessControlAccount Access Control Account
  * @param authorityWalletRole The authority's wallet role account for permission check
  * @param authority Wallet which signs the transaction. Must be Transfer or Wallets Admin
  * @param payer Wallet which pays account rent. Can be different from authority
  * @param systemProgram Solana System Program which is required for new on-chain account data initialization
  */
.initializeTransferRestrictionHolder(holderId)
  .accountsStrict({
    transferRestrictionHolder,
    transferRestrictionData,
    accessControlAccount,
    authorityWalletRole,
    authority,
    payer,
    systemProgram,
  })
```

```typescript
/**
  * @dev A convenience method for initializing the holder group.
  * @accounts
  * @param holderGroup The transfer restriction holderGroup PDA as ["trhg", holder, groupId].
  * @param transferRestrictionData The Transfer Restriction data initialized for securityToken
  * @param group The transfer restriction group PDA
  * @param holder The transfer restriction holder PDA as ["trh", transferRestrictionData, holderId].
  * @param authorityWalletRole The authority's wallet role account for permission check
  * @param authority Wallet which signs the transaction. Must be Transfer or Wallets Admin
  * @param payer Wallet which pays account rent. Can be different from authority
  * @param systemProgram Solana System Program which is required for new on-chain account data initialization
  */
.initializeHolderGroup()
  .accountsStrict({
    holderGroup,
    transferRestrictionData,
    group,
    holder,
    authorityWalletRole,
    authority,
    payer,
    systemProgram,
  })
```

```typescript
/**
  * @dev A convenience method for initializing the security associated account.
  * @param groupId The transfer group ID to assign to the wallet
  * @param holderId The holder ID to associate with the wallet
  * @accounts
  * @param securityAssociatedAccount The security associated account PDA as ["saa", associatedTokenAccount].
  * @param group The desired group account PDA linked with groupId to set for the address.
  * @param holder The holder account PDA linked with holderId
  * @param holderGroup The holder group account linking holder to group
  * @param securityToken The Token 22 address
  * @param transferRestrictionData The Transfer Restriction data initialized for securityToken
  * @param userWallet The wallet address to associate
  * @param associatedTokenAccount The user's associated token account
  * @param authorityWalletRole The authority's wallet role account for permission check
  * @param authority Wallet which signs the transaction. Must be Transfer or Wallets Admin
  * @param payer Wallet which pays account rent. Can be different from authority
  * @param systemProgram Solana System Program which is required for new on-chain account data initialization
  */
initializeSecurityAssociatedAccount(groupId, holderId)
  .accountsStrict({
    securityAssociatedAccount,
    group,
    holder,
    holderGroup,
    securityToken,
    transferRestrictionData,
    userWallet,
    associatedTokenAccount,
    authorityWalletRole,
    authority,
    payer,
    systemProgram,
  })
```

```typescript
/**
  * @dev Sets address permission (group and freeze status) for a wallet.
  * This instruction can be used for both new and existing wallets.
  * For new wallets, it initializes the security associated account and links it to an existing holder.
  * For existing wallets, it can update the group and/or freeze status.
  * @param groupId The transfer group ID to assign to the wallet
  * @param frozen Whether the wallet should be frozen (true) or unfrozen (false)
  * @accounts
  * @param securityAssociatedAccount The security associated account PDA as ["saa", associatedTokenAccount]
  * @param transferRestrictionGroupNew The new transfer restriction group PDA
  * @param transferRestrictionGroupCurrent Optional: Current transfer restriction group PDA (required for existing wallets)
  * @param transferRestrictionHolder The holder account PDA
  * @param holderGroupNew The new holder group PDA
  * @param holderGroupCurrent Optional: Current holder group PDA (required for existing wallets)
  * @param securityToken The Token 22 address
  * @param transferRestrictionData The Transfer Restriction data initialized for securityToken
  * @param userWallet The wallet address to set permissions for
  * @param userAssociatedTokenAccount The user's associated token account
  * @param authorityWalletRole The authority's wallet role account
  * @param accessControlAccount Access Control Account
  * @param payer Wallet which pays transaction fee. Can be different from authority
  * @param authority Wallet which signs the transaction. Must have either Transfer Admin or Wallets Admin role.
  * @param systemProgram Solana System Program which is required for new on-chain account data initialization
  */
.setAddressPermission(groupId, frozen)
  .accountsStrict({
    securityAssociatedAccount,
    transferRestrictionGroupNew,
    transferRestrictionGroupCurrent: null, // Optional for new wallets
    transferRestrictionHolder,
    holderGroupNew,
    holderGroupCurrent: null, // Optional for new wallets
    securityToken,
    transferRestrictionData,
    userWallet,
    userAssociatedTokenAccount,
    authorityWalletRole,
    accessControlAccount,
    payer,
    authority,
    systemProgram,
  })
```

## WARNING: Maximum Total Supply, Minting and Burning of Tokens

The variable `maxTotalSupply` is set when the contract is created and limits the total number of tokens that can be minted.

**Reserve Admins can mint tokens to and burn tokens from any address. This is primarily to comply with law enforcement, regulations and stock issuance scenarios - but this centralized power could be abused. Transfer Admins, authorized by Contract Admins, can also update the transfer rules at any moment in time as many times as they want.**

**Important:** The `mintSecurities` instruction requires that the destination wallet has a security associated account (SAA) initialized before minting. This ensures all recipients have proper transfer restrictions set up. The only exception is when minting to the lockup escrow account (if configured), which is allowed without a SAA. For all other destinations, the security associated account must be initialized using `initializeSecurityAssociatedAccount`, `setAddressPermission`, or `initializeDefaultSecurityAccounts` before tokens can be minted.

## Overview of Transfer Restriction Enforcement Functions

| From                                 | To                                                        | Restrict                                                                                          | Enforced By                                                                                                  | Admin Role                                                                                |
| :----------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| Reg D/S/CF                           | Anyone                                                    | Until TimeLock ends                                                                               | `mintReleaseSchedule(investorAddress, balanceReserved, commencementTime, scheduleId, cancelableByAddresses)` | Reserve Admin                                                                                 |
| Reg S Group                          | US Accredited                                             | Forbidden During Flowback Restriction Period                                                      | `initializeTransferRule(fromGroupS, toGroupD, afterTime)`                                                     | Transfer Admin                                                                            |
| Reg S Group                          | Reg S Group                                               | Forbidden Until Shorter Reg S TimeLock Ended                                                      | `initializeTransferRule(fromGroupS, toGroupS, afterTime)`                                                     | Transfer Admin                                                                            |
| Issuer                               | Reg CF with > maximum number of total holders allowed     | Forbid transfers increasing number of total Holders (across all groups) above a certain threshold | `setHolderMax(maxAmount)`                                                                                    | Transfer Admin                                                                            |
| Issuer                               | Reg CF with > maximum number of Holders per group allowed | Forbid transfers increasing number of total Holders (within each group) above a certain threshold | `setHolderGroupMax(transferGroupID, maxAmount)`                                                              | Transfer Admin                                                                            |
| Stolen Tokens                        | Anyone                                                    | Fix With Freeze, Burn, Reissue                                                                    | `freezeWallet();`<br /> `burnSecurities(address, amount);`<br />`mintSecurities(newOwnerAddress);`                | Wallets Admin or Transfer Admin can `freezeWallet()` and Reserve Admin can do `mintSecurities()` `burnSecurities()` |
| Any Address During Regulatory Freeze | Anyone                                                    | Forbid all transfers while paused                                                                 | `pause(isPausedFlag)`                                                                                        | Transfer Admin                                                                            |
| Any Address During Regulatory Freeze | Anyone                                                    | Unpause from a paused state                                                             | `pause(isPausedFlag)`                                                                                        | Transfer Admin                                                                            |
| Anyone                               | Anyone                                                    | Force the transfer of tokens for emergencies                                                      | `forceTransferBetween(sender, recipient, amount)`                                                            | Reserve Admin                                                                              |

# Roles

The smart contract enforces specific admin roles. The roles divide responsibilities to reduce abuse vectors and create checks and balances. Ideally each role should be managed by a separate admin with separate key control.

In some cases, such as for the Contract Admin or Wallets Admin, it is recommended that the role's private key is managed through multi-signature (e.g. requiring 2 of 3 or N of M approvers) authentication.

### Admin Types

The Admin functionality breaks down into 4 main roles. The contract is configured to expect these wallets. In the contract constructor:

- **Contract Admin**
  - Akin to root level access administrator. Can upgrade internal contract dependencies (ie `RestrictedSwap`, `TransferRules`) or grant Admin permissions. Recommended to be a secure multi-sig wallet.
- **Reserve Admin**
  - Receives initial tranche of minted tokens from deployment. Also can adjust the supply of tokens by minting or burning or forcibly initiate transfers.

Via granted roles (from **Contract Admin**):

- **Transfer Admin**
  - Can set transfer restriction permissions/rules between groups or invoke snapshots.
  - **Transfer Admin** capabilities are a superset of those of **Wallets Admin**.
- **Wallets Admin**
  - Can manage Holder/Wallet transfer group assignments.

Typically any legal entity third-party Transfer Agent will need access to both the roles for **Transfer Admin** and **Wallets Admin**. However some agents (such as exchanges) will, for example, be able to assign groups to wallets and permission them (as a **Wallets Admin**) but will not be able to adjust the transfer rules.

## Admin Functionality

| Function                   | Contract Admin | Reserve Admin | Transfer Admin | Wallets Admin |
| -------------------------- | -------------- | ------------- | -------------- | ------------- |
| upgradeTransferRules()     | **yes**        | no            | no             | no            |
| grantRole()                 | **yes**        | no            | no             | no            |
| revokeRole()                | **yes**        | no            | no             | no            |
| newDistributor()           | **yes**        | no            | **yes**        | no            |
| proposeReclaimer()        | **yes**        | no            | no             | no            |
| acceptReclaimerOwnership() | no             | no            | no             | no            |
| reclaimDividends()         | no             | no            | **yes**        | no            |
| mint()                     | no             | **yes**       | no             | no            |
| burn()                     | no             | **yes**       | no             | no            |
| forceTransferBetween()     | no             | **yes**       | no             | no            |
| pause() or unpause (ie pause(false)) | **yes** | no         | **yes**        | no            |
| setMaxTotalSuplly()        | no             | **yes**       | no             | no            |
| setAllowTransferRule()     | no             | no            | **yes**        | no            |
| setHolderMax()             | no             | no            | **yes**        | no            |
| setHolderGroupMax()        | no             | no            | **yes**        | no            |
| initializeTransferRule()    | no             | no            | **yes**        | no            |
| setAddressPermission()     | no             | no            | **yes**        | **yes**       |
| initializeDefaultSecurityAccounts() | no      | **yes**       | **yes**        | **yes**       |
| freezeWallet()             | no             | no            | **yes**        | **yes**       |
| thawWallet()               | no             | no            | **yes**        | **yes**       |
| setTransferGroup()         | no             | no            | **yes**        | **yes**       |
| createHolderFromAddress()  | no             | no            | **yes**        | **yes**       |
| appendHolderAddress()      | no             | no            | **yes**        | **yes**       |
| addHolderWithAddresses()   | no             | no            | **yes**        | **yes**       |
| revokeHolder()             | no             | no            | **yes**        | **yes**       |
| revokeHolderGroup()        | no             | no            | **yes**        | **yes**       |
| revokeSecurityAssociatedAccount() | no      | no            | **yes**        | **yes**       |
| createReleaseSchedule()    | **yes**        | **yes**       | **yes**        | **yes**       |
| mintReleaseSchedule()      | no             | **yes**       | no             | no            |

Note! Anyone can burn owned tokens by Solana SPL design

# Use Cases

## Initial RWA Deployment
```mermaid
sequenceDiagram
  autonumber
	actor Deployer
   participant AccessControlProgram
   participant TransferRestrictionsProgram

   actor TransferAdmin
   actor ReserveAdmin
   actor WalletsAdmin

  Deployer ->> AccessControlProgram: initializeAccessControl(...)
  Deployer ->> TransferRestrictionsProgram: initializeExtraAccountMetaList(...)
  Deployer ->> TransferRestrictionsProgram: initializeTransferRestrictionsData(...)

  Deployer ->> AccessControlProgram: grantRole(TransferAdmin, 8)
  Deployer ->> AccessControlProgram: grantRole(ReserveAdmin, 2)
  Deployer ->> AccessControlProgram: grantRole(WalletsAdmin, 4)

  TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionGroup(fromGroupId)
  TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionGroup(toGroupId)
  TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRule(fromGroup, toGroup)

  ReserveAdmin ->> AccessControlProgram: mintSecurities(reserveAdminAddress, amount)

  loop EITHER / OR for reserveAdminAddress and walletsAdminAddress
      TransferAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(address, walletTransferGroup), intializeHolder(address,id), initializeHolderGroup(address, groupId)
      WalletsAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(address, walletTransferGroup), intializeHolder(address,id), initializeHolderGroup(address, groupId)
  end

  ReserveAdmin ->>+ TransferRestrictionsProgram: createTransferCheckedWithTransferHookInstruction(walletsAdminAddress, amount)
  loop EITHER / OR
      TransferAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(investorAddress, walletTransferGroup), intializeHolder(address,id), initializeHolderGroup(address, groupId)
      WalletsAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(investorAddress, walletTransferGroup), intializeHolder(address,id), initializeHolderGroup(address, groupId)
  end

  WalletsAdmin ->> TransferRestrictionsProgram: createTransferCheckedWithTransferHookInstruction(investorAddress, amount)
  Token22 Program ->> TransferRestrictionsProgram: execute(from, to, value) // where transfer restrictions are enforced
```

1. AccessControl and TransferRestrictions programs are deployed first
2. Deployer initializes access control data, mint, transfer restrictions data. At the time of deployment, the deployer configures a separate Reserve Admin address, a Transfer Admin address, and a Wallets Admin address. This allows the reserve RWAs to be stored in cold storage since the treasury Reserve Admin address private keys are not needed for everyday use by the Transfer Admin.
2. The Transfer Admin initializes transfer groups with `initializeTransferRestrictionGroup(groupId)`
3. The Transfer Admin authorizes the transfer of tokens between account groups with `initializeTransferRestrictionGroup(fromGroup, toGroup, afterTimestamp)` .
4. The Reserve Admin then provisions a Wallets Admin address for distributing tokens to investors or other stakeholders. The Wallets Admin uses `initializeTransferRestrictionHolder(investorAddress, holderId)`, `initializeHolderGroup(investorAddress, group)``initializeSecurityAssociatedAccount(investorAddress, transferGroup)` to set address restrictions.
5. The Reserve Admin then transfers tokens to the Wallets Admin address.
6. The Wallets Admin then transfers tokens to Investors or other stakeholders who are entitled to tokens.

## Revoke Holder
To redeem reserved SOL used for rent-exempt space allocation, you can utilize the `revoke*` methods. It is crucial to revoke accounts in the following sequence:

1. *Revoke Security-Associated Accounts*: Revoke all security-associated accounts for the specified holder.
2. *Revoke Holder Group Accounts*: Revoke all holder group accounts for the specified holder and associated groups.
3. *Revoke the Holder*: Finally, revoke the holder account.

A holder can only be revoked if it is not linked to any group or security-associated account. This condition is met when both `current_wallets_count` and `current_holder_group_count` are zero.


# Setup For Separate Issuer Private Key Management Roles

By default the reserve tokens cannot be transferred to. To allow transfers the Transfer Admin or Wallets Admin must configure transfer rules using both `updateTransferRestrictionGroup(transferGroup)` to configure the individual account rules and `initialzeTransferRule/updateTransferRule(account, groupFrom, groupTo)` to configure transfers between accounts in a group. A group represents a category like US accredited investors (Reg D) or foreign investors (Reg S).

During the setup process to split transfer oversight across three private key holders, the Transfer Admin can setup rules that only allow the Reserve Admin group to **only** transfer tokens to the Wallets Admin address group. The Wallets Admin should be restricted to a limited maximum balance necessary for doing one batch of token distributions - rather than the whole reserve. The use of a hot wallet Wallets Admin for small balances also makes everyday token administration easier without exposing the issuer's reserve of tokens to the risk of total theft in a single transaction. Each of these private keys may also be managed with a multi-sig solution for added security.

Multi-sig is especially important for the token Reserve Admin and Contract Admin.

Here is how these restricted Admin accounts can be configured:

1. Transfer Admin, Reserve Admin and Wallets Admin accounts are managed by separate users with separate keys. For example, separate Nano Ledger X hardware wallets.
2. Reserve and Wallets Admin addresses can have their own separate transfer groups.
   - `updateWalletGroup(reserveAdminAddress, reserveAdminTransferGroup)`
   - `updateWalletGroup(walletsAdminAddress, walletsAdminTransferGroup)`
3. Reserve Address Group can only transfer to Wallets Admin Groups after a certain Timestamp.
   - `initializeTransferRule(reserveAdminTransferGroup, walletsAdminTransferGroup, afterTimestamp)`
4. Wallets Admin Address can transfer to investor groups like Reg D and Reg S after a certain Timestamp.
   - `initializeTransferRule(walletsAdminTransferGroup, regD_TransferGroup, afterTimestamp)`
   - `initializeTransferRule(walletsAdminTransferGroup, regS_TransferGroup, afterTimestamp)`

Then the Wallets Admin can distribute tokens to investors and stakeholders as described below...

## Issuing the Token To AML / KYC'd Recipients

```mermaid
sequenceDiagram
  autonumber
  actor Investor
  actor TransferAdmin

  participant TransferRestrictionsProgram
  participant Token22

  actor WalletsAdmin

  Investor ->> TransferAdmin: send AML/KYC and accreditation info
  TransferAdmin ->> TransferRestrictionsProgram: setHolderMax(maxAmount)
  loop
    TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionHolder(...)
    TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionGroup(walletsAdminAddress, walletsAdminGroup...)
    TransferAdmin ->> TransferRestrictionsProgram: setTransferGroup(walletsAdminAddress, walletsAdminGroup...)
    TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionGroup(investorAddress, investorAdminGroup...)
    TransferAdmin ->> TransferRestrictionsProgram: initializeSecurityAssociatedAccount(investorAddress, holder, investorAdminGroup...)
    TransferAdmin ->> TransferRestrictionsProgram: initializeTransferRestrictionRule(walletsAdminGroup, investorAdminGroup...)
  end
  WalletsAdmin ->> Token22: transfer(investorAddress, amount)
  Token22 ->> TransferRestrictionsProgram: execute(from, to, value)
  Note right of TransferRestrictionsProgram: This enforce transfer restrictions on Token22 transfer hook
```

1. The Transfer Admin gathers AML/KYC and accreditation information from investors and stakeholders who will receive tokens directly from the Issuer (the Primary Issuance).
1. (optional) set the Holder max if desired
1. Transfer Admin configures approved Transfer Group for Wallets Admin.
1. Transfer Admin then configures approved Transfer Groups for Investor and stakeholders with `initializeSecurityAssociatedAccount(address, holder, transferGroup)`. Based on the AML/KYC and accreditation process the investor can provision the account address with:

   a) a transfer group designating a regulatory class like "Reg D", "Reg CF" or "Reg S"

   b) the freeze status of that address (with true meaning the account will be frozen from activity)]

1. The Transfer Admin then must allow transfers between groups with `initializeTransferRestrictionRule(walletsAdminGroup, investorAdminGroup...)`

1. The tokens can then be transferred from the Issuer's wallet to the provisioned addresses.

1. Transfer Restrictions are detected.

Note that there are no transfers initially authorized between groups. By default no transfers are allowed between groups - all transfer groups are restricted.

## Lockup Periods

Lockup periods are enforced via:

- `initializeTransferRule(fromGroup, toGroup, unixTimestamp)` or `setAllowTransferRule(fromGroup, toGroup, unixTimestamp)` allows transfers from one Transfer Group to another after the unixTimestamp. If the unixTimestamp is 0, then no transfer is allowed.

## Maximum Number of Holders Allowed

By default Transfer Groups cannot receive token transfers. To receive tokens the issuer gathers AML/KYC information and then calls `initializeSecurityAssociatedAccount(groupId, holderId)`.

A single Holder may have unlimited Wallet addresses. This cannot be altered. The Issuer can only configure the maximum number of **Holders** allowed (via Transfer Admin) by calling `setHolderMax`. By default, this limit is set to `2**64-1`.

`setHolderMax(amount)`

## Maximum Number of Holders Allowed Per Group

Transfer Admin can configure the maximum number of allowed Holders **per group** by calling `setHolderGroupMax`. By default, the `holderGroupMax` for each group is set to 0, meaning that it won't be applied as a restriction.

Group 0 (the default Holder group) is the only group for which the holder group max variable cannot be applied (an unlimited number of Group 0 Holders are allowed in perpetuity).

`setHolderGroupMax(groupID, amount)`

## `initializeTransferRestrictionGroup`

`initializeTransferRestrictionGroup` is used to create new transfer group like US accredited investors (Reg D) or foreign investors (Reg S).

## `initializeSecurityAssociatedAccount`

`initializeSecurityAssociatedAccount` is usually used after KYC/AML verification to activate a particular wallet for transfers.
Usualy used with `initializeTransferRestricitionHolder` and `initializeHolderGroup` if it is a new holder or new group for existing holder.

## `setAddressPermission`

`setAddressPermission` is a unified instruction that can be used to set address permissions (group and freeze status) for both new and existing wallets. For new wallets, it initializes the security associated account and links it to an existing holder. For existing wallets, it can update the group and/or freeze status. This instruction provides a more flexible alternative to `initializeSecurityAssociatedAccount` when working with existing holders.

## `initializeDefaultSecurityAccounts`

`initializeDefaultSecurityAccounts` is a convenience instruction that combines three separate initialization operations into a single transaction:
1. Initialize Holder - Creates a new holder account using the next available holder ID
2. Initialize Holder Group - Links the holder to group 0 (default group)
3. Initialize Security Associated Account - Creates the security associated account for a user's token account

This instruction simplifies the process of setting up a new wallet with default security settings by automatically assigning the next available holder ID and placing the holder in group 0. The payer can be different from the authority wallet.

**Solana Web3 TS call:**
```typescript
await program.methods
  .initializeDefaultSecurityAccounts(holderId)
  .accountsStrict({
    transferRestrictionHolder: holderPda,
    holderGroup: holderGroupPda,
    securityAssociatedAccount: securityAssociatedAccountPda,
    group: group0Pubkey,
    securityToken: securityMint,
    transferRestrictionData: transferRestrictionDataPubkey,
    userWallet: userWallet.publicKey,
    associatedTokenAccount: userTokenAccount,
    authorityWalletRole: authorityWalletRolePda,
    payer: payer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([authority, payer])
  .rpc({ commitment });
```

**Prerequisites:**
- Security token mint must be initialized
- Access control must be initialized
- Transfer restrictions data must be initialized
- **Group 0 must be initialized** (using `initializeTransferRestrictionGroup`)
- The user must have an associated token account created

**Benefits:**
- Reduced transaction costs: Single transaction instead of three
- Simplified client code: Less complexity in the frontend
- Consistent defaults: Ensures new wallets are always placed in group 0
- Atomic operation: All three initializations succeed or fail together
- Automatic ID assignment: No need to track and pass holder IDs manually

**Authorization:**
Only Reserve Admin, Transfer Admin, or Wallets Admin can call this instruction.

## `initialializeTransferRule`

`initializeTransferRule` is used to create new transfer rule for 2 specified groups where `..groupFrom` for senders and `..groupTo` for reveivers

## Timelock Cancellations and Transfers

In order to skip enforcement of transfer restrictions for tokenlock contract escrow account we can call `setLockupEscrowAccount(escrowAddress)`.
If we do not do that Escrow address will be processed as usual investor account which enforces additional transfer restrictions on cancelTimelock (escrow -> reclaimer and escrow -> timelock recipient) and transferTimelock (escrow -> recipient)

**Note:** Timelock accounts are now reallocated on change rather than allocated with maximum size on initialization. This improves efficiency by only allocating space as needed when adding new timelocks or cancelables. The account size is dynamically adjusted based on the actual data requirements.

### Cancel Timelock

In the case of cancellations, the transfer restrictions must be enabled between the initial target recipient and the reclaimTo address designated by the canceler.

Timelocks can be configured to be cancelled by a specific canceler address. This canceler can designate a separate reclaim address to receive the locked token portion of the remaining timelock, pending allowed group transfers as described above. The remaining unlocked portion will be transferred directly to the initial target recipient of the original vesting.

### Transfer Timelock

For unlocked tokens within a timelock, the initial target recipient can choose to transfer unlocked tokens directly to another recipient. This is a convenience atop the typical transfer method.

In the case of a timelock transfer, the initial target recipient must also be in a group able to transfer tokens to the new recipient.

## Example Transfer Restrictions

### Example: Investors Can Trade With Other Investors In The Same Group (e.g. Reg S)

To allow trading in a group:

- Call `updateWalletGroup(address, transferGroup)` for trader Wallets in the group
- `initializeTransferRule(fromGroupX, toGroupX, groupTimeLock)` for Wallets associated with groupIDs (for example, Reg S)
- A token transfer for an allowed group will succeed if:
  - the recipient of a token transfer does not result in a total holder count in a given group that exceeds the defined `holderGroupMax` (if configured, ie `holderGroupMax` set to > 0)
  - the recipient of a token transfer does not result in a total global holder count that exceeds the defined `holderMax`

### Example: Avoiding Flowback of Reg S "Foreign" Assets

To allow trading between Foreign Reg S account addresses but forbid flow back to US Reg D account addresses until the end of the Reg D lockup period

- Call `updateWalletGroup(address, groupIDForRegS)` to configure settings for Reg S investors
- Call `updateWalletGroup(address, groupIDForRegD)` to configure settings for Reg D investors
- `initializeTransferRule(groupIDForRegS, groupIDForRegS, addressTimelock)` allow Reg S trading
- A token transfer for between allowed groups will succeed if:
  - the `addressTimelock` time has passed; and
  - the recipient of a token transfer is not frozen (ie `freezeStatus` is `false`).

### Example: Exchanges Can Register Omnibus Accounts

Centralized exchanges can register custody addresses using the same method as other users. They contact the Issuer to provision accounts and the Transfer Admin or Wallets Admin calls `initializeTransferRestrictionHolder()`, `initializeHolderGroup()`, `initializeSecurityAssociatedAccount(groupId, holderId)` for the exchange account.

When customers of the exchange want to withdraw tokens from the exchange account they must withdraw into an account that the Transfer Admin has provisioned for them with `initializeSecurityAssociatedAccount(groupId, holderId)`.

Talk to a lawyer about when exchange accounts may or may not exceed the maximum number of holders allowed for a token.

## Group 0 Transfer Restrictions

In general, it is possible to allow Group 0 transfers. They are configurable in the same way that other transfer restrictions across different groups can be configured. This allowance is required for certain real-world situations. For example, if all tokens are freely tradeable under Reg A+ or a public filing, then Group 0 transfers can be allowed.

## Transfers Can Be Paused To Comply With Regulatory Action

If there is a regulatory issue with the token, all transfers may be paused by the Transfer Admin calling `pause()`. During normal functioning of the contract `pause()` should never need to be called.

The `pause()` mechanism has been implemented into the `TransferRestrictions` and `Dividends` program.

## Law Enforcement Recovery of Stolen Assets

In the case of stolen assets with sufficient legal reason to be returned to their owner, the issuer can call `freezeWallet()` (Wallets Admin, Transfer Admin), `burnSecurities()`, and `mintSecurities()` (Reserve Admin) to transfer the assets to the appropriate account.

Although this is not in the spirit of a cryptocurrency, it is available as a response to requirements that some regulators impose on blockchain RWA projects.

## Asset Recovery In The Case of Lost Keys

In the case of lost keys with sufficient legal reason to be returned to their owner, the issuer can call `freezeWallet()`, `burnSecurities()`, and `mintSecurities()` to transfer the assets to the appropriate account. This opens the issuer up to potential cases of fraud. Handle with care.

Once again, although this is not in the spirit of a cryptocurrency, it is available as a response to requirements that some regulators impose on blockchain RWA projects.

# Lockup

A "vesting" smart contract that can implement token lockup with scheduled release and distribution:

- Can enforce a scheduled release of tokens (e.g. investment lockups)
- Smart contract enforced lockup schedules are used to control the circulating supply and can be an important part of tokenomics.
- Some lockups are cancelable - such as employee vestings. When canceled, unlocked tokens remain in the recipients account address and locked tokens are returned to an address specified by the administrator that has an appropriate transfer group to receive the tokens.

Note that tokens in lockups cannot be burned by admins to avoid significant complexity.

## mintReleaseSchedule

Release schedules can be only minted directly to timelock by the Reserve Admin. In this case, as it is akin to token minting, it does not have to adhere to transfer restrictions, and is purely under the discretion of the Reserve Admin.

This is described in `mint_release_schedule.rs`.

## Vesting Schedule Creation & Timelock Funding

Vesting schedules are created independently of any specific timelock. Timelocks reference schedules to control the release of funds for a recipient starting on a specific commencement date.

### Vesting Schedule Creation Code

A vesting schedule can be created with a call to the Solana program like this.

**Solana Web3 JS call:**
```typescript
await program.methods
  .createReleaseSchedule(
    uuid,
    releaseCount,
    new anchor.BN(delayUntilFirstReleaseInSeconds),
    initialReleasePortionInBips,
    new anchor.BN(periodBetweenReleasesInSeconds),
  )
  .accountsStrict({
    tokenlockAccount: tokenlockDataPubkey,
    authority: signer.publicKey,
    authorityWalletRole: authorityWalletRolePubkey,
    accessControl: accessControlPubkey,
  })
  .signers([signer])
  .rpc({ commitment });
```

### Timelock Cancelation

Timelocks can be cancelable (like stock vesting plans) or non-cancelable (like investor lockups).

**Solana Web3 JS call:**
```typescript
const cancelTimelockInstruction = program.instruction.cancelTimelock(
  timelockId,
  {
    accounts: {
      tokenlockAccount: tokenlockDataPubkey,
      timelockAccount,
      escrowAccount: escrowAccount,
      pdaAccount: escrowOwnerPubkey,
      target,
      targetAssoc,
      authority: signer.publicKey,
      reclaimer: reclaimerTokenAccountPubkey,
      mintAddress: mintPubkey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      transferRestrictionsProgram:
        transferRestrictionsProgram.programId,
      securityAssociatedAccountFrom,
      securityAssociatedAccountTo,
      transferRule: transferRulePubkey,
    },
    signers: [signer],
  }
);

// Due to the nature of transfer hooks we are required to add extra account metas for each inner transfer of `cancelTimelock` instruction.
await addExtraAccountMetasForExecute(
  connection,
  cancelTimelockInstruction,
  transferHook.programId,
  escrowAccount,
  mintPubkey,
  reclaimerTokenAccountPubkey,
  escrowOwnerPubkey,
  anyAmount,
);
await addExtraAccountMetasForExecute(
  connection,
  cancelTimelockInstruction,
  transferHook.programId,
  escrowAccount,
  mintPubkey,
  targetAssoc,
  escrowOwnerPubkey,
  anyAmount,
);

// increase compute units in order to cover all load during instruction execution
const modifyComputeUnitsInstruction =
  ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000,
  });

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    ...[modifyComputeUnitsInstruction, cancelTimelockInstruction]
  ),
  [signer],
  { commitment }
);
```

### Transfers

**Transfer unlocked balances from all timelocks**

Called by the recipient.
```typescript
const transferInstruction = program.instruction.transfer(new anchor.BN(amount), {
  accounts: {
    tokenlockAccount,
    timelockAccount,
    escrowAccount,
    pdaAccount: escrowOwnerPubkey,
    authority: signer.publicKey,
    to: recipientAccount,
    mintAddress: mintPubkey,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    transferRestrictionsProgram: transferRestrictionsHelper.program.programId,
    authorityAccount,
    securityAssociatedAccountFrom,
    securityAssociatedAccountTo,
    transferRule: transferRulePubkey,
  },
  signers: [signer],
});

// it is required to add transfer hook information for inner transaction (for transferFrom as well)
await addExtraAccountMetasForExecute(
    connection,
    transferInstruction,
    transferHookProgramId,
    escrowAccount,
    mintPubkey,
    recipientAccount,
    escrowOwnerPubkey,
    BigInt(amount),
    commitment
  );

// increase compute units in order to cover all load during instruction execution
const modifyComputeUnitsInstruction =
  ComputeBudgetProgram.setComputeUnitLimit({
    units: 400000,
  });

return sendAndConfirmTransaction(
  connection,
  new Transaction().add(modifyComputeUnitsInstruction, transferInstruction),
  [signer],
  { commitment: "confirmed" }
);
```

# Access Control

Access Control Program implements roles `grant_role`, `revoke_role` and ownership under admin RWA functions: `mintSecurities`, `burnSecurities`, `freezeWallet`, `thawWallet`, `forceTransferbetween`. This is similar to the linux file permission bitmask exposed in the `chmod` command line function.

Our implementation uses binary bitmask determine the access control roles for an address. This optimizes the compute units usage and the size of the smart contract code itself.

## How it works

We use a `u8` binary representation of a number, such as `01010101` to represent the roles IDs within the access controls.

Roles are defined by a specific bit position in the bit storage representation.

As example decimal 1 is `00000001` in binary mode, 2 is `00000010`, 3 is `00000011`, 4 is `00000100`, 7 is `00000111` etc.

We describe the roles in use as:

```rust
#[repr(u8)]
pub enum Roles {
    ContractAdmin = 1,  // 0001
    ReserveAdmin = 2,   // 0010
    WalletAdmin = 4,    // 0100
    TransferAdmin = 8,  // 1000
    All = 15,           // 1000
}
```

If you want to use the unused bits in the future to add new roles you can add something like

```rust
NewRole = 16;     // 000010000
SecondRole = 32;  // 000100000
All = 63;         // 000111111
...etc
```

You can grant multiple roles by adding the role number values together to get the correct bitmask representation like this:

```rust
WalletAndTransferAdmin = 12; // 0001100
```

or
```rust
const WALLET_AND_TRANSFER_ADMIN_ROLE: u8 = Roles::WalletsAdmin as u8 | Roles::TransferAdmin as u8; // 0001100
```

For manipulating binary numbers you can use binary operators \*&, | and ^.

Example:

```rust
const WALLET_AND_TRANSFER_ADMIN_ROLE: u8 = Roles::WalletsAdmin as u8 | Roles::TransferAdmin as u8;

some_number & WALLETS_ADMIN_ROLE > 0 // checking if some_number contains 0100 bit, it can be used for checking the role
```

The contract implements simple methods to manipulate Access Controls and check the roles. Note that granting new and revoking existing roles must be done in separate transactions.

```rust
 fn grant_role(u8 role)

 fn revoke_role(u8 role)
```

### Grant Role

Grants a role to a wallet address. The instruction can be called by Contract Admin only. If the wallet role account doesn't exist, it will be created automatically. If the wallet already has the role, the instruction will fail. The payer can be different from the authority.

**Solana Web3 TS call:**
```typescript
await program.methods
  .grantRole(role)
  .accountsStrict({
    walletRole: walletRolePubkey,
    authorityWalletRole: authorityWalletRolePubkey, // Derived from authority
    accessControl: accessControlPubkey,
    securityToken: securityMintPubkey,
    userWallet: userWallet.publicKey,
    authority: signer.publicKey, // Must be Contract Admin (signer)
    payer: payer.publicKey, // Can be different from authority
    systemProgram: SystemProgram.programId,
  })
  .signers([authority, payer])
  .rpc({ commitment });
```

### Revoke Role

Revokes a role from a wallet address. The instruction can be called by Contract Admin only. The wallet role account must exist and the wallet must have the role being revoked. The payer is the signer and must be the Contract Admin (the authority_wallet_role is derived from the payer).

**Solana Web3 TS call:**
```typescript
await program.methods
  .revokeRole(role)
  .accountsStrict({
    walletRole: walletRolePubkey,
    authorityWalletRole: authorityWalletRolePubkey, // Derived from payer
    accessControl: accessControlPubkey,
    securityToken: securityMintPubkey,
    userWallet: userWallet.publicKey,
    payer: signer.publicKey, // Must be Contract Admin (signer)
    systemProgram: SystemProgram.programId,
  })
  .signers([signer])
  .rpc({ commitment });
```

# Appendix

## Roles Matrix

Admin permissions are defined with the following binary values. Roles are defined as the `OR` of a set of admin roles:

Contract Admin: `0001`
Reserve Admin: `0010`
Wallets Admin: `0100`
Transfer Admin: `1000`

| Role Integer | Admin Roles                                     | Bit Mask Representation |
| ------------ | ----------------------------------------------- | ----------------------- |
| 0            | None (Default)                                  | `0000`                    |
| 1            | Contract Admin                                  | `0001`                    |
| 2            | Reserve Admin                                   | `0010`                    |
| 3            | Contract Admin + Reserve Admin                  | `0011`                    |
| 4            | Wallets Admin                                   | `0100`                    |
| 5            | Contract Admin + Wallets Admin                  | `0101`                    |
| 6            | Reserve Admin + Wallets Admin                   | `0110`                    |
| 7            | Contract Admin + Reserve Admin + Wallets Admin  | `0111`                    |
| 8            | Transfer Admin                                  | `1000`                    |
| 9            | Contract Admin + Transfer Admin                 | `1001`                    |
| 10           | Reserve Admin + Transfer Admin                  | `1010`                    |
| 11           | Contract Admin + Reserve Admin + Transfer Admin | `1011`                    |
| 12           | Wallets Admin + Transfer Admin                  | `1100`                    |
| 13           | Contract Admin + Wallets Admin + Transfer Admin | `1101`                    |
| 14           | Reserve Admin + Wallets Admin + Transfer Admin  | `1110`                    |
| 15           | All Roles (Contract, Reserve, Wallets, Transfer)| `1111`                    |

## Post-Deployment Configuration

After smart contract deployment, there are certain configurations to complete before token issuance and trading can occur smoothly.

1. Grant Transfer Admin Role

    This is important so that an admin exists which can configure group transfers.

1. Allow Group Transfers

    The Transfer Admin can then allow group transfers, for example between all traders within Group 1. This will allow transfers to occur between all traders placed in Group 1.

    This is important so that transfers of tokens are enabled between designated groups.

1. Whitelist Program Derived Address (PDA)

    The Transfer Admin can then set the group of the PDA address itself.

    It is important that group transfers are allowed between PDA and recipients. This is necessary to take into account during integration RWA with your Program.
    Tokenlockup program escrow account must be whitelisted with `setLockupEscrowAccount()`

```mermaid
sequenceDiagram
Title: Post-Deployment Configuration
  ContractAdmin->>AccessControlProgram: 1. grantRole(TransferAdmin_Address, 8)
  AccessControlProgram->>TransferAdmin: Role is granted
  TransferAdmin->>TransferRestrictionProgram: 2. initializeTransferGroup(1)
  TransferAdmin->>TransferRestrictionProgram: 3. initializeTransferRule(1, 1, 1)
  TransferAdmin->>TransferRestrictionProgram: 4. initializeTransferRestrictionHolder(Token_Address, 1)
  TransferAdmin->>TransferRestrictionProgram: 5. initializeHolderGroup(Token_Address_HolderId, 1)
  TransferAdmin->>TransferRestrictionProgram: 6. initializeSecurityAssociatedAccount(Token_Address, 1)
  TransferAdmin->>TransferRestrictionProgram: 7. initializeTransferRestrictionHolder(ReserveAdmin_Address, 1)
  TransferAdmin->>TransferRestrictionProgram: 8. initializeHolderGroup(ReserveAdmin_Address_HolderId, 1)
  TransferAdmin->>TransferRestrictionProgram: 9. initializeSecurityAssociatedAccount(ReserveAdmin_Address, 1)
```

## Troubleshooting

To enable transfers between wallets, ensure that:

- both sender and recipient are placed into desired transfer groups (ie invoking `initializeSecurityAssociatedAccount(groupId, holderId)` or `updateWalletGroup(currentGroupId, newGroupId)`)
- these transfer groups have approved transfer restrictions (ie invoking `initializeTransferRule(transferGroupIdFrom, transferGroupIdTo, lockedUntil)`)
- sender has available tokens to be transferred

Note that `balance` property of AssociatedTokenAccount typically used by wallet providers (ie Phantom) will display wallet balance that includes the amount of simple tokens. Any locked, staked tokens are held by related Tokenlockup program escrow account.

# Program Deploy and Upgrade

The programs deployed are not immutable until they are marked as "final" (i.e., not upgradeable) on the Solana blockchain by the admin team. The upgrade authority has super power to change program.
In order to deploy not upgradable program use an option `--final` to use [BPFLoader2](https://explorer.solana.com/address/BPFLoader2111111111111111111111111111111111) at the deployment time (when --final is provided and the program will not be upgradeable).
If any changes are required to the finalized program (features, patches, etc…) the new program must be deployed to a new program ID.
To verify that program is not upgradable can be done on https://explorer.solana.com/ by checking Upgradeable property or not belong to *Owner: BPFLoaderUpgradeab1e11111111111111111111111U*

Otherwise program ownership, upgrades and changes must be shared with users.

# Dividends

Dividends program is based on [merkle-distributor program](https://github.com/saber-hq/merkle-distributor) but with access control and support of Token22. Note that the transfer fee extension must remain disabled in this implementation for Token22 as a payment token.
Dividends functionality provides the administrators of the Primary RWA the ability to make dividend distributions at certain points in time. Each moment of time is recorded as a Merkle tree root proof, total claim amount and number of nodes of a snapshot that captures the relative ownership of each token holder (invoking `newDistributor()` method manually by Contract Admin on the `Dividends` program). Snapshot and Merkle tree are built off-chain in advance and can be stored on IPFS or any other distributed storage. Dividends can be payed in any SPL or SPL 2022 standard tokens. The distributor creator can upload the IPFS hash containing the Merkle tree and all proofs for eligible claimants. It will allow anyone to obtain an on-chain link to the distribution information and claim it themselves.

Investor can claim only all dividends amount for one distribution in 1 instruction.

Anyone can `fundDividends` who owns dividends distribution tokens.

Investor can start claiming dividends as soon as treasury has enough balance to distribute with `readyToClaim` distributor parameters `true`.

See below for the Dividends payment distribution and claim flow utilizing USDC.

```mermaid
sequenceDiagram
    autonumber
    actor R as Recipient
    actor TA as Anyone
    actor CA as ContractAdmin

    participant D as DividendsContract

    CA ->> D: Invoke `newDistributor()` method to create new distribution (1)
    TA ->> D: Invoke `fundDividend()` for specific distribution (1) using USDC
    R ->> D: Invoke `claimDividend()` to claim dividend for distribution (1)
    D ->> R: Transfer dividend payment token
```

1. Contract Admin chooses to create new distribution to fund a dividend. Note that this is Contract Admin on the `AccessControl` data and Security mint. Each security mint has its own set of admins. A `distributor` account will be generated.

1. Anyone can fund the dividend using a payment token of specified distribution. This example uses USDC. The dividend must be funded for a specific `distributor`. Sender wallet must hold the payment token in order to fund the dividend. The payment token is extracted and sent to the `Distribution` PDA upon successful funding.

1. Recipient is free to claim the dividend by invoking `claimDividend` from the `Dividends` program. Note that claiming is available only when dividends treasury balance has enough tokens to distribute dividends to all investors.

1. Amount of entitled dividend token is transferred from the `Dividends` PDA to the rightful recipient.

## Security implication
**Please note:** *Anyone can create a RWA* with related Access Control data and a Distributor.

However, **someone might attempt to deceive the issuer** into funding dividends into fake accounts, which could result in **a loss of funds**.

Therefore, the issuer must use **a trusted service** to fund dividends or validate RWA address inside instruction to mitigate this risk.

## Relevant Methods

### New Distribution Creation Code

A new distribution can be created with a call to the Solana program like this.


**Solana Web3 TS call:**
```typescript
await program.methods
  .newDistributor(
    bump,
    toBytes32Array(rootProof),
    totalClaimAmount,
    numNodes,
    ipfsHash
  )
  .accountsStrict({
    base: baseKey.publicKey,
    distributor,
    mint: dividendsMintPubkey,
    authorityWalletRole,
    accessControl: accessControlPubkey,
    securityMint: securityMintPubkey,
    payer: signer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([signer, baseKey])
  .rpc({ commitment });
```

### Fund dividends

Anyone can fund dividends for specific distribution.

**Solana Web3 TS call:**
```typescript
await program.methods
  .fundDividends(amount)
  .accountsStrict({
    distributor,
    mint: dividendsMintPubkey,
    from: funderATA,
    to: distributorATA,
    funder: funderPublicKey,
    payer: signer.publicKey,
    tokenProgram: tokenProgramId,
  })
  .signers([funderKeypair, signer])
  .rpc({ commitment });
```

### Claim dividends

Recipient claim dividends by providing proof, index and amount.

**Solana Web3 TS call:**
```typescript
await program.methods
    .claim(claimBump, index, amount, proofBytes)
    .accountsStrict({
      distributor,
      claimStatus: claimStatusPubkey,
      from: distributorATA,
      to: claimantATA,
      claimant: claimant.publicKey,
      payer: payer.publicKey,
      mint: dividendsMintPubkey,
      tokenProgram: tokenProgramId,
      systemProgram: SystemProgram.programId,
    })
    .signers([claimant, payer])
    .rpc({ commitment });
```

### Propose reclaimer

Contract Admin can propose a new reclaimer wallet address for dividends using a 2-step ownership transfer process. This wallet will receive unclaimed dividends when the `reclaimDividends` instruction is invoked. The 2-step process prevents accidental loss of access by requiring the new owner to confirm they control the proposed address.

**Step 1: Propose reclaimer**

Contract Admin proposes a new reclaimer wallet address. This creates a pending ownership transfer that must be accepted by the proposed wallet.

**Solana Web3 TS call:**
```typescript
await program.methods
  .proposeReclaimer(newReclaimerWallet)
  .accountsStrict({
    reclaimer: reclaimerPubkey,
    accessControl: accessControlPubkey,
    authorityWalletRole: authorityWalletRolePubkey,
    securityMint: securityMintPubkey,
    authority: signer.publicKey,
    payer: signer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([signer])
  .rpc({ commitment });
```

**Step 2: Accept reclaimer ownership**

The proposed reclaimer wallet must accept the ownership transfer. This confirms that the new owner controls the proposed address and completes the transfer.

**Solana Web3 TS call:**
```typescript
await program.methods
  .acceptReclaimerOwnership()
  .accountsStrict({
    reclaimer: reclaimerPubkey,
    accessControl: accessControlPubkey,
    securityMint: securityMintPubkey,
    newOwner: newReclaimerWallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([newReclaimerWallet])
  .rpc({ commitment });
```

### Reclaim dividends

Transfer Admin can reclaim unclaimed dividends on behalf of a target wallet and send them to the reclaimer address. This is useful for recovering unclaimed dividends after a distribution period has ended. The reclaimer must be set using the 2-step process (`proposeReclaimer` followed by `acceptReclaimerOwnership`) before this instruction can be called.

**Solana Web3 TS call:**
```typescript
await program.methods
  .reclaimDividends(claimBump, index, amount, proofBytes)
  .accountsStrict({
    distributor,
    reclaimer: reclaimerPubkey,
    claimStatus: claimStatusPubkey,
    from: distributorATA,
    to: reclaimerATA,
    target: targetWallet.publicKey,
    payer: signer.publicKey,
    mint: dividendsMintPubkey,
    authorityWalletRole: authorityWalletRolePubkey,
    accessControl: accessControlPubkey,
    authority: signer.publicKey,
    systemProgram: SystemProgram.programId,
    tokenProgram: tokenProgramId,
  })
  .signers([signer])
  .rpc({ commitment });
```

## Reclaim Dividends Flow

The reclaim dividends flow allows Transfer Admins to recover unclaimed dividends and send them to a designated reclaimer address. This is useful when investors fail to claim their dividends within a specified period.

```mermaid
sequenceDiagram
    autonumber
    actor CA as ContractAdmin
    actor TA as TransferAdmin
    actor Investor

    participant DividendsContract
    participant Distributor

    CA ->> DividendsContract: proposeReclaimer(reclaimerWallet)
    Note right of DividendsContract: Reclaimer wallet is proposed
    reclaimerWallet ->> DividendsContract: acceptReclaimerOwnership()
    Note right of DividendsContract: Reclaimer wallet ownership is confirmed

    Investor ->> DividendsContract: claimDividend(index, amount, proof)
    DividendsContract ->> Investor: Transfer dividend payment token

    Note over Investor,TA: Some dividends remain unclaimed after claim period

    TA ->> DividendsContract: reclaimDividends(targetWallet, index, amount, proof)
    DividendsContract ->> DividendsContract: Verify merkle proof
    DividendsContract ->> DividendsContract: Mark as claimed
    DividendsContract ->> DividendsContract: Transfer to reclaimer address
    DividendsContract ->> TA: Reclaimed dividends sent to reclaimer
```

# Environment Setup

The environment is necessary to build and run tests of the project.

1. Install Anchor 0.32.1 from https://www.anchor-lang.com/docs/installation

## Build and test source code

### Build programs
```
$ anchor build
```

### Test programs
1. Generate payer if it doesn't exist yet
```
$ solana-keygen new
```
2. Run the functional and integration tests. First it builds and deploys the smart contract then tests are executed locally.
```
$ anchor test
```

# Deployment

## Programs
Generate key and airdrop SOL to the generated address. Than specify cluster and path to the keypair.
```
$ solana-keygen new --outfile PATH_TO_GENERATED_KEYPAIR
``` 
Airdrop or get some SOL to deploy programs (~20 SOL)
```
$ solana airdrop 20 PUBKEY --url CLUSTER_MONIKER_OR_RPC_URL
```
```
$ anchor deploy --provider.cluster CLUSTER --provider.wallet PATH_TO_KEYPAIR
```

## Mint and Progrmas Accounts
Generate or add data deployment keypair into `deploy/CLUSTER/deployer.json` file as buffer (for example: `[10, 20 .. 12]`).

Configure `config.ts` where specify
mint parameters: 
 - `decimals`
 - `name`
 - `symbol`
 - `uri` (logo)
tokenlock parameters:
 - `maxReleaseDelay`
 - `minTimelockAmount`
 - `space` (in bytes, it is recommended to set 1 Mb)
other parameters:
 - `maxHolders`
 - `maxTotalSupply`
 - `commitment`
 - `admins` (array of public keys and their role)

Configure RPC URL inside `.env` (copy `.env.example`) if it is different from default.
```
$ yarn deploy:CLUSTER
```

## Deployment Result
Deployment script generates mint.json with keypair and tokenlock-data-pubkey.json with public key.
Print information about deployment into console.

## Dividends data
Before deploying a new dividends distributor, the following steps are required:
1. Obtain Investor Balances:
- Capture investor balances for a specific block.
- Store the data in a CSV file with the format: `wallet_address, balance_amount_in_base_unit`.
1. Build and Upload the Merkle Tree:
Build the Merkle tree and upload it to IPFS. Use the following command to upload the Merkle tree:
```bash
ts-node deploy/dividends/upload-merkle-tree-to-ipfs.ts -f path_to_snapshot.csv
```
1. Configure the Distribution:
- Specify all parameters for the `config` object inside the `new-dividends-distribution.ts` script.
- Deploy the new dividends distribution using the following command:
```bash
ts-node deploy/new-dividends-distribution.ts --cluster localnet
```

# Client Generation (Codama)

This repository uses [Codama](https://github.com/codama-idl/codama) to generate type-safe clients from the Anchor IDL files. Generated clients are available for both JavaScript/TypeScript and Rust.

## Generated Packages

| Package | Language | Registry |
|---------|----------|----------|
| `@upsideos/solana-rwa` | JavaScript/TypeScript | npm |
| `upsideos-solana-rwa-client` | Rust | crates.io |

## Generate Clients

After building the Anchor programs, generate the clients:

```bash
# Build programs first (generates IDL files)
anchor build

# Generate Codama clients for all programs
pnpm generate:clients
# or
yarn generate:clients
```

This generates clients for all four programs:
- `access_control`
- `dividends`
- `tokenlock`
- `transfer_restrictions`

Generated files are placed in:
- JavaScript: `clients/js/src/generated/`
- Rust: `clients/rust/src/generated/`

## Build and Publish Clients

### JavaScript Client

```bash
# Build
pnpm clients:js:build

# Test
pnpm clients:js:test

# Publish to npm (requires npm login)
pnpm clients:js:publish
```

### Rust Client

```bash
# Build
pnpm clients:rust:build

# Test
pnpm clients:rust:test

# Publish to crates.io (requires cargo login)
pnpm clients:rust:publish
```

## Usage Examples

### JavaScript/TypeScript

```typescript
import { 
  accessControl, 
  dividends, 
  tokenlock, 
  transferRestrictions 
} from '@upsideos/solana-rwa';

// Use program instructions, accounts, types, etc.
const instruction = accessControl.instructions.grantRole({
  // ... parameters
});
```

### Rust

```rust
use upsideos_solana_rwa_client::{
    access_control,
    dividends,
    tokenlock,
    transfer_restrictions,
};

// Use program instructions, accounts, types, etc.
```

## Client Structure

Each program module exports:
- `accounts/` - Account type definitions and decoders
- `instructions/` - Instruction builders
- `errors/` - Program error definitions
- `types/` - Custom type definitions
- `programs/` - Program address and metadata