/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/transfer_restrictions.json`.
 */
export type TransferRestrictions = {
  address: "6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ";
  metadata: {
    name: "transferRestrictions";
    version: "0.2.0";
    spec: "0.1.0";
    description: "Transfer restrictions for Solana tokens"
  };
  instructions: [
    {
      name: "enforceTransferRestrictions";
      discriminator: [
        77,
        50,
        36,
        109,
        250,
        175,
        122,
        22
      ];
      accounts: [
        {
          name: "sourceAccount"
        },
        {
          name: "mint"
        },
        {
          name: "destinationAccount"
        },
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "mint"
              }
            ]
          }
        },
        {
          name: "securityAssociatedAccountFrom";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "sourceAccount"
              }
            ]
          }
        },
        {
          name: "securityAssociatedAccountTo";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "destinationAccount"
              }
            ]
          }
        },
        {
          name: "transferRule";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "security_associated_account_from.group";
                account: "securityAssociatedAccount"
              },
              {
                kind: "account";
                path: "security_associated_account_to.group";
                account: "securityAssociatedAccount"
              }
            ]
          }
        }
      ];
      args: []
    },
    {
      name: "executeTransaction";
      docs: [
        "execute transfer hook"
      ];
      discriminator: [
        105,
        37,
        101,
        197,
        75,
        251,
        102,
        26
      ];
      accounts: [
        {
          name: "sourceAccount"
        },
        {
          name: "mint"
        },
        {
          name: "destinationAccount"
        },
        {
          name: "ownerDelegate"
        },
        {
          name: "extraMetasAccount";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                kind: "account";
                path: "mint"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData"
        },
        {
          name: "securityAssociatedAccountFrom"
        },
        {
          name: "securityAssociatedAccountTo"
        },
        {
          name: "transferRule"
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeDefaultSecurityAccounts";
      discriminator: [
        81,
        54,
        165,
        92,
        129,
        149,
        40,
        235
      ];
      accounts: [
        {
          name: "transferRestrictionHolder";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "arg";
                path: "id"
              }
            ]
          }
        },
        {
          name: "holderGroup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionHolder"
              },
              {
                kind: "const";
                value: [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          name: "securityAssociatedAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "associatedTokenAccount"
              }
            ]
          }
        },
        {
          name: "group";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "const";
                value: [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          name: "securityToken"
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "userWallet"
        },
        {
          name: "associatedTokenAccount";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "userWallet"
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  238,
                  117,
                  143,
                  222,
                  24,
                  66,
                  93,
                  188,
                  228,
                  108,
                  205,
                  218,
                  182,
                  26,
                  252,
                  77,
                  131,
                  185,
                  13,
                  39,
                  254,
                  189,
                  249,
                  40,
                  216,
                  161,
                  139,
                  252
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "holderId";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeExtraAccountMetaList";
      discriminator: [
        92,
        197,
        174,
        197,
        41,
        124,
        19,
        3
      ];
      accounts: [
        {
          name: "extraMetasAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              }
            ]
          }
        },
        {
          name: "securityMint"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "accessControl"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "initializeHolderGroup";
      discriminator: [
        236,
        173,
        120,
        20,
        217,
        85,
        57,
        26
      ];
      accounts: [
        {
          name: "holderGroup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "holder"
              },
              {
                kind: "account";
                path: "group.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "transfer_restriction_data.security_token_mint";
                account: "transferRestrictionData"
              }
            ]
          }
        },
        {
          name: "group";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "group.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "holder";
          writable: true
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "initializeSecurityAssociatedAccount";
      discriminator: [
        154,
        169,
        189,
        28,
        30,
        71,
        161,
        50
      ];
      accounts: [
        {
          name: "securityAssociatedAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "associatedTokenAccount"
              }
            ]
          }
        },
        {
          name: "group";
          writable: true
        },
        {
          name: "holder";
          writable: true
        },
        {
          name: "holderGroup";
          writable: true
        },
        {
          name: "securityToken"
        },
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "userWallet"
        },
        {
          name: "associatedTokenAccount";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "userWallet"
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  238,
                  117,
                  143,
                  222,
                  24,
                  66,
                  93,
                  188,
                  228,
                  108,
                  205,
                  218,
                  182,
                  26,
                  252,
                  77,
                  131,
                  185,
                  13,
                  39,
                  254,
                  189,
                  249,
                  40,
                  216,
                  161,
                  139,
                  252
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "groupId";
          type: "u64"
        },
        {
          name: "holderId";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeTransferRestrictionGroup";
      discriminator: [
        62,
        223,
        111,
        8,
        59,
        225,
        31,
        108
      ];
      accounts: [
        {
          name: "transferRestrictionGroup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "arg";
                path: "id"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "access_control_account.mint";
                account: "accessControl"
              }
            ]
          }
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "id";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeTransferRestrictionHolder";
      discriminator: [
        184,
        97,
        123,
        132,
        240,
        132,
        91,
        118
      ];
      accounts: [
        {
          name: "transferRestrictionHolder";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "arg";
                path: "id"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "access_control_account.mint";
                account: "accessControl"
              }
            ]
          }
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "id";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeTransferRestrictionsData";
      discriminator: [
        214,
        241,
        131,
        83,
        138,
        120,
        171,
        133
      ];
      accounts: [
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "mint"
              }
            ]
          }
        },
        {
          name: "zeroTransferRestrictionGroup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "const";
                value: [
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          name: "mint"
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ];
      args: [
        {
          name: "maxHolders";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeTransferRule";
      discriminator: [
        24,
        28,
        16,
        18,
        72,
        26,
        87,
        49
      ];
      accounts: [
        {
          name: "transferRule";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_from.id";
                account: "transferRestrictionGroup"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_to.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "access_control_account.mint";
                account: "accessControl"
              }
            ]
          }
        },
        {
          name: "transferRestrictionGroupFrom"
        },
        {
          name: "transferRestrictionGroupTo"
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "transferGroupIdFrom";
          type: "u64"
        },
        {
          name: "transferGroupIdTo";
          type: "u64"
        },
        {
          name: "lockUntil";
          type: "u64"
        }
      ]
    },
    {
      name: "pause";
      discriminator: [
        211,
        22,
        221,
        251,
        74,
        121,
        193,
        47
      ];
      accounts: [
        {
          name: "securityMint"
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              }
            ]
          }
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        }
      ];
      args: [
        {
          name: "paused";
          type: "bool"
        }
      ]
    },
    {
      name: "revokeHolder";
      discriminator: [
        250,
        238,
        38,
        18,
        138,
        55,
        227,
        111
      ];
      accounts: [
        {
          name: "holder";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "holder.id";
                account: "transferRestrictionHolder"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "transfer_restriction_data.security_token_mint";
                account: "transferRestrictionData"
              }
            ]
          }
        },
        {
          name: "authorityWalletRole";
          writable: true
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "revokeHolderGroup";
      discriminator: [
        33,
        153,
        183,
        187,
        204,
        120,
        164,
        40
      ];
      accounts: [
        {
          name: "holder";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "holder.id";
                account: "transferRestrictionHolder"
              }
            ]
          }
        },
        {
          name: "holderGroup";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "holder"
              },
              {
                kind: "account";
                path: "group.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "transfer_restriction_data.security_token_mint";
                account: "transferRestrictionData"
              }
            ]
          }
        },
        {
          name: "group";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "group.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "authorityWalletRole";
          writable: true
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "revokeSecurityAssociatedAccount";
      discriminator: [
        75,
        206,
        46,
        31,
        84,
        165,
        44,
        66
      ];
      accounts: [
        {
          name: "securityAssociatedAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "associatedTokenAccount"
              }
            ]
          }
        },
        {
          name: "group";
          writable: true
        },
        {
          name: "holder";
          writable: true
        },
        {
          name: "holderGroup";
          writable: true
        },
        {
          name: "securityToken"
        },
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "userWallet"
        },
        {
          name: "associatedTokenAccount";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "userWallet"
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  238,
                  117,
                  143,
                  222,
                  24,
                  66,
                  93,
                  188,
                  228,
                  108,
                  205,
                  218,
                  182,
                  26,
                  252,
                  77,
                  131,
                  185,
                  13,
                  39,
                  254,
                  189,
                  249,
                  40,
                  216,
                  161,
                  139,
                  252
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "setAddressPermission";
      discriminator: [
        206,
        98,
        48,
        240,
        226,
        102,
        10,
        236
      ];
      accounts: [
        {
          name: "securityAssociatedAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "userAssociatedTokenAccount"
              }
            ]
          }
        },
        {
          name: "transferRestrictionGroupNew";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "arg";
                path: "groupId"
              }
            ]
          }
        },
        {
          name: "transferRestrictionGroupCurrent";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "security_associated_account.group";
                account: "securityAssociatedAccount"
              }
            ]
          }
        },
        {
          name: "transferRestrictionHolder";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "transfer_restriction_holder.id";
                account: "transferRestrictionHolder"
              }
            ]
          }
        },
        {
          name: "holderGroupNew";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionHolder"
              },
              {
                kind: "arg";
                path: "groupId"
              }
            ]
          }
        },
        {
          name: "holderGroupCurrent";
          writable: true;
          optional: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "security_associated_account.holder";
                account: "securityAssociatedAccount"
              },
              {
                kind: "account";
                path: "security_associated_account.group";
                account: "securityAssociatedAccount"
              }
            ]
          }
        },
        {
          name: "securityToken"
        },
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "userWallet"
        },
        {
          name: "userAssociatedTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "userWallet"
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  238,
                  117,
                  143,
                  222,
                  24,
                  66,
                  93,
                  188,
                  228,
                  108,
                  205,
                  218,
                  182,
                  26,
                  252,
                  77,
                  131,
                  185,
                  13,
                  39,
                  254,
                  189,
                  249,
                  40,
                  216,
                  161,
                  139,
                  252
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "securityMint";
          writable: true
        },
        {
          name: "accessControlAccount";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  97,
                  99
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              }
            ];
            program: {
              kind: "account";
              path: "accessControlProgram"
            }
          }
        },
        {
          name: "accessControlProgram";
          address: "4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "groupId";
          type: "u64"
        },
        {
          name: "frozen";
          type: "bool"
        }
      ]
    },
    {
      name: "setAllowTransferRule";
      discriminator: [
        4,
        83,
        246,
        172,
        106,
        193,
        31,
        116
      ];
      accounts: [
        {
          name: "transferRule";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_from.id";
                account: "transferRestrictionGroup"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_to.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "access_control_account.mint";
                account: "accessControl"
              }
            ]
          }
        },
        {
          name: "transferRestrictionGroupFrom"
        },
        {
          name: "transferRestrictionGroupTo"
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        }
      ];
      args: [
        {
          name: "transferGroupIdFrom";
          type: "u64"
        },
        {
          name: "transferGroupIdTo";
          type: "u64"
        },
        {
          name: "lockedUntil";
          type: "u64"
        }
      ]
    },
    {
      name: "setHolderGroupMax";
      discriminator: [
        83,
        33,
        238,
        145,
        212,
        216,
        16,
        197
      ];
      accounts: [
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "mint"
              }
            ]
          }
        },
        {
          name: "mint"
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "group";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "group.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "payer";
          writable: true;
          signer: true
        }
      ];
      args: [
        {
          name: "groupId";
          type: "u64"
        },
        {
          name: "holderGroupMax";
          type: "u64"
        }
      ]
    },
    {
      name: "setHolderMax";
      discriminator: [
        254,
        104,
        250,
        53,
        13,
        151,
        2,
        161
      ];
      accounts: [
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "mint"
              }
            ]
          }
        },
        {
          name: "mint"
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        }
      ];
      args: [
        {
          name: "holderMax";
          type: "u64"
        }
      ]
    },
    {
      name: "setLockupEscrowAccount";
      discriminator: [
        134,
        172,
        249,
        223,
        25,
        118,
        55,
        93
      ];
      accounts: [
        {
          name: "transferRestrictionData";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "mint"
              }
            ]
          }
        },
        {
          name: "escrowSecurityAssociatedAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "escrowAccount"
              }
            ]
          }
        },
        {
          name: "mint"
        },
        {
          name: "accessControlAccount"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "escrowAccount"
        },
        {
          name: "tokenlockAccount"
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "authority";
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "updateWalletGroup";
      discriminator: [
        225,
        33,
        252,
        93,
        186,
        129,
        24,
        241
      ];
      accounts: [
        {
          name: "securityAssociatedAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  97,
                  97
                ]
              },
              {
                kind: "account";
                path: "userAssociatedTokenAccount"
              }
            ]
          }
        },
        {
          name: "securityToken"
        },
        {
          name: "transferRestrictionData";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  100
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "transferRestrictionGroupCurrent";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_current.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "transferRestrictionGroupNew";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  103
                ]
              },
              {
                kind: "account";
                path: "transferRestrictionData"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_new.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "holderGroupCurrent";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "security_associated_account.holder";
                account: "securityAssociatedAccount"
              },
              {
                kind: "account";
                path: "security_associated_account.group";
                account: "securityAssociatedAccount"
              }
            ]
          }
        },
        {
          name: "holderGroupNew";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  114,
                  104,
                  103
                ]
              },
              {
                kind: "account";
                path: "security_associated_account.holder";
                account: "securityAssociatedAccount"
              },
              {
                kind: "account";
                path: "transfer_restriction_group_new.id";
                account: "transferRestrictionGroup"
              }
            ]
          }
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "userWallet"
        },
        {
          name: "userAssociatedTokenAccount";
          pda: {
            seeds: [
              {
                kind: "account";
                path: "userWallet"
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  238,
                  117,
                  143,
                  222,
                  24,
                  66,
                  93,
                  188,
                  228,
                  108,
                  205,
                  218,
                  182,
                  26,
                  252,
                  77,
                  131,
                  185,
                  13,
                  39,
                  254,
                  189,
                  249,
                  40,
                  216,
                  161,
                  139,
                  252
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "newGroupId";
          type: "u64"
        }
      ]
    }
  ];
  accounts: [
    {
      name: "accessControl";
      discriminator: [
        147,
        81,
        178,
        92,
        223,
        66,
        181,
        132
      ]
    },
    {
      name: "holderGroup";
      discriminator: [
        136,
        231,
        252,
        48,
        92,
        187,
        25,
        164
      ]
    },
    {
      name: "securityAssociatedAccount";
      discriminator: [
        68,
        169,
        137,
        56,
        226,
        21,
        69,
        124
      ]
    },
    {
      name: "transferRestrictionData";
      discriminator: [
        166,
        184,
        205,
        98,
        165,
        224,
        174,
        148
      ]
    },
    {
      name: "transferRestrictionGroup";
      discriminator: [
        61,
        120,
        96,
        96,
        113,
        210,
        205,
        223
      ]
    },
    {
      name: "transferRestrictionHolder";
      discriminator: [
        196,
        226,
        112,
        46,
        157,
        122,
        48,
        157
      ]
    },
    {
      name: "transferRule";
      discriminator: [
        200,
        231,
        114,
        91,
        84,
        241,
        109,
        172
      ]
    },
    {
      name: "walletRole";
      discriminator: [
        219,
        71,
        35,
        217,
        102,
        248,
        173,
        9
      ]
    }
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorized";
      msg: "unauthorized"
    },
    {
      code: 6001;
      name: "maxHoldersReached";
      msg: "Max holders reached"
    },
    {
      code: 6002;
      name: "transferRuleNotAllowedUntilLater";
      msg: "Transfer rule not allowed until later"
    },
    {
      code: 6003;
      name: "invalidRole";
      msg: "Invalid role"
    },
    {
      code: 6004;
      name: "allTransfersPaused";
      msg: "All transfers are paused"
    },
    {
      code: 6005;
      name: "invalidPda";
      msg: "Invalid PDA"
    },
    {
      code: 6006;
      name: "balanceIsTooLow";
      msg: "Balance is too low"
    },
    {
      code: 6007;
      name: "currentWalletsCountMustBeZero";
      msg: "Current wallets count must be zero"
    },
    {
      code: 6008;
      name: "mismatchedEscrowAccount";
      msg: "Mismatched escrow account"
    },
    {
      code: 6009;
      name: "invalidHolderIndex";
      msg: "Invalid transfer restriction holder index"
    },
    {
      code: 6010;
      name: "maxHoldersReachedInsideTheGroup";
      msg: "Max holders reached inside the group"
    },
    {
      code: 6011;
      name: "transferGroupNotApproved";
      msg: "Transfer group not approved"
    },
    {
      code: 6012;
      name: "incorrectTokenlockAccount";
      msg: "Wrong tokenlock account"
    },
    {
      code: 6013;
      name: "transferRuleAccountDataIsEmtpy";
      msg: "Transfer rule account data is empty"
    },
    {
      code: 6014;
      name: "securityAssociatedAccountDataIsEmtpy";
      msg: "Security associated account data is empty"
    },
    {
      code: 6015;
      name: "transferRestrictionsAccountDataIsEmtpy";
      msg: "Transfer restrictions account data is empty"
    },
    {
      code: 6016;
      name: "noWalletsInGroup";
      msg: "No wallets in group"
    },
    {
      code: 6017;
      name: "newGroupIsTheSameAsTheCurrentGroup";
      msg: "New group is the same as the current group"
    },
    {
      code: 6018;
      name: "newHolderMaxMustExceedCurrentHolderCount";
      msg: "New holder max must exceed current holder count"
    },
    {
      code: 6019;
      name: "newHolderGroupMaxMustExceedCurrentHolderGroupCount";
      msg: "New holder group max must exceed current holder group count"
    },
    {
      code: 6020;
      name: "zeroGroupHolderGroupMaxCannotBeNonZero";
      msg: "Zero group holder group max cannot be non-zero"
    },
    {
      code: 6021;
      name: "nonPositiveHolderGroupCount";
      msg: "Non-positive holder group count"
    },
    {
      code: 6022;
      name: "currentHolderGroupCountMustBeZero";
      msg: "Current holder group count must be zero"
    },
    {
      code: 6023;
      name: "valueUnchanged";
      msg: "The provided value is already set. No changes were made"
    },
    {
      code: 6024;
      name: "currentGroupRequiredForExistingWallet";
      msg: "Current group and holder group must be provided for existing wallet"
    },
    {
      code: 6025;
      name: "holderGroupAlreadyInitialized";
      msg: "Holder group already initialized"
    }
  ];
  types: [
    {
      name: "accessControl";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey"
          },
          {
            name: "authority";
            type: "pubkey"
          },
          {
            name: "maxTotalSupply";
            type: "u64"
          },
          {
            name: "lockupEscrowAccount";
            type: {
              option: "pubkey"
            }
          }
        ]
      }
    },
    {
      name: "holderGroup";
      type: {
        kind: "struct";
        fields: [
          {
            name: "group";
            type: "u64"
          },
          {
            name: "holder";
            type: "pubkey"
          },
          {
            name: "currentWalletsCount";
            type: "u64"
          }
        ]
      }
    },
    {
      name: "securityAssociatedAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "group";
            type: "u64"
          },
          {
            name: "holder";
            type: {
              option: "pubkey"
            }
          }
        ]
      }
    },
    {
      name: "transferRestrictionData";
      type: {
        kind: "struct";
        fields: [
          {
            name: "securityTokenMint";
            type: "pubkey"
          },
          {
            name: "accessControlAccount";
            type: "pubkey"
          },
          {
            name: "currentHoldersCount";
            type: "u64"
          },
          {
            name: "holderIds";
            type: "u64"
          },
          {
            name: "maxHolders";
            type: "u64"
          },
          {
            name: "paused";
            type: "bool"
          },
          {
            name: "lockupEscrowAccount";
            type: {
              option: "pubkey"
            }
          }
        ]
      }
    },
    {
      name: "transferRestrictionGroup";
      type: {
        kind: "struct";
        fields: [
          {
            name: "id";
            type: "u64"
          },
          {
            name: "currentHoldersCount";
            type: "u64"
          },
          {
            name: "maxHolders";
            type: "u64"
          },
          {
            name: "transferRestrictionData";
            type: "pubkey"
          }
        ]
      }
    },
    {
      name: "transferRestrictionHolder";
      type: {
        kind: "struct";
        fields: [
          {
            name: "transferRestrictionData";
            type: "pubkey"
          },
          {
            name: "currentWalletsCount";
            type: "u64"
          },
          {
            name: "currentHolderGroupCount";
            type: "u64"
          },
          {
            name: "id";
            type: "u64"
          },
          {
            name: "active";
            type: "bool"
          }
        ]
      }
    },
    {
      name: "transferRule";
      type: {
        kind: "struct";
        fields: [
          {
            name: "transferRestrictionData";
            type: "pubkey"
          },
          {
            name: "transferGroupIdFrom";
            type: "u64"
          },
          {
            name: "transferGroupIdTo";
            type: "u64"
          },
          {
            name: "lockedUntil";
            type: "u64"
          }
        ]
      }
    },
    {
      name: "walletRole";
      type: {
        kind: "struct";
        fields: [
          {
            name: "owner";
            type: "pubkey"
          },
          {
            name: "accessControl";
            type: "pubkey"
          },
          {
            name: "role";
            type: "u8"
          }
        ]
      }
    }
  ]
};
