/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gumball_guard.json`.
 */
export type GumballGuard = {
  address: 'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF';
  metadata: {
    name: 'gumballGuard';
    version: '1.0.0';
    spec: '0.1.0';
    description: 'mallow Gumball Guard: programmatic access control for mallow Gumball.';
    repository: 'https://github.com/mallow-labs/mallow-gumball';
  };
  instructions: [
    {
      name: 'closeAllowlistProof';
      docs: [
        'Close an AllowListProof PDA and send its rent to the account_fee_authority in GlobalConfig.',
        'Only the account_fee_authority recorded in GlobalConfig may call this instruction.',
        'The associated gumball guard must have already been closed (deleted).',
      ];
      discriminator: [190, 213, 48, 188, 252, 208, 190, 242];
      accounts: [
        {
          name: 'authority';
          docs: [
            'The protocol authority — must match global_config.account_fee_authority and receives rent.',
          ];
          writable: true;
          signer: true;
        },
        {
          name: 'globalConfig';
          docs: ['The GlobalConfig PDA — used to validate the authority.'];
        },
        {
          name: 'gumballGuard';
          docs: [
            'The gumball guard that this proof was created under. Must be closed (empty).',
          ];
        },
        {
          name: 'allowListProof';
          docs: ['The AllowListProof PDA to close.'];
          writable: true;
        },
        {
          name: 'systemProgram';
        },
      ];
      args: [];
    },
    {
      name: 'closeMintLimit';
      docs: [
        'Close a MintCounter PDA and send its rent to the account_fee_authority in GlobalConfig.',
        'Only the account_fee_authority recorded in GlobalConfig may call this instruction.',
        'The associated gumball guard must have already been closed (deleted).',
      ];
      discriminator: [234, 100, 43, 20, 76, 102, 26, 20];
      accounts: [
        {
          name: 'authority';
          docs: [
            'The protocol authority — must match global_config.account_fee_authority and receives rent.',
          ];
          writable: true;
          signer: true;
        },
        {
          name: 'globalConfig';
          docs: ['The GlobalConfig PDA — used to validate the authority.'];
        },
        {
          name: 'gumballGuard';
          docs: [
            'The gumball guard that this counter was created under. Must be closed (empty).',
          ];
        },
        {
          name: 'mintCounter';
          docs: ['The MintCounter PDA to close.'];
          writable: true;
        },
        {
          name: 'systemProgram';
        },
      ];
      args: [];
    },
    {
      name: 'createGlobalConfig';
      docs: ['Create the GlobalConfig PDA. Can only be called once.'];
      discriminator: [47, 208, 62, 51, 32, 34, 119, 132];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'globalConfig';
          writable: true;
        },
        {
          name: 'systemProgram';
        },
      ];
      args: [
        {
          name: 'configAuthority';
          type: 'pubkey';
        },
        {
          name: 'accountFeeAuthority';
          type: 'pubkey';
        },
      ];
    },
    {
      name: 'draw';
      docs: [
        'Draw a prize from a gumball machine wrapped in the gumball guard.',
      ];
      discriminator: [61, 40, 62, 184, 31, 176, 24, 130];
      accounts: [
        {
          name: 'gumballGuard';
          docs: ['Gumball Guard account.'];
        },
        {
          name: 'gumballMachineProgram';
          docs: ['Gumball Machine program account.', ''];
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'payer';
          docs: ['Payer for the mint (SOL) fees.'];
          writable: true;
          signer: true;
        },
        {
          name: 'buyer';
          docs: ['Minter account for validation and non-SOL fees.'];
          writable: true;
          signer: true;
        },
        {
          name: 'tokenMetadataProgram';
          docs: ['Token Metadata program.', ''];
        },
        {
          name: 'splTokenProgram';
          docs: ['SPL Token program.'];
        },
        {
          name: 'systemProgram';
          docs: ['System program.'];
        },
        {
          name: 'sysvarInstructions';
          docs: ['Instructions sysvar account.', ''];
        },
        {
          name: 'recentSlothashes';
          docs: ['SlotHashes sysvar cluster data.', ''];
        },
        {
          name: 'gumballEventAuthority';
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
      discriminator: [161, 33, 23, 4, 248, 125, 146, 155];
      accounts: [
        {
          name: 'gumballGuard';
          docs: ['Gumball Guard account.'];
        },
        {
          name: 'jellybeanMachineProgram';
          docs: ['Jellybean Machine program account.', ''];
        },
        {
          name: 'jellybeanMachine';
          docs: ['Jellybean machine account.'];
          writable: true;
        },
        {
          name: 'jellybeanMachineAuthorityPda';
          writable: true;
        },
        {
          name: 'payer';
          docs: ['Payer for the mint (SOL) fees.'];
          writable: true;
          signer: true;
        },
        {
          name: 'buyer';
          docs: ['Minter account for validation and non-SOL fees.'];
          writable: true;
          signer: true;
        },
        {
          name: 'unclaimedPrizes';
          writable: true;
        },
        {
          name: 'printFeeAccount';
          docs: [
            'Print fee account. Required if the jellybean machine has a print fee config.',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'splTokenProgram';
          docs: ['SPL Token program.'];
        },
        {
          name: 'systemProgram';
          docs: ['System program.'];
        },
        {
          name: 'rent';
          docs: ['Rent.'];
        },
        {
          name: 'sysvarInstructions';
          docs: ['Instructions sysvar account.', ''];
        },
        {
          name: 'recentSlothashes';
          docs: ['SlotHashes sysvar cluster data.', ''];
        },
        {
          name: 'jellybeanEventAuthority';
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
      name: 'initialize';
      docs: ['Create a new gumball guard account.'];
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: 'gumballGuard';
          writable: true;
        },
        {
          name: 'base';
          signer: true;
        },
        {
          name: 'authority';
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
        {
          name: 'systemProgram';
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
      name: 'route';
      docs: ['Route the transaction to a guard instruction.'];
      discriminator: [229, 23, 203, 151, 122, 227, 173, 42];
      accounts: [
        {
          name: 'gumballGuard';
        },
        {
          name: 'machine';
          writable: true;
        },
        {
          name: 'payer';
          writable: true;
          signer: true;
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'routeArgs';
            };
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
      discriminator: [133, 250, 37, 21, 110, 163, 26, 121];
      accounts: [
        {
          name: 'gumballGuard';
          writable: true;
        },
        {
          name: 'authority';
          signer: true;
        },
      ];
      args: [
        {
          name: 'newAuthority';
          type: 'pubkey';
        },
      ];
    },
    {
      name: 'unwrap';
      docs: [
        'Remove a gumball guard from a gumball machine, setting the authority to the',
        'gumball guard authority.',
      ];
      discriminator: [126, 175, 198, 14, 212, 69, 50, 44];
      accounts: [
        {
          name: 'gumballGuard';
        },
        {
          name: 'authority';
          signer: true;
        },
        {
          name: 'gumballMachine';
          writable: true;
        },
        {
          name: 'gumballMachineAuthority';
          signer: true;
        },
        {
          name: 'gumballMachineProgram';
        },
      ];
      args: [];
    },
    {
      name: 'update';
      docs: ['Update the gumball guard configuration.'];
      discriminator: [219, 200, 88, 176, 158, 63, 253, 127];
      accounts: [
        {
          name: 'gumballGuard';
          writable: true;
        },
        {
          name: 'machine';
          docs: ['Machine account.'];
          writable: true;
        },
        {
          name: 'authority';
          signer: true;
        },
        {
          name: 'payer';
          signer: true;
        },
        {
          name: 'systemProgram';
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
      name: 'updateGlobalConfig';
      docs: [
        'Update the GlobalConfig account. Only the current config_authority may call this.',
      ];
      discriminator: [164, 84, 130, 189, 111, 58, 250, 200];
      accounts: [
        {
          name: 'authority';
          docs: [
            'The current config authority — must match global_config.config_authority.',
          ];
          signer: true;
        },
        {
          name: 'globalConfig';
          writable: true;
        },
      ];
      args: [
        {
          name: 'newConfigAuthority';
          type: {
            option: 'pubkey';
          };
        },
        {
          name: 'newAccountFeeAuthority';
          type: {
            option: 'pubkey';
          };
        },
      ];
    },
    {
      name: 'withdraw';
      docs: ['Withdraw the rent SOL from the gumball guard account.'];
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34];
      accounts: [
        {
          name: 'gumballGuard';
          writable: true;
        },
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'machine';
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'machineProgram';
        },
        {
          name: 'tokenProgram';
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
      discriminator: [178, 40, 10, 189, 228, 129, 186, 140];
      accounts: [
        {
          name: 'gumballGuard';
        },
        {
          name: 'authority';
          signer: true;
        },
        {
          name: 'machine';
          writable: true;
        },
        {
          name: 'machineProgram';
        },
        {
          name: 'machineAuthority';
          signer: true;
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: 'globalConfig';
      discriminator: [149, 8, 156, 202, 160, 252, 176, 217];
    },
    {
      name: 'gumballGuard';
      discriminator: [54, 108, 243, 249, 30, 106, 227, 211];
    },
  ];
  events: [
    {
      name: 'idlHints';
      discriminator: [142, 251, 39, 135, 71, 0, 96, 192];
    },
    {
      name: 'paymentEvent';
      discriminator: [132, 136, 157, 119, 91, 254, 225, 20];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'invalidAccountSize';
      msg: 'Could not save guard to account';
    },
    {
      code: 6001;
      name: 'deserializationError';
      msg: 'Could not deserialize guard';
    },
    {
      code: 6002;
      name: 'publicKeyMismatch';
      msg: 'Public key mismatch';
    },
    {
      code: 6003;
      name: 'dataIncrementLimitExceeded';
      msg: 'Exceeded account increase limit';
    },
    {
      code: 6004;
      name: 'incorrectOwner';
      msg: 'Account does not have correct owner';
    },
    {
      code: 6005;
      name: 'uninitialized';
      msg: 'Account is not initialized';
    },
    {
      code: 6006;
      name: 'missingRemainingAccount';
      msg: 'Missing expected remaining account';
    },
    {
      code: 6007;
      name: 'numericalOverflowError';
      msg: 'Numerical overflow error';
    },
    {
      code: 6008;
      name: 'requiredGroupLabelNotFound';
      msg: 'Missing required group label';
    },
    {
      code: 6009;
      name: 'groupNotFound';
      msg: 'Group not found';
    },
    {
      code: 6010;
      name: 'exceededLength';
      msg: 'Value exceeded maximum length';
    },
    {
      code: 6011;
      name: 'gumballMachineEmpty';
      msg: 'Gumball machine is empty';
    },
    {
      code: 6012;
      name: 'instructionNotFound';
      msg: 'No instruction was found';
    },
    {
      code: 6013;
      name: 'collectionKeyMismatch';
      msg: 'Collection public key mismatch';
    },
    {
      code: 6014;
      name: 'missingCollectionAccounts';
      msg: 'Missing collection accounts';
    },
    {
      code: 6015;
      name: 'collectionUpdateAuthorityKeyMismatch';
      msg: 'Collection update authority public key mismatch';
    },
    {
      code: 6016;
      name: 'mintNotLastTransaction';
      msg: 'Mint must be the last instructions of the transaction';
    },
    {
      code: 6017;
      name: 'mintNotLive';
      msg: 'Mint is not live';
    },
    {
      code: 6018;
      name: 'notEnoughSol';
      msg: 'Not enough SOL to pay for the mint';
    },
    {
      code: 6019;
      name: 'tokenBurnFailed';
      msg: 'Token burn failed';
    },
    {
      code: 6020;
      name: 'notEnoughTokens';
      msg: 'Not enough tokens on the account';
    },
    {
      code: 6021;
      name: 'tokenTransferFailed';
      msg: 'Token transfer failed';
    },
    {
      code: 6022;
      name: 'missingRequiredSignature';
      msg: 'A signature was required but not found';
    },
    {
      code: 6023;
      name: 'gatewayTokenInvalid';
      msg: 'Gateway token is not valid';
    },
    {
      code: 6024;
      name: 'afterEndDate';
      msg: 'Current time is after the set end date';
    },
    {
      code: 6025;
      name: 'invalidMintTime';
      msg: 'Current time is not within the allowed mint time';
    },
    {
      code: 6026;
      name: 'addressNotFoundInAllowedList';
      msg: 'Address not found on the allowed list';
    },
    {
      code: 6027;
      name: 'missingAllowedListProof';
      msg: 'Missing allowed list proof';
    },
    {
      code: 6028;
      name: 'allowedListNotEnabled';
      msg: 'Allow list guard is not enabled';
    },
    {
      code: 6029;
      name: 'allowedMintLimitReached';
      msg: 'The maximum number of allowed mints was reached';
    },
    {
      code: 6030;
      name: 'invalidNftCollection';
      msg: 'Invalid NFT collection';
    },
    {
      code: 6031;
      name: 'missingNft';
      msg: 'Missing NFT on the account';
    },
    {
      code: 6032;
      name: 'maximumRedeemedAmount';
      msg: 'Current redemeed items is at the set maximum amount';
    },
    {
      code: 6033;
      name: 'addressNotAuthorized';
      msg: 'Address not authorized';
    },
    {
      code: 6034;
      name: 'missingFreezeInstruction';
      msg: 'Missing freeze instruction data';
    },
    {
      code: 6035;
      name: 'freezeGuardNotEnabled';
      msg: 'Freeze guard must be enabled';
    },
    {
      code: 6036;
      name: 'freezeNotInitialized';
      msg: 'Freeze must be initialized';
    },
    {
      code: 6037;
      name: 'missingFreezePeriod';
      msg: 'Missing freeze period';
    },
    {
      code: 6038;
      name: 'freezeEscrowAlreadyExists';
      msg: 'The freeze escrow account already exists';
    },
    {
      code: 6039;
      name: 'exceededMaximumFreezePeriod';
      msg: 'Maximum freeze period exceeded';
    },
    {
      code: 6040;
      name: 'thawNotEnabled';
      msg: 'Thaw is not enabled';
    },
    {
      code: 6041;
      name: 'unlockNotEnabled';
      msg: 'Unlock is not enabled (not all NFTs are thawed)';
    },
    {
      code: 6042;
      name: 'duplicatedGroupLabel';
      msg: 'Duplicated group label';
    },
    {
      code: 6043;
      name: 'duplicatedMintLimitId';
      msg: 'Duplicated mint limit id';
    },
    {
      code: 6044;
      name: 'unauthorizedProgramFound';
      msg: 'An unauthorized program was found in the transaction';
    },
    {
      code: 6045;
      name: 'exceededProgramListSize';
      msg: 'Exceeded the maximum number of programs in the additional list';
    },
    {
      code: 6046;
      name: 'allocationNotInitialized';
      msg: 'Allocation PDA not initialized';
    },
    {
      code: 6047;
      name: 'allocationLimitReached';
      msg: 'Allocation limit was reached';
    },
    {
      code: 6048;
      name: 'allocationGuardNotEnabled';
      msg: 'Allocation guard must be enabled';
    },
    {
      code: 6049;
      name: 'invalidMintAuthority';
      msg: 'Gumball machine has an invalid mint authority';
    },
    {
      code: 6050;
      name: 'instructionBuilderFailed';
      msg: 'Instruction could not be created';
    },
    {
      code: 6051;
      name: 'invalidAccountVersion';
      msg: 'Invalid account version';
    },
    {
      code: 6052;
      name: 'invalidPda';
      msg: 'Invalid PDA';
    },
    {
      code: 6053;
      name: 'invalidPaymentMint';
      msg: 'Invalid payment mint';
    },
    {
      code: 6054;
      name: 'invalidMachineState';
      msg: 'Invalid machine state';
    },
    {
      code: 6055;
      name: 'guardNotSupported';
      msg: 'Guard not supported';
    },
    {
      code: 6056;
      name: 'invalidMachine';
      msg: 'Invalid machine';
    },
  ];
  types: [
    {
      name: 'addressGate';
      docs: ['Guard that restricts access to a specific address.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'address';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'allocation';
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
      name: 'allocationTracker';
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
      name: 'allowList';
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
      name: 'allowListProof';
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
      name: 'botTax';
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
      name: 'endDate';
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
      name: 'feeConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'feeAccount';
            docs: ['Where fees will go'];
            type: 'pubkey';
          },
          {
            name: 'feeBps';
            docs: ['Sale basis points for fees'];
            type: 'u16';
          },
        ];
      };
    },
    {
      name: 'gatekeeper';
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
            type: 'pubkey';
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
      name: 'globalConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'configAuthority';
            docs: [
              'The authority that can update this config via `update_global_config`.',
            ];
            type: 'pubkey';
          },
          {
            name: 'accountFeeAuthority';
            docs: [
              'The authority that can close guard PDAs and receives their rent.',
            ];
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'guardType';
      docs: ['Available guard types.'];
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'botTax';
          },
          {
            name: 'startDate';
          },
          {
            name: 'solPayment';
          },
          {
            name: 'tokenPayment';
          },
          {
            name: 'thirdPartySigner';
          },
          {
            name: 'tokenGate';
          },
          {
            name: 'gatekeeper';
          },
          {
            name: 'endDate';
          },
          {
            name: 'allowList';
          },
          {
            name: 'mintLimit';
          },
          {
            name: 'nftPayment';
          },
          {
            name: 'redeemedAmount';
          },
          {
            name: 'addressGate';
          },
          {
            name: 'nftGate';
          },
          {
            name: 'nftBurn';
          },
          {
            name: 'tokenBurn';
          },
          {
            name: 'programGate';
          },
          {
            name: 'allocation';
          },
          {
            name: 'token2022Payment';
          },
        ];
      };
    },
    {
      name: 'gumballGuard';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'base';
            type: 'pubkey';
          },
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'authority';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'gumballMachine';
      docs: ['Gumball machine state and config data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'version';
            docs: ['Version of the account.'];
            type: 'u8';
          },
          {
            name: 'authority';
            docs: ['Authority address.'];
            type: 'pubkey';
          },
          {
            name: 'mintAuthority';
            docs: [
              'Authority address allowed to mint from the gumball machine.',
            ];
            type: 'pubkey';
          },
          {
            name: 'marketplaceFeeConfig';
            docs: ['Fee config for the marketplace this gumball is listed on'];
            type: {
              option: {
                defined: {
                  name: 'feeConfig';
                };
              };
            };
          },
          {
            name: 'itemsRedeemed';
            docs: ['Number of assets redeemed.'];
            type: 'u64';
          },
          {
            name: 'itemsSettled';
            docs: ['Number of assets settled after sale.'];
            type: 'u64';
          },
          {
            name: 'totalRevenue';
            docs: ['Amount of lamports/tokens received from purchases.'];
            type: 'u64';
          },
          {
            name: 'state';
            docs: [
              'True if the authority has finalized details, which prevents adding more nfts.',
            ];
            type: {
              defined: {
                name: 'gumballState';
              };
            };
          },
          {
            name: 'settings';
            docs: ['User-defined settings'];
            type: {
              defined: {
                name: 'gumballSettings';
              };
            };
          },
        ];
      };
    },
    {
      name: 'gumballSettings';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'uri';
            docs: ['Uri of off-chain metadata, max length 196'];
            type: 'string';
          },
          {
            name: 'itemCapacity';
            docs: ['Number of assets that can be added.'];
            type: 'u64';
          },
          {
            name: 'itemsPerSeller';
            docs: ['Max number of items that can be added by a single seller.'];
            type: 'u16';
          },
          {
            name: 'sellersMerkleRoot';
            docs: [
              'Merkle root hash for sellers who can add items to the machine.',
            ];
            type: {
              option: {
                array: ['u8', 32];
              };
            };
          },
          {
            name: 'curatorFeeBps';
            docs: ['Fee basis points paid to the machine authority.'];
            type: 'u16';
          },
          {
            name: 'hideSoldItems';
            docs: [
              'True if the front end should hide items that have been sold.',
            ];
            type: 'bool';
          },
          {
            name: 'paymentMint';
            docs: ['Payment token for the mint'];
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'gumballState';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'none';
          },
          {
            name: 'detailsFinalized';
          },
          {
            name: 'saleLive';
          },
          {
            name: 'saleEnded';
          },
        ];
      };
    },
    {
      name: 'idlHints';
      docs: [
        'IDL-only hint. This event is never emitted or constructed at runtime.',
        '',
        'The gumball guard (de)serializes its guard configuration through opaque',
        "`Vec<u8>` instruction arguments, so Anchor's IDL generator never encounters",
        'the individual guard structs and omits them from the IDL. Referencing every',
        'guard type here forces them into `idl.types`, so the generated JS client',
        '(codama) renders their codecs — which the hand-written guard modules in',
        '`clients/js/src/{guards,defaultGuards}` depend on.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'addressGate';
            type: {
              defined: {
                name: 'addressGate';
              };
            };
          },
          {
            name: 'allocation';
            type: {
              defined: {
                name: 'allocation';
              };
            };
          },
          {
            name: 'allocationTracker';
            type: {
              defined: {
                name: 'allocationTracker';
              };
            };
          },
          {
            name: 'allowList';
            type: {
              defined: {
                name: 'allowList';
              };
            };
          },
          {
            name: 'allowListProof';
            type: {
              defined: {
                name: 'allowListProof';
              };
            };
          },
          {
            name: 'botTax';
            type: {
              defined: {
                name: 'botTax';
              };
            };
          },
          {
            name: 'endDate';
            type: {
              defined: {
                name: 'endDate';
              };
            };
          },
          {
            name: 'gatekeeper';
            type: {
              defined: {
                name: 'gatekeeper';
              };
            };
          },
          {
            name: 'machineType';
            type: {
              defined: {
                name: 'machineType';
              };
            };
          },
          {
            name: 'mintCounter';
            type: {
              defined: {
                name: 'mintCounter';
              };
            };
          },
          {
            name: 'mintLimit';
            type: {
              defined: {
                name: 'mintLimit';
              };
            };
          },
          {
            name: 'nftBurn';
            type: {
              defined: {
                name: 'nftBurn';
              };
            };
          },
          {
            name: 'nftGate';
            type: {
              defined: {
                name: 'nftGate';
              };
            };
          },
          {
            name: 'nftPayment';
            type: {
              defined: {
                name: 'nftPayment';
              };
            };
          },
          {
            name: 'programGate';
            type: {
              defined: {
                name: 'programGate';
              };
            };
          },
          {
            name: 'redeemedAmount';
            type: {
              defined: {
                name: 'redeemedAmount';
              };
            };
          },
          {
            name: 'solPayment';
            type: {
              defined: {
                name: 'solPayment';
              };
            };
          },
          {
            name: 'startDate';
            type: {
              defined: {
                name: 'startDate';
              };
            };
          },
          {
            name: 'thirdPartySigner';
            type: {
              defined: {
                name: 'thirdPartySigner';
              };
            };
          },
          {
            name: 'token2022Payment';
            type: {
              defined: {
                name: 'token2022Payment';
              };
            };
          },
          {
            name: 'tokenBurn';
            type: {
              defined: {
                name: 'tokenBurn';
              };
            };
          },
          {
            name: 'tokenGate';
            type: {
              defined: {
                name: 'tokenGate';
              };
            };
          },
          {
            name: 'tokenPayment';
            type: {
              defined: {
                name: 'tokenPayment';
              };
            };
          },
        ];
      };
    },
    {
      name: 'machineType';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'gumball';
          },
          {
            name: 'jellybean';
          },
        ];
      };
    },
    {
      name: 'mintCounter';
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
      name: 'mintLimit';
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
      name: 'nftBurn';
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
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'nftGate';
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
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'nftPayment';
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
            type: 'pubkey';
          },
          {
            name: 'destination';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'paymentEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'mint';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'programGate';
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
              vec: 'pubkey';
            };
          },
        ];
      };
    },
    {
      name: 'redeemedAmount';
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
      name: 'routeArgs';
      docs: ['Arguments for a route transaction.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'guard';
            docs: ['The target guard type.'];
            type: {
              defined: {
                name: 'guardType';
              };
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
      name: 'solPayment';
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
      name: 'startDate';
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
      name: 'thirdPartySigner';
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
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'token2022Payment';
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
            type: 'pubkey';
          },
          {
            name: 'destinationAta';
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'tokenBurn';
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
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'tokenGate';
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
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'tokenPayment';
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
            type: 'pubkey';
          },
        ];
      };
    },
  ];
};
