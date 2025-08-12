export type GumballGuard = {
  version: '1.0.0';
  name: 'gumball_guard';
  instructions: [
    {
      name: 'initialize';
      docs: ['Create a new gumball guard account.'];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'base';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'data';
          type: 'bytes';
        },
      ];
    },
    {
      name: 'draw';
      docs: [
        'Draw a prize from a gumball machine wrapped in the gumball guard.',
      ];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: false;
          isSigner: false;
          docs: ['Gumball Guard account.'];
        },
        {
          name: 'gumballMachineProgram';
          isMut: false;
          isSigner: false;
          docs: ['Gumball Machine program account.', ''];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Payer for the mint (SOL) fees.'];
        },
        {
          name: 'buyer';
          isMut: true;
          isSigner: true;
          docs: ['Minter account for validation and non-SOL fees.'];
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
          docs: ['Token Metadata program.', ''];
        },
        {
          name: 'splTokenProgram';
          isMut: false;
          isSigner: false;
          docs: ['SPL Token program.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['System program.'];
        },
        {
          name: 'sysvarInstructions';
          isMut: false;
          isSigner: false;
          docs: ['Instructions sysvar account.', ''];
        },
        {
          name: 'recentSlothashes';
          isMut: false;
          isSigner: false;
          docs: ['SlotHashes sysvar cluster data.', ''];
        },
        {
          name: 'gumballEventAuthority';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'mintArgs';
          type: 'bytes';
        },
        {
          name: 'label';
          type: {
            option: 'string';
          };
        },
      ];
    },
    {
      name: 'drawJellybean';
      docs: [
        'Draw a prize from a gumball machine wrapped in the gumball guard.',
      ];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: false;
          isSigner: false;
          docs: ['Gumball Guard account.'];
        },
        {
          name: 'jellybeanMachineProgram';
          isMut: false;
          isSigner: false;
          docs: ['Jellybean Machine program account.', ''];
        },
        {
          name: 'jellybeanMachine';
          isMut: true;
          isSigner: false;
          docs: ['Jellybean machine account.'];
        },
        {
          name: 'jellybeanMachineAuthorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Payer for the mint (SOL) fees.'];
        },
        {
          name: 'buyer';
          isMut: true;
          isSigner: true;
          docs: ['Minter account for validation and non-SOL fees.'];
        },
        {
          name: 'unclaimedPrizes';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'printFeeAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'Print fee account. Required if the jellybean machine has a print fee config.',
          ];
        },
        {
          name: 'splTokenProgram';
          isMut: false;
          isSigner: false;
          docs: ['SPL Token program.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['System program.'];
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
          docs: ['Rent.'];
        },
        {
          name: 'sysvarInstructions';
          isMut: false;
          isSigner: false;
          docs: ['Instructions sysvar account.', ''];
        },
        {
          name: 'recentSlothashes';
          isMut: false;
          isSigner: false;
          docs: ['SlotHashes sysvar cluster data.', ''];
        },
        {
          name: 'jellybeanEventAuthority';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'mintArgs';
          type: 'bytes';
        },
        {
          name: 'label';
          type: {
            option: 'string';
          };
        },
      ];
    },
    {
      name: 'route';
      docs: ['Route the transaction to a guard instruction.'];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'machine';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'RouteArgs';
          };
        },
        {
          name: 'label';
          type: {
            option: 'string';
          };
        },
      ];
    },
    {
      name: 'setAuthority';
      docs: ['Set a new authority of the gumball guard.'];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [
        {
          name: 'newAuthority';
          type: 'publicKey';
        },
      ];
    },
    {
      name: 'unwrap';
      docs: [
        'Remove a gumball guard from a gumball machine, setting the authority to the',
        'gumball guard authority.',
      ];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'gumballMachineAuthority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'gumballMachineProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'update';
      docs: ['Update the gumball guard configuration.'];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'machine';
          isMut: true;
          isSigner: false;
          docs: ['Machine account.'];
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'payer';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'data';
          type: 'bytes';
        },
      ];
    },
    {
      name: 'withdraw';
      docs: ['Withdraw the rent SOL from the gumball guard account.'];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'machine';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for authority pda if using token payment'];
        },
        {
          name: 'machineProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'wrap';
      docs: [
        'Add a gumball guard to a gumball machine. After the guard is added, mint',
        'is only allowed through the gumball guard.',
      ];
      accounts: [
        {
          name: 'gumballGuard';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'machine';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'machineProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'machineAuthority';
          isMut: false;
          isSigner: true;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: 'gumballGuard';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'base';
            type: 'publicKey';
          },
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'authority';
            type: 'publicKey';
          },
        ];
      };
    },
  ];
  types: [
    {
      name: 'AddressGate';
      docs: ['Guard that restricts access to a specific address.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'address';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'Allocation';
      docs: [
        'Gaurd to specify the maximum number of mints in a guard set.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Allocation tracker PDA. The PDA is derived',
        'using the seed `["allocation", allocation id,',
        'gumball guard pubkey, gumball machine pubkey]`.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            docs: ['Unique identifier of the allocation.'];
            type: 'u8';
          },
          {
            name: 'limit';
            docs: ['The limit of the allocation.'];
            type: 'u32';
          },
        ];
      };
    },
    {
      name: 'AllocationTracker';
      docs: ['PDA to track the number of mints.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'count';
            type: 'u32';
          },
        ];
      };
    },
    {
      name: 'AllowList';
      docs: [
        'Guard that uses a merkle tree to specify the addresses allowed to mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[]` Pda created by the merkle proof instruction (seeds `["allow_list", merke tree root,',
        'payer key, gumball guard pubkey, gumball machine pubkey]`).',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'merkleRoot';
            docs: ['Merkle root of the addresses allowed to mint.'];
            type: {
              array: ['u8', 32];
            };
          },
        ];
      };
    },
    {
      name: 'AllowListProof';
      docs: ['PDA to track whether an address has been validated or not.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'BotTax';
      docs: [
        'Guard is used to:',
        '* charge a penalty for invalid transactions',
        '* validate that the mint transaction is the last transaction',
        '* verify that only authorized programs have instructions',
        '',
        'The `bot_tax` is applied to any error that occurs during the',
        'validation of the guards.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'lamports';
            type: 'u64';
          },
          {
            name: 'lastInstruction';
            type: 'bool';
          },
        ];
      };
    },
    {
      name: 'EndDate';
      docs: ['Guard that sets a specific date for the mint to stop.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'date';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'Gatekeeper';
      docs: [
        'Guard that validates if the payer of the transaction has a token from a specified',
        'gateway network — in most cases, a token after completing a captcha challenge.',
        '',
        'List of accounts required:',
        '',
        '0. `[writeable]` Gatekeeper token account.',
        '1. `[]` Gatekeeper program account.',
        '2. `[]` Gatekeeper expire account.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'gatekeeperNetwork';
            docs: ['The network for the gateway token required'];
            type: 'publicKey';
          },
          {
            name: 'expireOnUse';
            docs: [
              'Whether or not the token should expire after minting.',
              'The gatekeeper network must support this if true.',
            ];
            type: 'bool';
          },
        ];
      };
    },
    {
      name: 'MintLimit';
      docs: [
        'Gaurd to set a limit of mints per wallet.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Mint counter PDA. The PDA is derived',
        'using the seed `["mint_limit", mint guard id, payer key,',
        'gumball guard pubkey, gumball machine pubkey]`.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'id';
            docs: ['Unique identifier of the mint limit.'];
            type: 'u8';
          },
          {
            name: 'limit';
            docs: ['Limit of mints per individual address.'];
            type: 'u16';
          },
        ];
      };
    },
    {
      name: 'MintCounter';
      docs: ['PDA to track the number of mints for an individual address.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'count';
            type: 'u16';
          },
        ];
      };
    },
    {
      name: 'NftBurn';
      docs: [
        'Guard that requires another NFT (token) from a specific collection to be burned.',
        '',
        'List of accounts required:',
        '',
        '0. `[writeable]` Token account of the NFT.',
        '1. `[writeable]` Metadata account of the NFT.',
        '2. `[writeable]` Master Edition account of the NFT.',
        '3. `[writeable]` Mint account of the NFT.',
        '4. `[writeable]` Collection metadata account of the NFT.',
        '5. `[writeable]` Token Record of the NFT (pNFT).',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'requiredCollection';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'NftGate';
      docs: [
        'Guard that restricts the transaction to holders of a specified collection.',
        '',
        'List of accounts required:',
        '',
        '0. `[]` Token account of the NFT.',
        '1. `[]` Metadata account of the NFT.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'requiredCollection';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'NftPayment';
      docs: [
        'Guard that charges another NFT (token) from a specific collection as payment',
        'for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writeable]` Token account of the NFT.',
        '1. `[writeable]` Metadata account of the NFT.',
        '2. `[]` Mint account of the NFT.',
        '3. `[]` Account to receive the NFT.',
        '4. `[writeable]` Destination PDA key (seeds [destination pubkey, token program id, nft mint pubkey]).',
        '5. `[]` spl-associate-token program ID.',
        '6. `[]` Master edition (pNFT)',
        '7. `[writable]` Owner token record (pNFT)',
        '8. `[writable]` Destination token record (pNFT)',
        '9. `[]` Token Authorization Rules program (pNFT)',
        '10. `[]` Token Authorization Rules account (pNFT)',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'requiredCollection';
            type: 'publicKey';
          },
          {
            name: 'destination';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'ProgramGate';
      docs: [
        'Guard that restricts the programs that can be in a mint transaction. The guard allows the',
        'necessary programs for the mint and any other program specified in the configuration.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'additional';
            type: {
              vec: 'publicKey';
            };
          },
        ];
      };
    },
    {
      name: 'RedeemedAmount';
      docs: [
        'Guard that stop the mint once the specified amount of items',
        'redeenmed is reached.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'maximum';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'SolPayment';
      docs: [
        'Guard that charges an amount in SOL (lamports) for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Account to receive the funds.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'lamports';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'StartDate';
      docs: ['Guard that sets a specific start date for the mint.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'date';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'ThirdPartySigner';
      docs: [
        'Guard that requires a specified signer to validate the transaction.',
        '',
        'List of accounts required:',
        '',
        '0. `[signer]` Signer of the transaction.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'signerKey';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'Token2022Payment';
      docs: [
        'Guard that charges an amount in a specified spl-token as payment for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Token account holding the required amount.',
        '1. `[writable]` Address of the ATA to receive the tokens.',
        '2. `[]` Mint account.',
        '3. `[]` SPL Token-2022 program account.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'mint';
            type: 'publicKey';
          },
          {
            name: 'destinationAta';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'TokenBurn';
      docs: [
        'Guard that requires addresses that hold an amount of a specified spl-token',
        'and burns them.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Token account holding the required amount.',
        '1. `[writable]` Token mint account.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'mint';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'TokenGate';
      docs: [
        'Guard that restricts access to addresses that hold the specified spl-token.',
        '',
        'List of accounts required:',
        '',
        '0. `[]` Token account holding the required amount.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'mint';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'TokenPayment';
      docs: [
        'Guard that charges an amount in a specified spl-token as payment for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Token account holding the required amount.',
        '1. `[writable]` Address of the ATA to receive the tokens.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'mint';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'RouteArgs';
      docs: ['Arguments for a route transaction.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'guard';
            docs: ['The target guard type.'];
            type: {
              defined: 'GuardType';
            };
          },
          {
            name: 'data';
            docs: ['Arguments for the guard instruction.'];
            type: 'bytes';
          },
        ];
      };
    },
    {
      name: 'GumballGuardData';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'default';
            type: {
              defined: 'GuardSet';
            };
          },
          {
            name: 'groups';
            type: {
              option: {
                vec: {
                  defined: 'Group';
                };
              };
            };
          },
        ];
      };
    },
    {
      name: 'Group';
      docs: [
        'A group represent a specific set of guards. When groups are used, transactions',
        'must specify which group should be used during validation.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'label';
            type: 'string';
          },
          {
            name: 'guards';
            type: {
              defined: 'GuardSet';
            };
          },
        ];
      };
    },
    {
      name: 'GuardSet';
      docs: ['The set of guards available.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'botTax';
            docs: [
              'Last instruction check and bot tax (penalty for invalid transactions).',
            ];
            type: {
              option: {
                defined: 'BotTax';
              };
            };
          },
          {
            name: 'startDate';
            docs: ['Start data guard (controls when minting is allowed).'];
            type: {
              option: {
                defined: 'StartDate';
              };
            };
          },
          {
            name: 'solPayment';
            docs: [
              'Sol payment guard (set the price for the mint in lamports).',
            ];
            type: {
              option: {
                defined: 'SolPayment';
              };
            };
          },
          {
            name: 'tokenPayment';
            docs: [
              'Token payment guard (set the price for the mint in spl-token amount).',
            ];
            type: {
              option: {
                defined: 'TokenPayment';
              };
            };
          },
          {
            name: 'thirdPartySigner';
            docs: [
              'Third party signer guard (requires an extra signer for the transaction).',
            ];
            type: {
              option: {
                defined: 'ThirdPartySigner';
              };
            };
          },
          {
            name: 'tokenGate';
            docs: [
              'Token gate guard (restrict access to holders of a specific token).',
            ];
            type: {
              option: {
                defined: 'TokenGate';
              };
            };
          },
          {
            name: 'gatekeeper';
            docs: ['Gatekeeper guard (captcha challenge).'];
            type: {
              option: {
                defined: 'Gatekeeper';
              };
            };
          },
          {
            name: 'endDate';
            docs: ['End date guard (set an end date to stop the mint).'];
            type: {
              option: {
                defined: 'EndDate';
              };
            };
          },
          {
            name: 'allowList';
            docs: ['Allow list guard (curated list of allowed addresses).'];
            type: {
              option: {
                defined: 'AllowList';
              };
            };
          },
          {
            name: 'mintLimit';
            docs: [
              'Mint limit guard (add a limit on the number of mints per wallet).',
            ];
            type: {
              option: {
                defined: 'MintLimit';
              };
            };
          },
          {
            name: 'nftPayment';
            docs: ['NFT Payment (charge an NFT in order to mint).'];
            type: {
              option: {
                defined: 'NftPayment';
              };
            };
          },
          {
            name: 'redeemedAmount';
            docs: [
              'Redeemed amount guard (add a limit on the overall number of items minted).',
            ];
            type: {
              option: {
                defined: 'RedeemedAmount';
              };
            };
          },
          {
            name: 'addressGate';
            docs: ['Address gate (check access against a specified address).'];
            type: {
              option: {
                defined: 'AddressGate';
              };
            };
          },
          {
            name: 'nftGate';
            docs: [
              'NFT gate guard (check access based on holding a specified NFT).',
            ];
            type: {
              option: {
                defined: 'NftGate';
              };
            };
          },
          {
            name: 'nftBurn';
            docs: ['NFT burn guard (burn a specified NFT).'];
            type: {
              option: {
                defined: 'NftBurn';
              };
            };
          },
          {
            name: 'tokenBurn';
            docs: ['Token burn guard (burn a specified amount of spl-token).'];
            type: {
              option: {
                defined: 'TokenBurn';
              };
            };
          },
          {
            name: 'programGate';
            docs: [
              'Program gate guard (restricts the programs that can be in a mint transaction).',
            ];
            type: {
              option: {
                defined: 'ProgramGate';
              };
            };
          },
          {
            name: 'allocation';
            docs: [
              'Allocation guard (specify the maximum number of mints in a group).',
            ];
            type: {
              option: {
                defined: 'Allocation';
              };
            };
          },
          {
            name: 'token2022Payment';
            docs: [
              'Token2022 payment guard (set the price for the mint in spl-token-2022 amount).',
            ];
            type: {
              option: {
                defined: 'Token2022Payment';
              };
            };
          },
        ];
      };
    },
    {
      name: 'MachineType';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Gumball';
          },
          {
            name: 'Jellybean';
          },
        ];
      };
    },
    {
      name: 'GuardType';
      docs: ['Available guard types.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'BotTax';
          },
          {
            name: 'StartDate';
          },
          {
            name: 'SolPayment';
          },
          {
            name: 'TokenPayment';
          },
          {
            name: 'ThirdPartySigner';
          },
          {
            name: 'TokenGate';
          },
          {
            name: 'Gatekeeper';
          },
          {
            name: 'EndDate';
          },
          {
            name: 'AllowList';
          },
          {
            name: 'MintLimit';
          },
          {
            name: 'NftPayment';
          },
          {
            name: 'RedeemedAmount';
          },
          {
            name: 'AddressGate';
          },
          {
            name: 'NftGate';
          },
          {
            name: 'NftBurn';
          },
          {
            name: 'TokenBurn';
          },
          {
            name: 'ProgramGate';
          },
          {
            name: 'Allocation';
          },
          {
            name: 'Token2022Payment';
          },
        ];
      };
    },
  ];
  events: [
    {
      name: 'PaymentEvent';
      fields: [
        {
          name: 'amount';
          type: 'u64';
          index: false;
        },
        {
          name: 'mint';
          type: 'publicKey';
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'InvalidAccountSize';
      msg: 'Could not save guard to account';
    },
    {
      code: 6001;
      name: 'DeserializationError';
      msg: 'Could not deserialize guard';
    },
    {
      code: 6002;
      name: 'PublicKeyMismatch';
      msg: 'Public key mismatch';
    },
    {
      code: 6003;
      name: 'DataIncrementLimitExceeded';
      msg: 'Exceeded account increase limit';
    },
    {
      code: 6004;
      name: 'IncorrectOwner';
      msg: 'Account does not have correct owner';
    },
    {
      code: 6005;
      name: 'Uninitialized';
      msg: 'Account is not initialized';
    },
    {
      code: 6006;
      name: 'MissingRemainingAccount';
      msg: 'Missing expected remaining account';
    },
    {
      code: 6007;
      name: 'NumericalOverflowError';
      msg: 'Numerical overflow error';
    },
    {
      code: 6008;
      name: 'RequiredGroupLabelNotFound';
      msg: 'Missing required group label';
    },
    {
      code: 6009;
      name: 'GroupNotFound';
      msg: 'Group not found';
    },
    {
      code: 6010;
      name: 'ExceededLength';
      msg: 'Value exceeded maximum length';
    },
    {
      code: 6011;
      name: 'GumballMachineEmpty';
      msg: 'Gumball machine is empty';
    },
    {
      code: 6012;
      name: 'InstructionNotFound';
      msg: 'No instruction was found';
    },
    {
      code: 6013;
      name: 'CollectionKeyMismatch';
      msg: 'Collection public key mismatch';
    },
    {
      code: 6014;
      name: 'MissingCollectionAccounts';
      msg: 'Missing collection accounts';
    },
    {
      code: 6015;
      name: 'CollectionUpdateAuthorityKeyMismatch';
      msg: 'Collection update authority public key mismatch';
    },
    {
      code: 6016;
      name: 'MintNotLastTransaction';
      msg: 'Mint must be the last instructions of the transaction';
    },
    {
      code: 6017;
      name: 'MintNotLive';
      msg: 'Mint is not live';
    },
    {
      code: 6018;
      name: 'NotEnoughSOL';
      msg: 'Not enough SOL to pay for the mint';
    },
    {
      code: 6019;
      name: 'TokenBurnFailed';
      msg: 'Token burn failed';
    },
    {
      code: 6020;
      name: 'NotEnoughTokens';
      msg: 'Not enough tokens on the account';
    },
    {
      code: 6021;
      name: 'TokenTransferFailed';
      msg: 'Token transfer failed';
    },
    {
      code: 6022;
      name: 'MissingRequiredSignature';
      msg: 'A signature was required but not found';
    },
    {
      code: 6023;
      name: 'GatewayTokenInvalid';
      msg: 'Gateway token is not valid';
    },
    {
      code: 6024;
      name: 'AfterEndDate';
      msg: 'Current time is after the set end date';
    },
    {
      code: 6025;
      name: 'InvalidMintTime';
      msg: 'Current time is not within the allowed mint time';
    },
    {
      code: 6026;
      name: 'AddressNotFoundInAllowedList';
      msg: 'Address not found on the allowed list';
    },
    {
      code: 6027;
      name: 'MissingAllowedListProof';
      msg: 'Missing allowed list proof';
    },
    {
      code: 6028;
      name: 'AllowedListNotEnabled';
      msg: 'Allow list guard is not enabled';
    },
    {
      code: 6029;
      name: 'AllowedMintLimitReached';
      msg: 'The maximum number of allowed mints was reached';
    },
    {
      code: 6030;
      name: 'InvalidNftCollection';
      msg: 'Invalid NFT collection';
    },
    {
      code: 6031;
      name: 'MissingNft';
      msg: 'Missing NFT on the account';
    },
    {
      code: 6032;
      name: 'MaximumRedeemedAmount';
      msg: 'Current redemeed items is at the set maximum amount';
    },
    {
      code: 6033;
      name: 'AddressNotAuthorized';
      msg: 'Address not authorized';
    },
    {
      code: 6034;
      name: 'MissingFreezeInstruction';
      msg: 'Missing freeze instruction data';
    },
    {
      code: 6035;
      name: 'FreezeGuardNotEnabled';
      msg: 'Freeze guard must be enabled';
    },
    {
      code: 6036;
      name: 'FreezeNotInitialized';
      msg: 'Freeze must be initialized';
    },
    {
      code: 6037;
      name: 'MissingFreezePeriod';
      msg: 'Missing freeze period';
    },
    {
      code: 6038;
      name: 'FreezeEscrowAlreadyExists';
      msg: 'The freeze escrow account already exists';
    },
    {
      code: 6039;
      name: 'ExceededMaximumFreezePeriod';
      msg: 'Maximum freeze period exceeded';
    },
    {
      code: 6040;
      name: 'ThawNotEnabled';
      msg: 'Thaw is not enabled';
    },
    {
      code: 6041;
      name: 'UnlockNotEnabled';
      msg: 'Unlock is not enabled (not all NFTs are thawed)';
    },
    {
      code: 6042;
      name: 'DuplicatedGroupLabel';
      msg: 'Duplicated group label';
    },
    {
      code: 6043;
      name: 'DuplicatedMintLimitId';
      msg: 'Duplicated mint limit id';
    },
    {
      code: 6044;
      name: 'UnauthorizedProgramFound';
      msg: 'An unauthorized program was found in the transaction';
    },
    {
      code: 6045;
      name: 'ExceededProgramListSize';
      msg: 'Exceeded the maximum number of programs in the additional list';
    },
    {
      code: 6046;
      name: 'AllocationNotInitialized';
      msg: 'Allocation PDA not initialized';
    },
    {
      code: 6047;
      name: 'AllocationLimitReached';
      msg: 'Allocation limit was reached';
    },
    {
      code: 6048;
      name: 'AllocationGuardNotEnabled';
      msg: 'Allocation guard must be enabled';
    },
    {
      code: 6049;
      name: 'InvalidMintAuthority';
      msg: 'Gumball machine has an invalid mint authority';
    },
    {
      code: 6050;
      name: 'InstructionBuilderFailed';
      msg: 'Instruction could not be created';
    },
    {
      code: 6051;
      name: 'InvalidAccountVersion';
      msg: 'Invalid account version';
    },
    {
      code: 6052;
      name: 'InvalidPDA';
      msg: 'Invalid PDA';
    },
    {
      code: 6053;
      name: 'InvalidPaymentMint';
      msg: 'Invalid payment mint';
    },
    {
      code: 6054;
      name: 'InvalidMachineState';
      msg: 'Invalid machine state';
    },
    {
      code: 6055;
      name: 'GuardNotSupported';
      msg: 'Guard not supported';
    },
    {
      code: 6056;
      name: 'InvalidMachine';
      msg: 'Invalid machine';
    },
  ];
};

export const IDL: GumballGuard = {
  version: '1.0.0',
  name: 'gumball_guard',
  instructions: [
    {
      name: 'initialize',
      docs: ['Create a new gumball guard account.'],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'base',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'data',
          type: 'bytes',
        },
      ],
    },
    {
      name: 'draw',
      docs: [
        'Draw a prize from a gumball machine wrapped in the gumball guard.',
      ],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: false,
          isSigner: false,
          docs: ['Gumball Guard account.'],
        },
        {
          name: 'gumballMachineProgram',
          isMut: false,
          isSigner: false,
          docs: ['Gumball Machine program account.', ''],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Payer for the mint (SOL) fees.'],
        },
        {
          name: 'buyer',
          isMut: true,
          isSigner: true,
          docs: ['Minter account for validation and non-SOL fees.'],
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
          docs: ['Token Metadata program.', ''],
        },
        {
          name: 'splTokenProgram',
          isMut: false,
          isSigner: false,
          docs: ['SPL Token program.'],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['System program.'],
        },
        {
          name: 'sysvarInstructions',
          isMut: false,
          isSigner: false,
          docs: ['Instructions sysvar account.', ''],
        },
        {
          name: 'recentSlothashes',
          isMut: false,
          isSigner: false,
          docs: ['SlotHashes sysvar cluster data.', ''],
        },
        {
          name: 'gumballEventAuthority',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'mintArgs',
          type: 'bytes',
        },
        {
          name: 'label',
          type: {
            option: 'string',
          },
        },
      ],
    },
    {
      name: 'drawJellybean',
      docs: [
        'Draw a prize from a gumball machine wrapped in the gumball guard.',
      ],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: false,
          isSigner: false,
          docs: ['Gumball Guard account.'],
        },
        {
          name: 'jellybeanMachineProgram',
          isMut: false,
          isSigner: false,
          docs: ['Jellybean Machine program account.', ''],
        },
        {
          name: 'jellybeanMachine',
          isMut: true,
          isSigner: false,
          docs: ['Jellybean machine account.'],
        },
        {
          name: 'jellybeanMachineAuthorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Payer for the mint (SOL) fees.'],
        },
        {
          name: 'buyer',
          isMut: true,
          isSigner: true,
          docs: ['Minter account for validation and non-SOL fees.'],
        },
        {
          name: 'unclaimedPrizes',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'printFeeAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'Print fee account. Required if the jellybean machine has a print fee config.',
          ],
        },
        {
          name: 'splTokenProgram',
          isMut: false,
          isSigner: false,
          docs: ['SPL Token program.'],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['System program.'],
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
          docs: ['Rent.'],
        },
        {
          name: 'sysvarInstructions',
          isMut: false,
          isSigner: false,
          docs: ['Instructions sysvar account.', ''],
        },
        {
          name: 'recentSlothashes',
          isMut: false,
          isSigner: false,
          docs: ['SlotHashes sysvar cluster data.', ''],
        },
        {
          name: 'jellybeanEventAuthority',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'mintArgs',
          type: 'bytes',
        },
        {
          name: 'label',
          type: {
            option: 'string',
          },
        },
      ],
    },
    {
      name: 'route',
      docs: ['Route the transaction to a guard instruction.'],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'machine',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'RouteArgs',
          },
        },
        {
          name: 'label',
          type: {
            option: 'string',
          },
        },
      ],
    },
    {
      name: 'setAuthority',
      docs: ['Set a new authority of the gumball guard.'],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: 'newAuthority',
          type: 'publicKey',
        },
      ],
    },
    {
      name: 'unwrap',
      docs: [
        'Remove a gumball guard from a gumball machine, setting the authority to the',
        'gumball guard authority.',
      ],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'gumballMachineAuthority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'gumballMachineProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'update',
      docs: ['Update the gumball guard configuration.'],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'machine',
          isMut: true,
          isSigner: false,
          docs: ['Machine account.'],
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'payer',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'data',
          type: 'bytes',
        },
      ],
    },
    {
      name: 'withdraw',
      docs: ['Withdraw the rent SOL from the gumball guard account.'],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'machine',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for authority pda if using token payment'],
        },
        {
          name: 'machineProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'wrap',
      docs: [
        'Add a gumball guard to a gumball machine. After the guard is added, mint',
        'is only allowed through the gumball guard.',
      ],
      accounts: [
        {
          name: 'gumballGuard',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'machine',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'machineProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'machineAuthority',
          isMut: false,
          isSigner: true,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'gumballGuard',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'base',
            type: 'publicKey',
          },
          {
            name: 'bump',
            type: 'u8',
          },
          {
            name: 'authority',
            type: 'publicKey',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'AddressGate',
      docs: ['Guard that restricts access to a specific address.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'address',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'Allocation',
      docs: [
        'Gaurd to specify the maximum number of mints in a guard set.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Allocation tracker PDA. The PDA is derived',
        'using the seed `["allocation", allocation id,',
        'gumball guard pubkey, gumball machine pubkey]`.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'id',
            docs: ['Unique identifier of the allocation.'],
            type: 'u8',
          },
          {
            name: 'limit',
            docs: ['The limit of the allocation.'],
            type: 'u32',
          },
        ],
      },
    },
    {
      name: 'AllocationTracker',
      docs: ['PDA to track the number of mints.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'count',
            type: 'u32',
          },
        ],
      },
    },
    {
      name: 'AllowList',
      docs: [
        'Guard that uses a merkle tree to specify the addresses allowed to mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[]` Pda created by the merkle proof instruction (seeds `["allow_list", merke tree root,',
        'payer key, gumball guard pubkey, gumball machine pubkey]`).',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'merkleRoot',
            docs: ['Merkle root of the addresses allowed to mint.'],
            type: {
              array: ['u8', 32],
            },
          },
        ],
      },
    },
    {
      name: 'AllowListProof',
      docs: ['PDA to track whether an address has been validated or not.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'timestamp',
            type: 'i64',
          },
        ],
      },
    },
    {
      name: 'BotTax',
      docs: [
        'Guard is used to:',
        '* charge a penalty for invalid transactions',
        '* validate that the mint transaction is the last transaction',
        '* verify that only authorized programs have instructions',
        '',
        'The `bot_tax` is applied to any error that occurs during the',
        'validation of the guards.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'lamports',
            type: 'u64',
          },
          {
            name: 'lastInstruction',
            type: 'bool',
          },
        ],
      },
    },
    {
      name: 'EndDate',
      docs: ['Guard that sets a specific date for the mint to stop.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'date',
            type: 'i64',
          },
        ],
      },
    },
    {
      name: 'Gatekeeper',
      docs: [
        'Guard that validates if the payer of the transaction has a token from a specified',
        'gateway network — in most cases, a token after completing a captcha challenge.',
        '',
        'List of accounts required:',
        '',
        '0. `[writeable]` Gatekeeper token account.',
        '1. `[]` Gatekeeper program account.',
        '2. `[]` Gatekeeper expire account.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'gatekeeperNetwork',
            docs: ['The network for the gateway token required'],
            type: 'publicKey',
          },
          {
            name: 'expireOnUse',
            docs: [
              'Whether or not the token should expire after minting.',
              'The gatekeeper network must support this if true.',
            ],
            type: 'bool',
          },
        ],
      },
    },
    {
      name: 'MintLimit',
      docs: [
        'Gaurd to set a limit of mints per wallet.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Mint counter PDA. The PDA is derived',
        'using the seed `["mint_limit", mint guard id, payer key,',
        'gumball guard pubkey, gumball machine pubkey]`.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'id',
            docs: ['Unique identifier of the mint limit.'],
            type: 'u8',
          },
          {
            name: 'limit',
            docs: ['Limit of mints per individual address.'],
            type: 'u16',
          },
        ],
      },
    },
    {
      name: 'MintCounter',
      docs: ['PDA to track the number of mints for an individual address.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'count',
            type: 'u16',
          },
        ],
      },
    },
    {
      name: 'NftBurn',
      docs: [
        'Guard that requires another NFT (token) from a specific collection to be burned.',
        '',
        'List of accounts required:',
        '',
        '0. `[writeable]` Token account of the NFT.',
        '1. `[writeable]` Metadata account of the NFT.',
        '2. `[writeable]` Master Edition account of the NFT.',
        '3. `[writeable]` Mint account of the NFT.',
        '4. `[writeable]` Collection metadata account of the NFT.',
        '5. `[writeable]` Token Record of the NFT (pNFT).',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'requiredCollection',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'NftGate',
      docs: [
        'Guard that restricts the transaction to holders of a specified collection.',
        '',
        'List of accounts required:',
        '',
        '0. `[]` Token account of the NFT.',
        '1. `[]` Metadata account of the NFT.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'requiredCollection',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'NftPayment',
      docs: [
        'Guard that charges another NFT (token) from a specific collection as payment',
        'for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writeable]` Token account of the NFT.',
        '1. `[writeable]` Metadata account of the NFT.',
        '2. `[]` Mint account of the NFT.',
        '3. `[]` Account to receive the NFT.',
        '4. `[writeable]` Destination PDA key (seeds [destination pubkey, token program id, nft mint pubkey]).',
        '5. `[]` spl-associate-token program ID.',
        '6. `[]` Master edition (pNFT)',
        '7. `[writable]` Owner token record (pNFT)',
        '8. `[writable]` Destination token record (pNFT)',
        '9. `[]` Token Authorization Rules program (pNFT)',
        '10. `[]` Token Authorization Rules account (pNFT)',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'requiredCollection',
            type: 'publicKey',
          },
          {
            name: 'destination',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'ProgramGate',
      docs: [
        'Guard that restricts the programs that can be in a mint transaction. The guard allows the',
        'necessary programs for the mint and any other program specified in the configuration.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'additional',
            type: {
              vec: 'publicKey',
            },
          },
        ],
      },
    },
    {
      name: 'RedeemedAmount',
      docs: [
        'Guard that stop the mint once the specified amount of items',
        'redeenmed is reached.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'maximum',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'SolPayment',
      docs: [
        'Guard that charges an amount in SOL (lamports) for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Account to receive the funds.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'lamports',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'StartDate',
      docs: ['Guard that sets a specific start date for the mint.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'date',
            type: 'i64',
          },
        ],
      },
    },
    {
      name: 'ThirdPartySigner',
      docs: [
        'Guard that requires a specified signer to validate the transaction.',
        '',
        'List of accounts required:',
        '',
        '0. `[signer]` Signer of the transaction.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'signerKey',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'Token2022Payment',
      docs: [
        'Guard that charges an amount in a specified spl-token as payment for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Token account holding the required amount.',
        '1. `[writable]` Address of the ATA to receive the tokens.',
        '2. `[]` Mint account.',
        '3. `[]` SPL Token-2022 program account.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amount',
            type: 'u64',
          },
          {
            name: 'mint',
            type: 'publicKey',
          },
          {
            name: 'destinationAta',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'TokenBurn',
      docs: [
        'Guard that requires addresses that hold an amount of a specified spl-token',
        'and burns them.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Token account holding the required amount.',
        '1. `[writable]` Token mint account.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amount',
            type: 'u64',
          },
          {
            name: 'mint',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'TokenGate',
      docs: [
        'Guard that restricts access to addresses that hold the specified spl-token.',
        '',
        'List of accounts required:',
        '',
        '0. `[]` Token account holding the required amount.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amount',
            type: 'u64',
          },
          {
            name: 'mint',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'TokenPayment',
      docs: [
        'Guard that charges an amount in a specified spl-token as payment for the mint.',
        '',
        'List of accounts required:',
        '',
        '0. `[writable]` Token account holding the required amount.',
        '1. `[writable]` Address of the ATA to receive the tokens.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amount',
            type: 'u64',
          },
          {
            name: 'mint',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'RouteArgs',
      docs: ['Arguments for a route transaction.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'guard',
            docs: ['The target guard type.'],
            type: {
              defined: 'GuardType',
            },
          },
          {
            name: 'data',
            docs: ['Arguments for the guard instruction.'],
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'GumballGuardData',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'default',
            type: {
              defined: 'GuardSet',
            },
          },
          {
            name: 'groups',
            type: {
              option: {
                vec: {
                  defined: 'Group',
                },
              },
            },
          },
        ],
      },
    },
    {
      name: 'Group',
      docs: [
        'A group represent a specific set of guards. When groups are used, transactions',
        'must specify which group should be used during validation.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'label',
            type: 'string',
          },
          {
            name: 'guards',
            type: {
              defined: 'GuardSet',
            },
          },
        ],
      },
    },
    {
      name: 'GuardSet',
      docs: ['The set of guards available.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'botTax',
            docs: [
              'Last instruction check and bot tax (penalty for invalid transactions).',
            ],
            type: {
              option: {
                defined: 'BotTax',
              },
            },
          },
          {
            name: 'startDate',
            docs: ['Start data guard (controls when minting is allowed).'],
            type: {
              option: {
                defined: 'StartDate',
              },
            },
          },
          {
            name: 'solPayment',
            docs: [
              'Sol payment guard (set the price for the mint in lamports).',
            ],
            type: {
              option: {
                defined: 'SolPayment',
              },
            },
          },
          {
            name: 'tokenPayment',
            docs: [
              'Token payment guard (set the price for the mint in spl-token amount).',
            ],
            type: {
              option: {
                defined: 'TokenPayment',
              },
            },
          },
          {
            name: 'thirdPartySigner',
            docs: [
              'Third party signer guard (requires an extra signer for the transaction).',
            ],
            type: {
              option: {
                defined: 'ThirdPartySigner',
              },
            },
          },
          {
            name: 'tokenGate',
            docs: [
              'Token gate guard (restrict access to holders of a specific token).',
            ],
            type: {
              option: {
                defined: 'TokenGate',
              },
            },
          },
          {
            name: 'gatekeeper',
            docs: ['Gatekeeper guard (captcha challenge).'],
            type: {
              option: {
                defined: 'Gatekeeper',
              },
            },
          },
          {
            name: 'endDate',
            docs: ['End date guard (set an end date to stop the mint).'],
            type: {
              option: {
                defined: 'EndDate',
              },
            },
          },
          {
            name: 'allowList',
            docs: ['Allow list guard (curated list of allowed addresses).'],
            type: {
              option: {
                defined: 'AllowList',
              },
            },
          },
          {
            name: 'mintLimit',
            docs: [
              'Mint limit guard (add a limit on the number of mints per wallet).',
            ],
            type: {
              option: {
                defined: 'MintLimit',
              },
            },
          },
          {
            name: 'nftPayment',
            docs: ['NFT Payment (charge an NFT in order to mint).'],
            type: {
              option: {
                defined: 'NftPayment',
              },
            },
          },
          {
            name: 'redeemedAmount',
            docs: [
              'Redeemed amount guard (add a limit on the overall number of items minted).',
            ],
            type: {
              option: {
                defined: 'RedeemedAmount',
              },
            },
          },
          {
            name: 'addressGate',
            docs: ['Address gate (check access against a specified address).'],
            type: {
              option: {
                defined: 'AddressGate',
              },
            },
          },
          {
            name: 'nftGate',
            docs: [
              'NFT gate guard (check access based on holding a specified NFT).',
            ],
            type: {
              option: {
                defined: 'NftGate',
              },
            },
          },
          {
            name: 'nftBurn',
            docs: ['NFT burn guard (burn a specified NFT).'],
            type: {
              option: {
                defined: 'NftBurn',
              },
            },
          },
          {
            name: 'tokenBurn',
            docs: ['Token burn guard (burn a specified amount of spl-token).'],
            type: {
              option: {
                defined: 'TokenBurn',
              },
            },
          },
          {
            name: 'programGate',
            docs: [
              'Program gate guard (restricts the programs that can be in a mint transaction).',
            ],
            type: {
              option: {
                defined: 'ProgramGate',
              },
            },
          },
          {
            name: 'allocation',
            docs: [
              'Allocation guard (specify the maximum number of mints in a group).',
            ],
            type: {
              option: {
                defined: 'Allocation',
              },
            },
          },
          {
            name: 'token2022Payment',
            docs: [
              'Token2022 payment guard (set the price for the mint in spl-token-2022 amount).',
            ],
            type: {
              option: {
                defined: 'Token2022Payment',
              },
            },
          },
        ],
      },
    },
    {
      name: 'MachineType',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Gumball',
          },
          {
            name: 'Jellybean',
          },
        ],
      },
    },
    {
      name: 'GuardType',
      docs: ['Available guard types.'],
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'BotTax',
          },
          {
            name: 'StartDate',
          },
          {
            name: 'SolPayment',
          },
          {
            name: 'TokenPayment',
          },
          {
            name: 'ThirdPartySigner',
          },
          {
            name: 'TokenGate',
          },
          {
            name: 'Gatekeeper',
          },
          {
            name: 'EndDate',
          },
          {
            name: 'AllowList',
          },
          {
            name: 'MintLimit',
          },
          {
            name: 'NftPayment',
          },
          {
            name: 'RedeemedAmount',
          },
          {
            name: 'AddressGate',
          },
          {
            name: 'NftGate',
          },
          {
            name: 'NftBurn',
          },
          {
            name: 'TokenBurn',
          },
          {
            name: 'ProgramGate',
          },
          {
            name: 'Allocation',
          },
          {
            name: 'Token2022Payment',
          },
        ],
      },
    },
  ],
  events: [
    {
      name: 'PaymentEvent',
      fields: [
        {
          name: 'amount',
          type: 'u64',
          index: false,
        },
        {
          name: 'mint',
          type: 'publicKey',
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'InvalidAccountSize',
      msg: 'Could not save guard to account',
    },
    {
      code: 6001,
      name: 'DeserializationError',
      msg: 'Could not deserialize guard',
    },
    {
      code: 6002,
      name: 'PublicKeyMismatch',
      msg: 'Public key mismatch',
    },
    {
      code: 6003,
      name: 'DataIncrementLimitExceeded',
      msg: 'Exceeded account increase limit',
    },
    {
      code: 6004,
      name: 'IncorrectOwner',
      msg: 'Account does not have correct owner',
    },
    {
      code: 6005,
      name: 'Uninitialized',
      msg: 'Account is not initialized',
    },
    {
      code: 6006,
      name: 'MissingRemainingAccount',
      msg: 'Missing expected remaining account',
    },
    {
      code: 6007,
      name: 'NumericalOverflowError',
      msg: 'Numerical overflow error',
    },
    {
      code: 6008,
      name: 'RequiredGroupLabelNotFound',
      msg: 'Missing required group label',
    },
    {
      code: 6009,
      name: 'GroupNotFound',
      msg: 'Group not found',
    },
    {
      code: 6010,
      name: 'ExceededLength',
      msg: 'Value exceeded maximum length',
    },
    {
      code: 6011,
      name: 'GumballMachineEmpty',
      msg: 'Gumball machine is empty',
    },
    {
      code: 6012,
      name: 'InstructionNotFound',
      msg: 'No instruction was found',
    },
    {
      code: 6013,
      name: 'CollectionKeyMismatch',
      msg: 'Collection public key mismatch',
    },
    {
      code: 6014,
      name: 'MissingCollectionAccounts',
      msg: 'Missing collection accounts',
    },
    {
      code: 6015,
      name: 'CollectionUpdateAuthorityKeyMismatch',
      msg: 'Collection update authority public key mismatch',
    },
    {
      code: 6016,
      name: 'MintNotLastTransaction',
      msg: 'Mint must be the last instructions of the transaction',
    },
    {
      code: 6017,
      name: 'MintNotLive',
      msg: 'Mint is not live',
    },
    {
      code: 6018,
      name: 'NotEnoughSOL',
      msg: 'Not enough SOL to pay for the mint',
    },
    {
      code: 6019,
      name: 'TokenBurnFailed',
      msg: 'Token burn failed',
    },
    {
      code: 6020,
      name: 'NotEnoughTokens',
      msg: 'Not enough tokens on the account',
    },
    {
      code: 6021,
      name: 'TokenTransferFailed',
      msg: 'Token transfer failed',
    },
    {
      code: 6022,
      name: 'MissingRequiredSignature',
      msg: 'A signature was required but not found',
    },
    {
      code: 6023,
      name: 'GatewayTokenInvalid',
      msg: 'Gateway token is not valid',
    },
    {
      code: 6024,
      name: 'AfterEndDate',
      msg: 'Current time is after the set end date',
    },
    {
      code: 6025,
      name: 'InvalidMintTime',
      msg: 'Current time is not within the allowed mint time',
    },
    {
      code: 6026,
      name: 'AddressNotFoundInAllowedList',
      msg: 'Address not found on the allowed list',
    },
    {
      code: 6027,
      name: 'MissingAllowedListProof',
      msg: 'Missing allowed list proof',
    },
    {
      code: 6028,
      name: 'AllowedListNotEnabled',
      msg: 'Allow list guard is not enabled',
    },
    {
      code: 6029,
      name: 'AllowedMintLimitReached',
      msg: 'The maximum number of allowed mints was reached',
    },
    {
      code: 6030,
      name: 'InvalidNftCollection',
      msg: 'Invalid NFT collection',
    },
    {
      code: 6031,
      name: 'MissingNft',
      msg: 'Missing NFT on the account',
    },
    {
      code: 6032,
      name: 'MaximumRedeemedAmount',
      msg: 'Current redemeed items is at the set maximum amount',
    },
    {
      code: 6033,
      name: 'AddressNotAuthorized',
      msg: 'Address not authorized',
    },
    {
      code: 6034,
      name: 'MissingFreezeInstruction',
      msg: 'Missing freeze instruction data',
    },
    {
      code: 6035,
      name: 'FreezeGuardNotEnabled',
      msg: 'Freeze guard must be enabled',
    },
    {
      code: 6036,
      name: 'FreezeNotInitialized',
      msg: 'Freeze must be initialized',
    },
    {
      code: 6037,
      name: 'MissingFreezePeriod',
      msg: 'Missing freeze period',
    },
    {
      code: 6038,
      name: 'FreezeEscrowAlreadyExists',
      msg: 'The freeze escrow account already exists',
    },
    {
      code: 6039,
      name: 'ExceededMaximumFreezePeriod',
      msg: 'Maximum freeze period exceeded',
    },
    {
      code: 6040,
      name: 'ThawNotEnabled',
      msg: 'Thaw is not enabled',
    },
    {
      code: 6041,
      name: 'UnlockNotEnabled',
      msg: 'Unlock is not enabled (not all NFTs are thawed)',
    },
    {
      code: 6042,
      name: 'DuplicatedGroupLabel',
      msg: 'Duplicated group label',
    },
    {
      code: 6043,
      name: 'DuplicatedMintLimitId',
      msg: 'Duplicated mint limit id',
    },
    {
      code: 6044,
      name: 'UnauthorizedProgramFound',
      msg: 'An unauthorized program was found in the transaction',
    },
    {
      code: 6045,
      name: 'ExceededProgramListSize',
      msg: 'Exceeded the maximum number of programs in the additional list',
    },
    {
      code: 6046,
      name: 'AllocationNotInitialized',
      msg: 'Allocation PDA not initialized',
    },
    {
      code: 6047,
      name: 'AllocationLimitReached',
      msg: 'Allocation limit was reached',
    },
    {
      code: 6048,
      name: 'AllocationGuardNotEnabled',
      msg: 'Allocation guard must be enabled',
    },
    {
      code: 6049,
      name: 'InvalidMintAuthority',
      msg: 'Gumball machine has an invalid mint authority',
    },
    {
      code: 6050,
      name: 'InstructionBuilderFailed',
      msg: 'Instruction could not be created',
    },
    {
      code: 6051,
      name: 'InvalidAccountVersion',
      msg: 'Invalid account version',
    },
    {
      code: 6052,
      name: 'InvalidPDA',
      msg: 'Invalid PDA',
    },
    {
      code: 6053,
      name: 'InvalidPaymentMint',
      msg: 'Invalid payment mint',
    },
    {
      code: 6054,
      name: 'InvalidMachineState',
      msg: 'Invalid machine state',
    },
    {
      code: 6055,
      name: 'GuardNotSupported',
      msg: 'Guard not supported',
    },
    {
      code: 6056,
      name: 'InvalidMachine',
      msg: 'Invalid machine',
    },
  ],
};
