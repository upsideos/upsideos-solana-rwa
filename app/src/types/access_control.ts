/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/access_control.json`.
 */
export type AccessControl = {
  address: "4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3";
  metadata: {
    name: "accessControl";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Access Control for Solana Programs"
  };
  instructions: [
    {
      name: "burnSecurities";
      discriminator: [
        79,
        165,
        145,
        57,
        203,
        228,
        175,
        0
      ];
      accounts: [
        {
          name: "authority";
          signer: true
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              },
              {
                kind: "account";
                path: "authority"
              }
            ]
          }
        },
        {
          name: "accessControl";
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
            ]
          }
        },
        {
          name: "securityMint";
          writable: true
        },
        {
          name: "targetAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "targetAuthority"
              },
              {
                kind: "account";
                path: "tokenProgram"
              },
              {
                kind: "account";
                path: "securityMint"
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
          name: "targetAuthority"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
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
      name: "forceTransferBetween";
      discriminator: [
        186,
        115,
        85,
        7,
        217,
        111,
        254,
        108
      ];
      accounts: [
        {
          name: "sourceAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "sourceAuthority"
              },
              {
                kind: "account";
                path: "tokenProgram"
              },
              {
                kind: "account";
                path: "securityMint"
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
          name: "securityMint";
          writable: true
        },
        {
          name: "destinationAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "destinationAuthority"
              },
              {
                kind: "account";
                path: "tokenProgram"
              },
              {
                kind: "account";
                path: "securityMint"
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
          name: "authority";
          signer: true
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              },
              {
                kind: "account";
                path: "authority"
              }
            ]
          }
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
            ]
          }
        },
        {
          name: "sourceAuthority"
        },
        {
          name: "destinationAuthority"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
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
      name: "freezeWallet";
      discriminator: [
        93,
        202,
        159,
        167,
        22,
        246,
        255,
        211
      ];
      accounts: [
        {
          name: "authority";
          signer: true
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              },
              {
                kind: "account";
                path: "authority"
              }
            ]
          }
        },
        {
          name: "accessControl";
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
            ]
          }
        },
        {
          name: "securityMint";
          writable: true
        },
        {
          name: "targetAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "targetAuthority"
              },
              {
                kind: "account";
                path: "tokenProgram"
              },
              {
                kind: "account";
                path: "securityMint"
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
          name: "targetAuthority"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ];
      args: []
    },
    {
      name: "grantRole";
      discriminator: [
        218,
        234,
        128,
        15,
        82,
        33,
        236,
        253
      ];
      accounts: [
        {
          name: "walletRole";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              },
              {
                kind: "account";
                path: "userWallet"
              }
            ]
          }
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              },
              {
                kind: "account";
                path: "authority"
              }
            ]
          }
        },
        {
          name: "accessControl";
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
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "securityToken"
        },
        {
          name: "userWallet"
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
          name: "role";
          type: "u8"
        }
      ]
    },
    {
      name: "initializeAccessControl";
      discriminator: [
        244,
        90,
        245,
        242,
        199,
        224,
        247,
        140
      ];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true
        },
        {
          name: "authority"
        },
        {
          name: "mint";
          writable: true;
          signer: true
        },
        {
          name: "accessControl";
          writable: true;
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
                path: "mint"
              }
            ]
          }
        },
        {
          name: "walletRole";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "mint"
              },
              {
                kind: "account";
                path: "payer"
              }
            ]
          }
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
          name: "args";
          type: {
            defined: {
              name: "initializeAccessControlArgs"
            }
          }
        }
      ]
    },
    {
      name: "mintSecurities";
      discriminator: [
        90,
        195,
        58,
        36,
        142,
        195,
        14,
        225
      ];
      accounts: [
        {
          name: "authority";
          signer: true
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              },
              {
                kind: "account";
                path: "authority"
              }
            ]
          }
        },
        {
          name: "accessControl";
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
            ]
          }
        },
        {
          name: "securityMint";
          writable: true
        },
        {
          name: "destinationAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "destinationAuthority"
              },
              {
                kind: "account";
                path: "tokenProgram"
              },
              {
                kind: "account";
                path: "securityMint"
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
          name: "destinationAuthority"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "securityAssociatedAccount";
          docs: [
            "This account must be initialized before minting (holder, holder_group, and SAA must exist)",
            "Optional: Not required when minting to lockup_escrow_account, mandatory otherwise"
          ];
          optional: true
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
      name: "revokeRole";
      discriminator: [
        179,
        232,
        2,
        180,
        48,
        227,
        82,
        7
      ];
      accounts: [
        {
          name: "walletRole";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              },
              {
                kind: "account";
                path: "userWallet"
              }
            ]
          }
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityToken"
              },
              {
                kind: "account";
                path: "payer"
              }
            ]
          }
        },
        {
          name: "accessControl";
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
                path: "securityToken"
              }
            ]
          }
        },
        {
          name: "securityToken"
        },
        {
          name: "userWallet"
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
          name: "role";
          type: "u8"
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
          name: "accessControlAccount";
          writable: true;
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
                path: "mint"
              }
            ]
          }
        },
        {
          name: "mint"
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
        }
      ];
      args: []
    },
    {
      name: "setMaxTotalSupply";
      discriminator: [
        249,
        164,
        34,
        254,
        160,
        89,
        214,
        12
      ];
      accounts: [
        {
          name: "accessControlAccount";
          writable: true;
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
                path: "mint"
              }
            ]
          }
        },
        {
          name: "mint"
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
          name: "maxTotalSupply";
          type: "u64"
        }
      ]
    },
    {
      name: "thawWallet";
      discriminator: [
        79,
        251,
        128,
        221,
        55,
        172,
        181,
        221
      ];
      accounts: [
        {
          name: "authority";
          signer: true
        },
        {
          name: "authorityWalletRole";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  119,
                  97,
                  108,
                  108,
                  101,
                  116,
                  95,
                  114,
                  111,
                  108,
                  101
                ]
              },
              {
                kind: "account";
                path: "securityMint"
              },
              {
                kind: "account";
                path: "authority"
              }
            ]
          }
        },
        {
          name: "accessControl";
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
            ]
          }
        },
        {
          name: "securityMint";
          writable: true
        },
        {
          name: "targetAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "targetAuthority"
              },
              {
                kind: "account";
                path: "tokenProgram"
              },
              {
                kind: "account";
                path: "securityMint"
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
          name: "targetAuthority"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ];
      args: []
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
      name: "invalidRole";
      msg: "Invalid role"
    },
    {
      code: 6002;
      name: "mintExceedsMaxTotalSupply";
      msg: "Cannot mint more than max total supply"
    },
    {
      code: 6003;
      name: "incorrectTokenlockAccount";
      msg: "Wrong tokenlock account"
    },
    {
      code: 6004;
      name: "mismatchedEscrowAccount";
      msg: "Mismatched escrow account"
    },
    {
      code: 6005;
      name: "cantBurnSecuritiesWithinLockup";
      msg: "Cannot burn securities within lockup; cancel the lockup first"
    },
    {
      code: 6006;
      name: "cantForceTransferBetweenLockup";
      msg: "Cannot force transfer between lockup accounts"
    },
    {
      code: 6007;
      name: "newMaxTotalSupplyMustExceedCurrentTotalSupply";
      msg: "New max total supply must exceed current total supply"
    },
    {
      code: 6008;
      name: "cannotFreezeLockupEscrowAccount";
      msg: "Cannot freeze lockup escrow account"
    },
    {
      code: 6009;
      name: "valueUnchanged";
      msg: "The provided value is already set. No changes were made"
    },
    {
      code: 6010;
      name: "invalidSecurityAssociatedAccount";
      msg: "Invalid security associated account"
    },
    {
      code: 6011;
      name: "securityAssociatedAccountNotInitialized";
      msg: "Security associated account not initialized"
    },
    {
      code: 6012;
      name: "transferHookNotConfigured";
      msg: "Transfer hook not configured on mint"
    },
    {
      code: 6013;
      name: "securityAssociatedAccountRequired";
      msg: "Security associated account is required"
    },
    {
      code: 6014;
      name: "alreadyHasRole";
      msg: "Wallet already has this role"
    },
    {
      code: 6015;
      name: "cannotRevokeRole";
      msg: "Cannot revoke role that wallet does not have"
    },
    {
      code: 6016;
      name: "invalidAccessControl";
      msg: "Invalid access control"
    },
    {
      code: 6017;
      name: "invalidWalletRoleAccountOwner";
      msg: "Invalid wallet role account owner"
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
      name: "initializeAccessControlArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "decimals";
            type: "u8"
          },
          {
            name: "name";
            type: "string"
          },
          {
            name: "symbol";
            type: "string"
          },
          {
            name: "uri";
            type: "string"
          },
          {
            name: "hookProgramId";
            type: "pubkey"
          },
          {
            name: "maxTotalSupply";
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
