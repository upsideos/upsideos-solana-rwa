/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dividends.json`.
 */
export type Dividends = {
  address: "BvQwgkeevtxXrUsWtZU3fUu5R3qTYne2XfrQp8dXXut3";
  metadata: {
    name: "dividends";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Dividends are based on Merkle tree distribution"
  };
  instructions: [
    {
      name: "claim";
      docs: [
        "Claims tokens from the [MerkleDistributor]."
      ];
      discriminator: [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ];
      accounts: [
        {
          name: "distributor";
          docs: [
            "The [MerkleDistributor]."
          ];
          writable: true
        },
        {
          name: "claimStatus";
          docs: [
            "Status of the claim."
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  67,
                  108,
                  97,
                  105,
                  109,
                  83,
                  116,
                  97,
                  116,
                  117,
                  115
                ]
              },
              {
                kind: "arg";
                path: "index"
              },
              {
                kind: "account";
                path: "distributor"
              }
            ]
          }
        },
        {
          name: "from";
          docs: [
            "Distributor ATA containing the tokens to distribute."
          ];
          writable: true
        },
        {
          name: "to";
          docs: [
            "Account to send the claimed tokens to."
          ];
          writable: true
        },
        {
          name: "claimant";
          docs: [
            "Who is claiming the tokens."
          ];
          signer: true
        },
        {
          name: "payer";
          docs: [
            "Payer of the claim."
          ];
          writable: true;
          signer: true
        },
        {
          name: "mint"
        },
        {
          name: "systemProgram";
          docs: [
            "The [System] program."
          ];
          address: "11111111111111111111111111111111"
        },
        {
          name: "tokenProgram";
          docs: [
            "SPL [Token] program."
          ]
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8"
        },
        {
          name: "index";
          type: "u64"
        },
        {
          name: "amount";
          type: "u64"
        },
        {
          name: "proof";
          type: {
            vec: {
              array: [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      name: "fundDividends";
      docs: [
        "Fund dividend tokens to the [MerkleDistributor]."
      ];
      discriminator: [
        80,
        231,
        140,
        123,
        85,
        15,
        70,
        166
      ];
      accounts: [
        {
          name: "distributor";
          docs: [
            "The [MerkleDistributor]."
          ];
          writable: true
        },
        {
          name: "from";
          docs: [
            "Account which send the funding tokens."
          ];
          writable: true
        },
        {
          name: "to";
          docs: [
            "Distributor ATA containing the tokens to distribute."
          ];
          writable: true
        },
        {
          name: "funder";
          docs: [
            "Who is funding the tokens."
          ];
          signer: true
        },
        {
          name: "payer";
          docs: [
            "Payer of the fund dividends."
          ];
          writable: true;
          signer: true
        },
        {
          name: "mint"
        },
        {
          name: "tokenProgram";
          docs: [
            "SPL [Token] program."
          ]
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
      name: "newDistributor";
      docs: [
        "Creates a new [MerkleDistributor].",
        "After creating this [MerkleDistributor], the account should be seeded with tokens via its ATA."
      ];
      discriminator: [
        32,
        139,
        112,
        171,
        0,
        2,
        225,
        155
      ];
      accounts: [
        {
          name: "base";
          docs: [
            "Base key of the distributor."
          ];
          signer: true
        },
        {
          name: "distributor";
          docs: [
            "[MerkleDistributor]."
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  77,
                  101,
                  114,
                  107,
                  108,
                  101,
                  68,
                  105,
                  115,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  111,
                  114
                ]
              },
              {
                kind: "account";
                path: "base"
              }
            ]
          }
        },
        {
          name: "mint";
          docs: [
            "The mint to distribute."
          ]
        },
        {
          name: "authorityWalletRole";
          docs: [
            "Authority wallet role to create the distributor."
          ]
        },
        {
          name: "accessControl";
          docs: [
            "Access Control for Security Token."
          ];
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
              kind: "const";
              value: [
                52,
                73,
                111,
                144,
                68,
                201,
                194,
                136,
                142,
                176,
                110,
                98,
                34,
                243,
                63,
                165,
                30,
                161,
                45,
                199,
                24,
                46,
                67,
                87,
                76,
                194,
                73,
                243,
                192,
                121,
                138,
                252
              ]
            }
          }
        },
        {
          name: "securityMint";
          writable: true
        },
        {
          name: "payer";
          docs: [
            "Payer to create the distributor."
          ];
          writable: true;
          signer: true
        },
        {
          name: "systemProgram";
          docs: [
            "The [System] program."
          ];
          address: "11111111111111111111111111111111"
        }
      ];
      args: [
        {
          name: "bump";
          type: "u8"
        },
        {
          name: "root";
          type: {
            array: [
              "u8",
              32
            ]
          }
        },
        {
          name: "totalClaimAmount";
          type: "u64"
        },
        {
          name: "numNodes";
          type: "u64"
        },
        {
          name: "ipfsHash";
          type: "string"
        }
      ]
    },
    {
      name: "pause";
      docs: [
        "Pause the [MerkleDistributor]."
      ];
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
          name: "distributor";
          docs: [
            "The [MerkleDistributor]."
          ];
          writable: true
        },
        {
          name: "authorityWalletRole";
          docs: [
            "Authority wallet role to pause the distributor."
          ]
        },
        {
          name: "accessControl";
          docs: [
            "Access Control for Security Token."
          ]
        },
        {
          name: "authority";
          docs: [
            "Payer and authority to pause the distributor."
          ];
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
      name: "claimStatus";
      discriminator: [
        22,
        183,
        249,
        157,
        247,
        95,
        150,
        96
      ]
    },
    {
      name: "merkleDistributor";
      discriminator: [
        77,
        119,
        139,
        70,
        84,
        247,
        12,
        26
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
  events: [
    {
      name: "claimedEvent";
      discriminator: [
        144,
        172,
        209,
        86,
        144,
        87,
        84,
        115
      ]
    },
    {
      name: "fundedEvent";
      discriminator: [
        184,
        241,
        25,
        25,
        217,
        159,
        102,
        174
      ]
    }
  ];
  errors: [
    {
      code: 6000;
      name: "invalidProof";
      msg: "Invalid Merkle proof"
    },
    {
      code: 6001;
      name: "dropAlreadyClaimed";
      msg: "Drop already claimed"
    },
    {
      code: 6002;
      name: "exceededMaxClaim";
      msg: "Exceeded maximum claim amount"
    },
    {
      code: 6003;
      name: "exceededNumNodes";
      msg: "Exceeded maximum number of claimed nodes"
    },
    {
      code: 6004;
      name: "unauthorized";
      msg: "Account is not authorized to execute this instruction"
    },
    {
      code: 6005;
      name: "ownerMismatch";
      msg: "Token account owner did not match intended owner"
    },
    {
      code: 6006;
      name: "keysMustNotMatch";
      msg: "Keys must not match"
    },
    {
      code: 6007;
      name: "invalidFundingAmount";
      msg: "Invalid funding amount"
    },
    {
      code: 6008;
      name: "distributionPaused";
      msg: "Distribution is paused"
    },
    {
      code: 6009;
      name: "distributorNotReadyToClaim";
      msg: "Distributor is not ready to claim"
    },
    {
      code: 6010;
      name: "invalidIpfsHashSize";
      msg: "Invalid IPFS hash size"
    },
    {
      code: 6011;
      name: "valueUnchanged";
      msg: "The provided value is already set. No changes were made"
    },
    {
      code: 6012;
      name: "transferFeeIsNotAllowedForPaymentMint";
      msg: "Transfer fee is not allowed for payment mint"
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
      name: "claimStatus";
      docs: [
        "Holds whether or not a claimant has claimed tokens.",
        "",
        "TODO: this is probably better stored as the node that was verified."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "isClaimed";
            docs: [
              "If true, the tokens have been claimed."
            ];
            type: "bool"
          },
          {
            name: "claimant";
            docs: [
              "Authority that claimed the tokens."
            ];
            type: "pubkey"
          },
          {
            name: "claimedAt";
            docs: [
              "When the tokens were claimed."
            ];
            type: "i64"
          },
          {
            name: "amount";
            docs: [
              "Amount of tokens claimed."
            ];
            type: "u64"
          }
        ]
      }
    },
    {
      name: "claimedEvent";
      docs: [
        "Emitted when tokens are claimed."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "index";
            docs: [
              "Index of the claim."
            ];
            type: "u64"
          },
          {
            name: "claimant";
            docs: [
              "User that claimed."
            ];
            type: "pubkey"
          },
          {
            name: "amount";
            docs: [
              "Amount of tokens to distribute."
            ];
            type: "u64"
          }
        ]
      }
    },
    {
      name: "fundedEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "distributor";
            docs: [
              "Distribution which funded."
            ];
            type: "pubkey"
          },
          {
            name: "funder";
            docs: [
              "User that funded."
            ];
            type: "pubkey"
          },
          {
            name: "amount";
            docs: [
              "Amount of tokens funded."
            ];
            type: "u64"
          }
        ]
      }
    },
    {
      name: "merkleDistributor";
      docs: [
        "State for the account which distributes tokens."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "base";
            docs: [
              "Base key used to generate the PDA."
            ];
            type: "pubkey"
          },
          {
            name: "bump";
            docs: [
              "Bump seed."
            ];
            type: "u8"
          },
          {
            name: "root";
            docs: [
              "The 256-bit merkle root."
            ];
            type: {
              array: [
                "u8",
                32
              ]
            }
          },
          {
            name: "mint";
            docs: [
              "[Mint] of the token to be distributed."
            ];
            type: "pubkey"
          },
          {
            name: "totalClaimAmount";
            docs: [
              "Number of tokens that can be claimed from this [MerkleDistributor]."
            ];
            type: "u64"
          },
          {
            name: "numNodes";
            docs: [
              "Number of nodes that can be claimed from this [MerkleDistributor]."
            ];
            type: "u64"
          },
          {
            name: "totalAmountClaimed";
            docs: [
              "Total amount of tokens that have been claimed."
            ];
            type: "u64"
          },
          {
            name: "numNodesClaimed";
            docs: [
              "Number of nodes that have been claimed."
            ];
            type: "u64"
          },
          {
            name: "accessControl";
            docs: [
              "Access control for the [MerkleDistributor] and Security Token."
            ];
            type: "pubkey"
          },
          {
            name: "paused";
            docs: [
              "The [MerkleDistributor] is paused."
            ];
            type: "bool"
          },
          {
            name: "readyToClaim";
            docs: [
              "The [MerkleDistributor] is ready to claim."
            ];
            type: "bool"
          },
          {
            name: "ipfsHash";
            docs: [
              "IPFS hash of the serialized merkle tree."
            ];
            type: "string"
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
