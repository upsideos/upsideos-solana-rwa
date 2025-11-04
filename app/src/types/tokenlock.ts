/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tokenlock.json`.
 */
export type Tokenlock = {
  address: "AoodM6rkg968933giHnigMEwp9kiGi68ZEx9bPqk71Gt";
  metadata: {
    name: "tokenlock";
    version: "0.2.0";
    spec: "0.1.0";
    description: "Vesting lockups for SPL tokens"
  };
  instructions: [
    {
      name: "cancelTimelock";
      discriminator: [
        158,
        180,
        47,
        81,
        133,
        231,
        168,
        238
      ];
      accounts: [
        {
          name: "tokenlockAccount"
        },
        {
          name: "timelockAccount";
          writable: true
        },
        {
          name: "escrowAccount";
          writable: true
        },
        {
          name: "pdaAccount"
        },
        {
          name: "authority";
          writable: true;
          signer: true
        },
        {
          name: "target";
          docs: [
            "with which will be linked timelocks"
          ];
          writable: true
        },
        {
          name: "reclaimer";
          writable: true
        },
        {
          name: "targetAssoc";
          writable: true
        },
        {
          name: "mintAddress"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "transferRestrictionsProgram";
          address: "6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ"
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
          name: "timelockId";
          type: "u32"
        }
      ]
    },
    {
      name: "createReleaseSchedule";
      discriminator: [
        244,
        168,
        39,
        240,
        234,
        71,
        104,
        108
      ];
      accounts: [
        {
          name: "tokenlockAccount";
          writable: true
        },
        {
          name: "authority";
          writable: true;
          signer: true
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "accessControl"
        }
      ];
      args: [
        {
          name: "uuid";
          type: {
            array: [
              "u8",
              16
            ]
          }
        },
        {
          name: "releaseCount";
          type: "u32"
        },
        {
          name: "delayUntilFirstReleaseInSeconds";
          type: "u64"
        },
        {
          name: "initialReleasePortionInBips";
          type: "u32"
        },
        {
          name: "periodBetweenReleasesInSeconds";
          type: "u64"
        }
      ]
    },
    {
      name: "initializeTimelock";
      discriminator: [
        47,
        125,
        243,
        32,
        170,
        86,
        24,
        243
      ];
      accounts: [
        {
          name: "tokenlockAccount"
        },
        {
          name: "timelockAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "tokenlockAccount"
              },
              {
                kind: "account";
                path: "targetAccount"
              }
            ]
          }
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "accessControl"
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
          name: "targetAccount";
          docs: [
            "with which will be linked timelocks"
          ]
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111"
        }
      ];
      args: []
    },
    {
      name: "initializeTokenlock";
      discriminator: [
        7,
        16,
        90,
        167,
        17,
        36,
        129,
        147
      ];
      accounts: [
        {
          name: "tokenlockAccount";
          writable: true
        },
        {
          name: "escrowAccount";
          writable: true
        },
        {
          name: "mintAddress"
        },
        {
          name: "transferRestrictionsData"
        },
        {
          name: "authorityWalletRole"
        },
        {
          name: "accessControl"
        },
        {
          name: "authority";
          writable: true;
          signer: true
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ];
      args: [
        {
          name: "maxReleaseDelay";
          type: "u64"
        },
        {
          name: "minTimelockAmount";
          type: "u64"
        }
      ]
    },
    {
      name: "mintReleaseSchedule";
      discriminator: [
        124,
        157,
        84,
        33,
        123,
        128,
        222,
        184
      ];
      accounts: [
        {
          name: "tokenlockAccount"
        },
        {
          name: "timelockAccount";
          writable: true
        },
        {
          name: "escrowAccount";
          writable: true
        },
        {
          name: "escrowAccountOwner";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  116,
                  111,
                  107,
                  101,
                  110,
                  108,
                  111,
                  99,
                  107
                ]
              },
              {
                kind: "account";
                path: "mintAddress"
              },
              {
                kind: "account";
                path: "tokenlockAccount"
              }
            ]
          }
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
          name: "authorityWalletRole"
        },
        {
          name: "accessControl"
        },
        {
          name: "mintAddress";
          writable: true
        },
        {
          name: "to";
          docs: [
            "with which will be linked timelocks"
          ]
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "accessControlProgram";
          address: "4X79YRjz9KNMhdjdxXg2ZNTS3YnMGYdwJkBHnezMJwr3"
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "uuid";
          type: {
            array: [
              "u8",
              16
            ]
          }
        },
        {
          name: "amount";
          type: "u64"
        },
        {
          name: "commencementTimestamp";
          type: "u64"
        },
        {
          name: "scheduleId";
          type: "u16"
        },
        {
          name: "cancelableBy";
          type: {
            vec: "pubkey"
          }
        }
      ]
    },
    {
      name: "transfer";
      discriminator: [
        163,
        52,
        200,
        231,
        140,
        3,
        69,
        186
      ];
      accounts: [
        {
          name: "tokenlockAccount"
        },
        {
          name: "timelockAccount";
          writable: true
        },
        {
          name: "escrowAccount";
          writable: true
        },
        {
          name: "pdaAccount"
        },
        {
          name: "authority";
          writable: true;
          signer: true
        },
        {
          name: "to";
          writable: true
        },
        {
          name: "mintAddress"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "transferRestrictionsProgram";
          address: "6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ"
        },
        {
          name: "authorityAccount"
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
          name: "value";
          type: "u64"
        }
      ]
    },
    {
      name: "transferTimelock";
      discriminator: [
        197,
        69,
        160,
        26,
        96,
        251,
        228,
        192
      ];
      accounts: [
        {
          name: "tokenlockAccount"
        },
        {
          name: "timelockAccount";
          writable: true
        },
        {
          name: "escrowAccount";
          writable: true
        },
        {
          name: "pdaAccount"
        },
        {
          name: "authority";
          writable: true;
          signer: true
        },
        {
          name: "to";
          writable: true
        },
        {
          name: "mintAddress"
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          name: "transferRestrictionsProgram";
          address: "6yEnqdEjX3zBBDkzhwTRGJwv1jRaN4QE4gywmgdcfPBZ"
        },
        {
          name: "authorityAccount"
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
          name: "value";
          type: "u64"
        },
        {
          name: "timelockId";
          type: "u32"
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
      name: "timelockData";
      discriminator: [
        166,
        255,
        48,
        254,
        36,
        155,
        55,
        132
      ]
    },
    {
      name: "tokenLockData";
      discriminator: [
        21,
        223,
        206,
        135,
        104,
        58,
        210,
        120
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
      name: "invalidTokenlockAccount";
      msg: "Invalid tokenlock account data"
    },
    {
      code: 6001;
      name: "maxReleaseDelayLessThanOne";
      msg: "Max release delay must be greater or equal to 1"
    },
    {
      code: 6002;
      name: "minTimelockAmountLessThanOne";
      msg: "Min timelock amount must be greater or equal to 1"
    },
    {
      code: 6003;
      name: "amountLessThanMinMintingAmount";
      msg: "Amount < min minting amount"
    },
    {
      code: 6004;
      name: "insufficientTokenLockDataSpace";
      msg: "Insufficient data space, Tokenlock account is full"
    },
    {
      code: 6005;
      name: "insufficientDataSpace";
      msg: "Insufficient data space, Timelock account is full"
    },
    {
      code: 6006;
      name: "invalidScheduleId";
      msg: "Invalid scheduleId"
    },
    {
      code: 6007;
      name: "perReleaseTokenLessThanOne";
      msg: "Per release token less than 1"
    },
    {
      code: 6008;
      name: "commencementTimeoutOfRange";
      msg: "Commencement time out of range"
    },
    {
      code: 6009;
      name: "initialReleaseTimeoutOfRange";
      msg: "Initial release out of range"
    },
    {
      code: 6010;
      name: "max10CancelableAddresses";
      msg: "Max 10 cancelableBy addressees"
    },
    {
      code: 6011;
      name: "invalidTimelockId";
      msg: "Invalid timelock id"
    },
    {
      code: 6012;
      name: "timelockHasntValue";
      msg: "Timelock has no value left"
    },
    {
      code: 6013;
      name: "hasntCancelTimelockPermission";
      msg: "Permission denied, address must be present in cancelableBy"
    },
    {
      code: 6014;
      name: "amountBiggerThanUnlocked";
      msg: "Amount bigger than unlocked"
    },
    {
      code: 6015;
      name: "amountMustBeBiggerThanZero";
      msg: "Amount must be bigger than zero"
    },
    {
      code: 6016;
      name: "badTransfer";
      msg: "Bad transfer"
    },
    {
      code: 6017;
      name: "firstReleaseDelayLessThanZero";
      msg: "First release delay < 0"
    },
    {
      code: 6018;
      name: "releasePeriodLessThanZero";
      msg: "Release Period < 0"
    },
    {
      code: 6019;
      name: "firstReleaseDelayBiggerThanMaxDelay";
      msg: "First release > max delay"
    },
    {
      code: 6020;
      name: "releaseCountLessThanOne";
      msg: "Release count less than 1"
    },
    {
      code: 6021;
      name: "initReleasePortionBiggerThan100Percent";
      msg: "Init release portion bigger than 100%"
    },
    {
      code: 6022;
      name: "releasePeriodZero";
      msg: "Release period is zero"
    },
    {
      code: 6023;
      name: "initReleasePortionMustBe100Percent";
      msg: "Init release portion must be 100%"
    },
    {
      code: 6024;
      name: "balanceIsInsufficient";
      msg: "Balance is insufficient!"
    },
    {
      code: 6025;
      name: "misMatchedToken";
      msg: "Mismatched token!"
    },
    {
      code: 6026;
      name: "misMatchedEscrow";
      msg: "Mismatched escrow account!"
    },
    {
      code: 6027;
      name: "hashAlreadyExists";
      msg: "Hash already exists!"
    },
    {
      code: 6028;
      name: "duplicatedCancelable";
      msg: "Duplicated cancelable!"
    },
    {
      code: 6029;
      name: "schedulesCountReachedMax";
      msg: "Schedules count reached maximium."
    },
    {
      code: 6030;
      name: "cancelablesCountReachedMax";
      msg: "Cancelables count reached maximium."
    },
    {
      code: 6031;
      name: "incorrectTokenlockAccount";
      msg: "Wrong tokenlock account."
    },
    {
      code: 6032;
      name: "incorrectEscrowAccount";
      msg: "Wrong escrow account"
    },
    {
      code: 6033;
      name: "unauthorized";
      msg: "unauthorized"
    },
    {
      code: 6034;
      name: "invalidAccessControlAccount";
      msg: "Invalid access control account"
    },
    {
      code: 6035;
      name: "invalidTransferRestrictionData";
      msg: "Invalid transfer restriction data"
    },
    {
      code: 6036;
      name: "invalidAccountOwner";
      msg: "Invalid account owner"
    },
    {
      code: 6037;
      name: "cantVestAllForMultipleReleases";
      msg: "Cannot vest all for multiple releases"
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
      name: "releaseSchedule";
      type: {
        kind: "struct";
        fields: [
          {
            name: "releaseCount";
            type: "u32"
          },
          {
            name: "delayUntilFirstReleaseInSeconds";
            type: "u64"
          },
          {
            name: "initialReleasePortionInBips";
            type: "u32"
          },
          {
            name: "periodBetweenReleasesInSeconds";
            type: "u64"
          },
          {
            name: "signerHash";
            type: {
              array: [
                "u8",
                20
              ]
            }
          }
        ]
      }
    },
    {
      name: "timelock";
      type: {
        kind: "struct";
        fields: [
          {
            name: "scheduleId";
            type: "u16"
          },
          {
            name: "commencementTimestamp";
            type: "u64"
          },
          {
            name: "tokensTransferred";
            type: "u64"
          },
          {
            name: "totalAmount";
            type: "u64"
          },
          {
            name: "cancelableByCount";
            type: "u8"
          },
          {
            name: "cancelableBy";
            type: {
              array: [
                "u8",
                10
              ]
            }
          },
          {
            name: "signerHash";
            type: {
              array: [
                "u8",
                20
              ]
            }
          }
        ]
      }
    },
    {
      name: "timelockData";
      type: {
        kind: "struct";
        fields: [
          {
            name: "tokenlockAccount";
            type: "pubkey"
          },
          {
            name: "targetAccount";
            type: "pubkey"
          },
          {
            name: "cancelables";
            type: {
              vec: "pubkey"
            }
          },
          {
            name: "timelocks";
            type: {
              vec: {
                defined: {
                  name: "timelock"
                }
              }
            }
          }
        ]
      }
    },
    {
      name: "tokenLockData";
      type: {
        kind: "struct";
        fields: [
          {
            name: "accessControl";
            type: "pubkey"
          },
          {
            name: "mintAddress";
            type: "pubkey"
          },
          {
            name: "escrowAccount";
            type: "pubkey"
          },
          {
            name: "transferRestrictionsData";
            type: "pubkey"
          },
          {
            name: "bumpSeed";
            type: "u8"
          },
          {
            name: "maxReleaseDelay";
            type: "u64"
          },
          {
            name: "minTimelockAmount";
            type: "u64"
          },
          {
            name: "releaseSchedules";
            type: {
              vec: {
                defined: {
                  name: "releaseSchedule"
                }
              }
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
