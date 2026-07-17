/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/mallow_gumball.json`.
 */
export type MallowGumball = {
  address: 'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa';
  metadata: {
    name: 'mallowGumball';
    version: '1.0.0';
    spec: '0.1.0';
    description: 'mallow Gumball: collaborative random sales of existing NFTs.';
    repository: 'https://github.com/mallow-labs/mallow-gumball';
  };
  instructions: [
    {
      name: 'addCnft';
      docs: [
        'Add a compressed NFT (Bubblegum V1) to the gumball machine.',
        'Escrows the leaf `seller -> authority PDA` (cNFTs cannot be frozen in',
        "place) and stores the asset id in the config line's mint field.",
        'Only V1 leaves are accepted; V2 leaves are rejected.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Seller (leaf owner)',
        '4. `[]` Bubblegum tree config PDA',
        '5. `[writable]` Merkle tree',
        '6. `[]` SPL No-op (log wrapper) program',
        '7. `[]` SPL Account Compression program',
        '8. `[]` Bubblegum program',
        '9. `[]` System program',
        'Remaining accounts: merkle proof nodes',
      ];
      discriminator: [206, 105, 81, 150, 224, 26, 175, 7];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the cNFT (current leaf owner).'];
          writable: true;
          signer: true;
        },
        {
          name: 'treeConfig';
        },
        {
          name: 'merkleTree';
          docs: [
            'id via `assert_cnft_asset_id` (the ONLY binding between this account and',
            'the item we store).',
          ];
          writable: true;
        },
        {
          name: 'logWrapper';
          address: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
        },
        {
          name: 'compressionProgram';
          address: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';
        },
        {
          name: 'bubblegumProgram';
          address: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'cnftArgs';
            };
          };
        },
        {
          name: 'addItemArgs';
          type: {
            defined: {
              name: 'addItemArgs';
            };
          };
        },
      ];
    },
    {
      name: 'addCoreAsset';
      docs: [
        'Add Core assets to the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Seller',
        '4. `[writable]` Asset account',
        '5. `[writable, optional]` Collection account',
        '6. `[]` MPL Core program',
        '7. `[]` System program',
      ];
      discriminator: [30, 144, 222, 2, 197, 195, 17, 163];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the asset.'];
          writable: true;
          signer: true;
        },
        {
          name: 'asset';
          writable: true;
        },
        {
          name: 'collection';
          docs: ["Core asset's collection if it's part of one."];
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'addItemArgs';
            };
          };
        },
      ];
    },
    {
      name: 'addNft';
      docs: [
        'Add legacy NFTs to the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Seller',
        '4. `[]` Mint account',
        '5. `[writable]` Token account',
        '6. `[writable]` Metadata account',
        '7. `[]` Edition account',
        '8. `[]` Token program',
        '9. `[]` Token Metadata program',
        '10. `[]` System program',
        '11. `[writable, optional]` Seller token record (pNFT)',
        '12. `[optional]` Auth rules account (pNFT)',
        '13. `[optional]` Instructions sysvar (pNFT)',
        '14. `[optional]` Auth rules program (pNFT)',
      ];
      discriminator: [55, 57, 85, 145, 81, 134, 220, 223];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
          signer: true;
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'metadata';
          writable: true;
        },
        {
          name: 'edition';
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'tokenMetadataProgram';
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'sellerTokenRecord';
          docs: ['OPTIONAL PNFT ACCOUNTS'];
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'addItemArgs';
            };
          };
        },
      ];
    },
    {
      name: 'addTokens';
      docs: [
        'Add fungible tokens to the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Seller',
        '4. `[]` Mint account',
        "5. `[writable]` Seller's token account",
        "6. `[writable]` Gumball machine's token account",
        '7. `[]` Token program',
        '8. `[]` Associated Token program',
        '9. `[]` System program',
        '10. `[]` Rent sysvar',
      ];
      discriminator: [28, 218, 30, 209, 175, 155, 153, 240];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the tokens'];
          writable: true;
          signer: true;
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'quantity';
          type: 'u16';
        },
        {
          name: 'args';
          type: {
            defined: {
              name: 'addItemArgs';
            };
          };
        },
      ];
    },
    {
      name: 'approveAddItem';
      docs: [
        'Approve adding an item to the gumball machine.',
        "Moves the item from the request to the gumball machine's config lines.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account.',
        '1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset]). Will be closed.',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).',
        '3. `[signer, writable]` Authority of the gumball machine.',
        '4. `[writable]` Seller account (receiver of closed request account rent).',
        '5. `[]` Asset/Mint account (checked via add_item_request constraint).',
        '6. `[]` System program.',
      ];
      discriminator: [135, 250, 51, 252, 70, 171, 19, 48];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
          relations: ['addItemRequest'];
        },
        {
          name: 'addItemRequest';
          docs: ['Add item request account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'asset';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: ['Authority of the gumball machine.'];
          writable: true;
          signer: true;
        },
        {
          name: 'seller';
          writable: true;
          relations: ['addItemRequest'];
        },
        {
          name: 'asset';
          relations: ['addItemRequest'];
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'cancelAddCnftRequest';
      docs: [
        'Cancel a request to add a compressed NFT.',
        'Transfers the escrowed leaf back to the seller and closes the request.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller])',
        '1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset_id]). Will be closed.',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine])',
        '3. `[signer, writable]` Seller',
        '4. `[]` Asset id (Bubblegum PDA; not a real account)',
        '5. `[]` Bubblegum tree config PDA',
        '6. `[writable]` Merkle tree',
        '7. `[]` SPL No-op (log wrapper) program',
        '8. `[]` SPL Account Compression program',
        '9. `[]` Bubblegum program',
        '10. `[]` System program',
        'Remaining accounts: merkle proof nodes',
      ];
      discriminator: [80, 132, 87, 37, 80, 216, 231, 4];
      accounts: [
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'sellerHistory.gumballMachine';
                account: 'sellerHistory';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'addItemRequest';
          docs: [
            'Add item request account (keyed by asset id). Will be closed.',
          ];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'asset';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'addItemRequest.gumballMachine';
                account: 'addItemRequest';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the cNFT.'];
          writable: true;
          signer: true;
          relations: ['sellerHistory', 'addItemRequest'];
        },
        {
          name: 'asset';
          docs: ['The cNFT asset id (a Bubblegum PDA; not a real account).'];
          relations: ['addItemRequest'];
        },
        {
          name: 'treeConfig';
        },
        {
          name: 'merkleTree';
          writable: true;
        },
        {
          name: 'logWrapper';
          address: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
        },
        {
          name: 'compressionProgram';
          address: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';
        },
        {
          name: 'bubblegumProgram';
          address: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'cnftArgs';
            };
          };
        },
      ];
    },
    {
      name: 'cancelAddCoreAssetRequest';
      docs: [
        'Cancel a request to add a core asset to the gumball machine.',
        "Thaws and revokes delegate from the seller's asset and closes the request account.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller]).',
        '1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset]). Will be closed.',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine]).',
        '3. `[signer, writable]` Seller of the asset.',
        '4. `[writable]` Asset account.',
        '5. `[writable, optional]` Collection account if asset is part of one.',
        '6. `[]` MPL Core program.',
        '7. `[]` System program.',
      ];
      discriminator: [154, 46, 224, 244, 88, 92, 247, 38];
      accounts: [
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'sellerHistory.gumballMachine';
                account: 'sellerHistory';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'addItemRequest';
          docs: ['Add item request account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'asset';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'addItemRequest.gumballMachine';
                account: 'addItemRequest';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the asset.'];
          writable: true;
          signer: true;
          relations: ['sellerHistory', 'addItemRequest'];
        },
        {
          name: 'asset';
          writable: true;
          relations: ['addItemRequest'];
        },
        {
          name: 'collection';
          docs: ["Core asset's collection if it's part of one."];
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'cancelAddNftRequest';
      docs: [
        'Cancel a request to add a NFT to the gumball machine.',
        "Thaws and revokes delegate from the seller's NFT and closes the request account.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Seller history account (PDA, seeds: ["seller_history", add_item_request.gumball_machine, seller]).',
        '1. `[writable]` Add item request account (PDA, seeds: ["add_item_request", mint]). Will be closed.',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", add_item_request.gumball_machine]).',
        '3. `[signer, writable]` Seller of the NFT.',
        '4. `[]` Mint account of the NFT.',
        "5. `[writable]` Seller's token account for the NFT.",
        "6. `[writable]` Authority PDA's token account.",
        '7. `[]` Edition account of the NFT.',
        '8. `[]` Token program.',
        '9. `[]` Associated Token program.',
        '10. `[]` Token Metadata program.',
        '11. `[]` System program.',
        '12. `[]` Rent sysvar.',
        '13. `[writable, optional]` Metadata account (pNFT).',
        '14. `[writable, optional]` Seller token record (pNFT).',
        '15. `[optional]` Auth rules account (pNFT).',
        '16. `[optional]` Instructions sysvar (pNFT).',
        '17. `[optional]` Auth rules program (pNFT).',
      ];
      discriminator: [34, 8, 56, 112, 4, 65, 153, 137];
      accounts: [
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'sellerHistory.gumballMachine';
                account: 'sellerHistory';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'addItemRequest';
          docs: ['Add item request account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'mint';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'addItemRequest.gumballMachine';
                account: 'addItemRequest';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the NFT.'];
          writable: true;
          signer: true;
          relations: ['sellerHistory', 'addItemRequest'];
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'edition';
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'tokenMetadataProgram';
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'metadata';
          docs: [
            'OPTIONAL PNFT ACCOUNTS',
            '/// CHECK: Safe due to token metadata program check',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
      ];
      args: [];
    },
    {
      name: 'claimCnft';
      docs: [
        'Claims a compressed NFT from the gumball machine for the recorded buyer.',
        'Transfers the leaf from the authority PDA to the buyer.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can claim)',
        '1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[]` Seller',
        '4. `[writable]` Buyer (receiver of the leaf)',
        '5. `[]` Bubblegum tree config PDA',
        '6. `[writable]` Merkle tree',
        '7. `[]` SPL No-op (log wrapper) program',
        '8. `[]` SPL Account Compression program',
        '9. `[]` Bubblegum program',
        '10. `[]` System program',
        'Remaining accounts: merkle proof nodes',
      ];
      discriminator: [30, 220, 189, 5, 230, 95, 4, 131];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can claim the item for the recorded buyer.'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the cNFT.'];
        },
        {
          name: 'buyer';
          docs: ['Buyer of the cNFT (recorded at draw). Receives the leaf.'];
          writable: true;
        },
        {
          name: 'treeConfig';
        },
        {
          name: 'merkleTree';
          docs: [
            '`assert_config_line` (which compares the derived asset id to the stored',
            'config-line mint).',
          ];
          writable: true;
        },
        {
          name: 'logWrapper';
          address: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
        },
        {
          name: 'compressionProgram';
          address: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';
        },
        {
          name: 'bubblegumProgram';
          address: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
        {
          name: 'args';
          type: {
            defined: {
              name: 'cnftArgs';
            };
          };
        },
      ];
    },
    {
      name: 'claimCoreAsset';
      docs: [
        'Claims a Core asset from the gumball machine for a specific buyer.',
        'Transfers the asset from the PDA to the buyer.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can claim the item)',
        '1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable]` Seller account',
        '4. `[]` Buyer account',
        '5. `[]` System program',
        '6. `[writable]` Asset account',
        '7. `[writable, optional]` Collection account if asset is part of one.',
        '8. `[]` MPL Core program.',
      ];
      discriminator: [63, 249, 255, 80, 180, 15, 173, 59];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
        },
        {
          name: 'buyer';
          docs: ['buyer of the nft'];
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'asset';
          writable: true;
        },
        {
          name: 'collection';
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'claimNft';
      docs: [
        'Claims a legacy NFT from the gumball machine for a specific buyer.',
        'Thaws and transfers the NFT from the PDA to the buyer.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can claim the item)',
        '1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable]` Seller account',
        '4. `[]` Buyer account',
        '5. `[]` Token program',
        '6. `[]` Associated Token program',
        '7. `[]` System program',
        '8. `[]` Rent sysvar',
        '9. `[]` Mint account',
        "10. `[writable]` Buyer's token account",
        "11. `[writable]` Authority PDA's token account",
        '12. `[writable]` Metadata account',
        '13. `[writable]` Edition account',
        '14. `[]` Token Metadata program',
        '15. `[writable, optional]` Seller token record (pNFT)',
        '16. `[writable, optional]` Authority PDA token record (pNFT)',
        '17. `[writable, optional]` Buyer token record (pNFT)',
        '18. `[optional]` Auth rules account (pNFT)',
        '19. `[optional]` Instructions sysvar (pNFT)',
        '20. `[optional]` Auth rules program (pNFT)',
      ];
      discriminator: [6, 193, 146, 120, 48, 218, 69, 33];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
        },
        {
          name: 'buyer';
          docs: ['buyer of the nft'];
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'buyerTokenAccount';
          docs: ['Nft token account for buyer'];
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'metadata';
          writable: true;
        },
        {
          name: 'edition';
          writable: true;
        },
        {
          name: 'tokenMetadataProgram';
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'sellerTokenRecord';
          docs: ['OPTIONAL PNFT ACCOUNTS'];
          writable: true;
          optional: true;
        },
        {
          name: 'authorityPdaTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'buyerTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'claimTokens';
      docs: [
        'Claims fungible tokens from the gumball machine for a specific buyer.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can claim the tokens)',
        '1. `[writable]` Gumball Machine account (must be in SaleLive or SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable]` Gumball Machine authority',
        '4. `[writable]` Seller account',
        '5. `[]` Buyer account',
        '6. `[]` Token program',
        '7. `[]` Associated Token program',
        '8. `[]` System program',
        '9. `[]` Rent sysvar',
        '10. `[]` Mint account',
        "11. `[writable]` Buyer's token account (must match mint and buyer)",
        "12. `[writable]` Authority PDA's token account (must match mint and authority PDA)",
      ];
      discriminator: [108, 216, 210, 231, 0, 212, 42, 64];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: ['Gumball machine authority'];
          writable: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
        },
        {
          name: 'buyer';
          docs: ['buyer of the nft'];
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'mint';
        },
        {
          name: 'buyerTokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'draw';
      docs: [
        'Draw for a random item from the gumball machine.',
        'Only the gumball machine mint authority is allowed to draw.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine mint authority',
        '2. `[signer, writable]` Payer',
        '3. `[]` Buyer account',
        '4. `[]` System program',
        '5. `[]` SlotHashes sysvar cluster data',
      ];
      discriminator: [61, 40, 62, 184, 31, 176, 24, 130];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'mintAuthority';
          docs: [
            'Gumball machine mint authority (mint only allowed for the mint_authority).',
          ];
          signer: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'payer';
          docs: ['Payer for the transaction and account allocation (rent).'];
          writable: true;
          signer: true;
        },
        {
          name: 'buyer';
          docs: ['NFT account owner.', ''];
        },
        {
          name: 'systemProgram';
          docs: ['System program.'];
          address: '11111111111111111111111111111111';
        },
        {
          name: 'recentSlothashes';
          docs: ['SlotHashes sysvar cluster data.', ''];
          address: 'SysvarS1otHashes111111111111111111111111111';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [];
    },
    {
      name: 'endSale';
      docs: [
        'Disables minting and allows sales to be settled.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer, writable]` Gumball Machine authority',
      ];
      discriminator: [37, 239, 52, 17, 120, 44, 213, 125];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
          ];
          writable: true;
          signer: true;
          relations: ['gumballMachine'];
        },
      ];
      args: [];
    },
    {
      name: 'incrementTotalRevenue';
      docs: [
        'Increments total revenue earned by the gumball machine.',
        '',
        'Only the gumball machine mint authority is allowed to increment revenue. This is',
        "required as token transfers don't occur in this program, but total is needed",
        'when settling.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine mint authority',
      ];
      discriminator: [197, 168, 14, 157, 91, 203, 104, 102];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'mintAuthority';
          docs: [
            'Gumball machine mint authority (mint only allowed for the mint_authority).',
          ];
          signer: true;
          relations: ['gumballMachine'];
        },
      ];
      args: [
        {
          name: 'revenue';
          type: 'u64';
        },
      ];
    },
    {
      name: 'initialize';
      docs: [
        'Initialize the gumball machine account with the specified data.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)',
        '1. `[]` Gumball Machine authority',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Payer',
        '4. `[]` System program',
      ];
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: 'gumballMachine';
          docs: [
            'Gumball Machine account. The account space must be allocated to allow accounts larger',
            'than 10kb.',
            '',
          ];
          writable: true;
        },
        {
          name: 'authority';
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
            '',
          ];
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'payer';
          docs: ['Payer of the transaction.'];
          writable: true;
          signer: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'initializeArgs';
            };
          };
        },
      ];
    },
    {
      name: 'manageBuyBackFunds';
      docs: [
        'Manage the buy back funds of the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer, writable]` Gumball Machine authority',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        "3. `[writable, optional]` Authority's payment account",
        "4. `[writable, optional]` Authority PDA's payment account",
        '5. `[optional]` Payment mint',
        '6. `[]` Token program',
        '7. `[]` Associated Token program',
        '8. `[]` System program',
        '9. `[]` Rent sysvar',
      ];
      discriminator: [178, 126, 37, 230, 255, 106, 125, 29];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine acccount.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: ['Authority of the gumball machine.'];
          writable: true;
          signer: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPaymentAccount';
          docs: ["Authority's token account if using token payment"];
          writable: true;
          optional: true;
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'paymentMint';
          docs: ['Payment mint if using non-native payment token'];
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'isWithdraw';
          type: 'bool';
        },
      ];
    },
    {
      name: 'removeCnft';
      docs: [
        'Remove a compressed NFT from the gumball machine.',
        'Transfers the escrowed leaf back to the seller. The signer can be the',
        "gumball machine authority or the item's seller.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer]` Authority allowed to remove (gumball machine authority or item seller)',
        '4. `[writable]` Seller (receiver of the leaf)',
        '5. `[]` Bubblegum tree config PDA',
        '6. `[writable]` Merkle tree',
        '7. `[]` SPL No-op (log wrapper) program',
        '8. `[]` SPL Account Compression program',
        '9. `[]` Bubblegum program',
        '10. `[]` System program',
        'Remaining accounts: merkle proof nodes',
      ];
      discriminator: [24, 204, 40, 184, 195, 73, 136, 210];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: [
            'Authority allowed to remove (gumball machine authority or item seller).',
          ];
          signer: true;
        },
        {
          name: 'seller';
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'treeConfig';
        },
        {
          name: 'merkleTree';
          docs: ['derived asset id passed into `remove_multiple_items_span`.'];
          writable: true;
        },
        {
          name: 'logWrapper';
          address: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
        },
        {
          name: 'compressionProgram';
          address: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';
        },
        {
          name: 'bubblegumProgram';
          address: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
        {
          name: 'args';
          type: {
            defined: {
              name: 'cnftArgs';
            };
          };
        },
      ];
    },
    {
      name: 'removeCoreAsset';
      docs: [
        'Remove Core asset from the gumball machine.',
        "Thaws and revokes delegate from the seller's asset and removes it from the config lines.",
        'The signer can be the Gumball Machine authority or the seller of the specific item.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account.',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).',
        '3. `[signer]` Authority allowed to remove (gumball machine authority or item seller).',
        '4. `[writable]` Seller account (owner of the asset).',
        '5. `[writable]` Asset account.',
        '6. `[writable, optional]` Collection account if asset is part of one.',
        '7. `[]` MPL Core program.',
        '8. `[]` System program.',
      ];
      discriminator: [65, 17, 71, 132, 145, 88, 237, 166];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: ['Seller of the asset.'];
          signer: true;
        },
        {
          name: 'seller';
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'asset';
          writable: true;
        },
        {
          name: 'collection';
          docs: ["Core asset's collection if it's part of one."];
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'removeNft';
      docs: [
        'Remove legacy NFT from the gumball machine.',
        "Thaws and revokes delegate from the seller's NFT and removes it from the config lines.",
        'The signer can be the Gumball Machine authority or the seller of the specific item.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account.',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).',
        '3. `[signer]` Authority allowed to remove (gumball machine authority or item seller).',
        '4. `[writable]` Seller account (owner of the NFT).',
        '5. `[]` Mint account of the NFT.',
        "6. `[writable]` Seller's token account for the NFT.",
        "7. `[writable]` Authority PDA's token account.",
        '8. `[]` Edition account of the NFT.',
        '9. `[]` Token program.',
        '10. `[]` Associated Token program.',
        '11. `[]` Token Metadata program.',
        '12. `[]` System program.',
        '13. `[]` Rent sysvar.',
        '14. `[writable, optional]` Metadata account (pNFT).',
        '15. `[writable, optional]` Seller token record (pNFT).',
        '16. `[optional]` Auth rules account (pNFT).',
        '17. `[optional]` Instructions sysvar (pNFT).',
        '18. `[optional]` Auth rules program (pNFT).',
      ];
      discriminator: [22, 52, 77, 58, 242, 146, 178, 20];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ];
          signer: true;
        },
        {
          name: 'seller';
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'edition';
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'tokenMetadataProgram';
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'metadata';
          docs: [
            'OPTIONAL PNFT ACCOUNTS',
            '/// CHECK: Safe due to token metadata program check',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'removeTokens';
      docs: [
        'Remove fungible tokens from the gumball machine.',
        'The signer can be the Gumball Machine authority or the seller of the specific item.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Authority allowed to remove (gumball machine authority or item seller).',
        '4. `[writable]` Seller account (owner of the tokens).',
        '5. `[]` Mint account',
        "6. `[writable]` Seller's token account",
        "7. `[writable]` Gumball machine's token account",
        '8. `[]` Token program',
        '9. `[]` Associated Token program',
        '10. `[]` System program',
        '11. `[]` Rent sysvar',
        'DEPRECATED: Use remove_tokens_span instead',
      ];
      discriminator: [44, 175, 119, 21, 25, 7, 44, 126];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ];
          writable: true;
          signer: true;
        },
        {
          name: 'seller';
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'indices';
          type: 'bytes';
        },
        {
          name: 'amount';
          type: 'u64';
        },
      ];
    },
    {
      name: 'removeTokensSpan';
      docs: [
        'Remove fungible tokens from the gumball machine.',
        'The signer can be the Gumball Machine authority or the seller of the specific item.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[signer, writable]` Authority allowed to remove (gumball machine authority or item seller).',
        '4. `[writable]` Seller account (owner of the tokens).',
        '5. `[]` Mint account',
        "6. `[writable]` Seller's token account",
        "7. `[writable]` Gumball machine's token account",
        '8. `[]` Token program',
        '9. `[]` Associated Token program',
        '10. `[]` System program',
        '11. `[]` Rent sysvar',
      ];
      discriminator: [104, 237, 41, 235, 15, 227, 222, 74];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authority';
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ];
          writable: true;
          signer: true;
        },
        {
          name: 'seller';
          writable: true;
          relations: ['sellerHistory'];
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'startIndex';
          type: 'u32';
        },
        {
          name: 'endIndex';
          type: 'u32';
        },
      ];
    },
    {
      name: 'requestAddCnft';
      docs: [
        'Request to add a compressed NFT to the gumball machine (collab flow).',
        'Escrows the leaf and creates a request account keyed by the asset id.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '2. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset_id])',
        '3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '4. `[signer, writable]` Seller (leaf owner)',
        '5. `[]` Asset id (Bubblegum PDA; not a real account)',
        '6. `[]` Bubblegum tree config PDA',
        '7. `[writable]` Merkle tree',
        '8. `[]` SPL No-op (log wrapper) program',
        '9. `[]` SPL Account Compression program',
        '10. `[]` Bubblegum program',
        '11. `[]` System program',
        'Remaining accounts: merkle proof nodes',
      ];
      discriminator: [189, 159, 171, 46, 145, 188, 38, 32];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'addItemRequest';
          docs: ['Add item request account, keyed by the asset id.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'asset';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the cNFT (current leaf owner).'];
          writable: true;
          signer: true;
        },
        {
          name: 'asset';
          docs: [
            'The cNFT asset id (a Bubblegum PDA; not a real account). Used only as the',
            'request PDA seed and bound to (merkle_tree, nonce) in the handler.',
          ];
        },
        {
          name: 'treeConfig';
        },
        {
          name: 'merkleTree';
          writable: true;
        },
        {
          name: 'logWrapper';
          address: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
        },
        {
          name: 'compressionProgram';
          address: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';
        },
        {
          name: 'bubblegumProgram';
          address: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'cnftArgs';
            };
          };
        },
      ];
    },
    {
      name: 'requestAddCoreAsset';
      docs: [
        'Request to add a core asset to the gumball machine.',
        "Freezes the seller's asset and creates a request account.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account.',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).',
        '2. `[writable]` Add item request account (PDA, seeds: ["add_item_request", asset]).',
        '3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).',
        '4. `[signer, writable]` Seller of the asset.',
        '5. `[writable]` Asset account.',
        '6. `[writable, optional]` Collection account if asset is part of one.',
        '7. `[]` MPL Core program.',
        '8. `[]` System program.',
      ];
      discriminator: [146, 149, 3, 10, 129, 64, 146, 87];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'addItemRequest';
          docs: ['Add item request account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'asset';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the asset.'];
          writable: true;
          signer: true;
        },
        {
          name: 'asset';
          writable: true;
        },
        {
          name: 'collection';
          docs: ["Core asset's collection if it's part of one."];
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'requestAddNft';
      docs: [
        'Request to add a NFT to the gumball machine.',
        "Freezes the seller's NFT and creates a request account.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account.',
        '1. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller]).',
        '2. `[writable]` Add item request account (PDA, seeds: ["add_item_request", mint]).',
        '3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine]).',
        '4. `[signer, writable]` Seller of the nft.',
        '5. `[]` Mint account of the NFT.',
        "6. `[writable]` Seller's token account for the NFT.",
        '7. `[writable]` Metadata account of the NFT.',
        '8. `[]` Edition account of the NFT.',
        '9. `[]` Token program.',
        '10. `[]` Token Metadata program.',
        '11. `[]` System program.',
        '12. `[writable, optional]` Seller token record (pNFT).',
        '13. `[optional]` Auth rules account (pNFT).',
        '14. `[optional]` Instructions sysvar (pNFT).',
        '15. `[optional]` Auth rules program (pNFT).',
      ];
      discriminator: [144, 146, 226, 91, 44, 123, 85, 105];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'addItemRequest';
          docs: ['Add item request account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  97,
                  100,
                  100,
                  95,
                  105,
                  116,
                  101,
                  109,
                  95,
                  114,
                  101,
                  113,
                  117,
                  101,
                  115,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'mint';
              },
            ];
          };
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
          signer: true;
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'metadata';
          writable: true;
        },
        {
          name: 'edition';
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'tokenMetadataProgram';
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'sellerTokenRecord';
          docs: ['OPTIONAL PNFT ACCOUNTS'];
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
      ];
      args: [];
    },
    {
      name: 'sellItem';
      docs: [
        'Sell an item back to the gumball machine using buy back funds.',
        'The payer must be the seller or the oracle_signer.',
        'Buying back to the gumball machine is currently not supported, but will be in the future.',
        'If buying back to the authority, the item is marked as claimed and transferred to the buyer (authority).',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (must be seller or oracle_signer)',
        '1. `[signer]` Oracle signer (must match buy_back_config)',
        '2. `[writable]` Gumball Machine account',
        '3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '4. `[writable]` Mint account of the item (or Asset account for Core)',
        '5. `[writable]` Seller account',
        '6. `[writable]` Buyer account (must be gumball machine or authority)',
        '7. `[]` System program',
        '8. `[]` Token program',
        '9. `[]` Associated Token program',
        '10. `[]` Rent sysvar',
        '11. `[writable, optional]` Fee account (if fee configured)',
        '12. `[writable, optional]` Fee payment account (if fee configured)',
        '13. `[writable, optional]` Payment mint (if not native SOL)',
        '14. `[writable, optional]` Seller payment account (if not native SOL)',
        '15. `[writable, optional]` Authority PDA payment account (if not native SOL)',
        '16. `[writable, optional]` Collection account (for Core asset)',
        '17. `[optional]` MPL Core program (for Core asset)',
        '18. `[writable, optional]` Authority PDA token account (for NFT/Fungible)',
        '19. `[writable, optional]` Seller token account (for NFT/Fungible)',
        '20. `[writable, optional]` Buyer token account (for NFT/Fungible)',
        '21. `[writable, optional]` Metadata account (for NFT/PNFT)',
        '22. `[writable, optional]` Edition account (for NFT/PNFT)',
        '23. `[optional]` Token Metadata program (for NFT/PNFT)',
        '24. `[writable, optional]` Authority PDA token record (for pNFT)',
        '25. `[writable, optional]` Buyer token record (for pNFT)',
        '26. `[optional]` Auth rules account (for pNFT)',
        '27. `[optional]` Instructions sysvar (for pNFT)',
        '28. `[optional]` Auth rules program (for pNFT)',
      ];
      discriminator: [44, 114, 171, 76, 76, 10, 150, 246];
      accounts: [
        {
          name: 'payer';
          docs: [
            'Must be the oracle signer or seller (oracle signer can sell on behalf of the seller to allow auto-buy back)',
          ];
          writable: true;
          signer: true;
        },
        {
          name: 'oracleSigner';
          docs: ['Oracle signer'];
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'mint';
          docs: ['Mint of the item (or asset for Core assets)'];
          writable: true;
        },
        {
          name: 'seller';
          docs: ['Seller of the item'];
          writable: true;
        },
        {
          name: 'buyer';
          docs: ['Buyer of the item'];
          writable: true;
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'feeAccount';
          docs: [
            'OPTIONAL FEE ACCOUNTS - only required if there is a fee config on the gumball machine',
            'Marketplace fee account',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'feePaymentAccount';
          docs: ['Marketplace fee payment account'];
          writable: true;
          optional: true;
        },
        {
          name: 'paymentMint';
          docs: [
            'OPTIONAL SPL TOKEN ACCOUNTS - only required if selling for SPL token',
            'Mint of payment token',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerPaymentAccount';
          docs: ['Seller payment account'];
          writable: true;
          optional: true;
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Authority PDA payment account'];
          writable: true;
          optional: true;
        },
        {
          name: 'collection';
          docs: [
            'OPTIONAL CORE ASSET ACCOUNTS - only required if selling Core asset',
            'Collection of the asset',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          optional: true;
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'authorityPdaTokenAccount';
          docs: [
            'OPTIONAL TOKEN ACCOUNTS - only required if selling NFT or Fungible assets',
            'Authority PDA token account',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerTokenAccount';
          docs: ['Seller token account'];
          writable: true;
          optional: true;
        },
        {
          name: 'buyerTokenAccount';
          docs: ['Buyer token account'];
          writable: true;
          optional: true;
        },
        {
          name: 'metadata';
          docs: [
            'OPTIONAL NFT ACCOUNTS - only required if selling NFT or PNFT',
          ];
          writable: true;
          optional: true;
        },
        {
          name: 'edition';
          writable: true;
          optional: true;
        },
        {
          name: 'tokenMetadataProgram';
          optional: true;
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'authorityPdaTokenRecord';
          docs: ['OPTIONAL PNFT ACCOUNTS - only required if selling PNFT'];
          writable: true;
          optional: true;
        },
        {
          name: 'buyerTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
        {
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'buyPrice';
          type: 'u64';
        },
      ];
    },
    {
      name: 'setAuthority';
      docs: [
        'Set a new authority of the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
      ];
      discriminator: [133, 250, 37, 21, 110, 163, 26, 121];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: ['Autority of the gumball machine.'];
          signer: true;
          relations: ['gumballMachine'];
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
      name: 'setMintAuthority';
      docs: [
        'Set a new mint authority of the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
        '2. `[signer]` New gumball machine authority',
      ];
      discriminator: [67, 127, 155, 187, 100, 174, 103, 121];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine account.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: ['Gumball Machine authority'];
          signer: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'mintAuthority';
          docs: ['New gumball machine authority'];
          signer: true;
        },
      ];
      args: [];
    },
    {
      name: 'settleCnftSale';
      docs: [
        'Settles a compressed NFT sale.',
        'If unclaimed, transfers the leaf out of escrow (verifying creator/data',
        'hash), then distributes proceeds. Royalties are paid from the proof-bound',
        'creators arg. If already claimed, the creators/sfbp args are instead bound',
        'to the asset via a `VerifyLeaf` CPI on the current leaf',
        '(`current_leaf_owner`/`current_leaf_delegate` from DAS, current root/proof).',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can settle)',
        '1. `[writable]` Gumball Machine account (must be settleable)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable, optional]` Authority PDA payment account',
        '4. `[writable]` Authority account',
        '5. `[writable, optional]` Authority payment account',
        '6. `[writable]` Seller account',
        '7. `[writable, optional]` Seller payment account',
        '8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '9. `[writable]` Buyer account',
        '10. `[writable, optional]` Fee account',
        '11. `[writable, optional]` Fee payment account',
        '12. `[optional]` Payment mint',
        '13. `[]` Token program',
        '14. `[]` Associated Token program',
        '15. `[]` System program',
        '16. `[]` Rent sysvar',
        '17. `[]` Bubblegum tree config PDA',
        '18. `[writable]` Merkle tree',
        '19. `[]` SPL No-op (log wrapper) program',
        '20. `[]` SPL Account Compression program',
        '21. `[]` Bubblegum program',
        'Remaining accounts: creator payout accounts, then merkle proof nodes',
      ];
      discriminator: [44, 62, 213, 87, 206, 251, 138, 156];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale.'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment.'];
          writable: true;
          optional: true;
        },
        {
          name: 'authority';
          writable: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPaymentAccount';
          docs: ['Payment account for authority if using token payment.'];
          writable: true;
          optional: true;
        },
        {
          name: 'seller';
          docs: ['Seller of the cNFT.'];
          writable: true;
        },
        {
          name: 'sellerPaymentAccount';
          docs: ['Payment account for seller if using token payment.'];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'buyer';
          docs: [
            'Buyer of the cNFT. Not `mut`: the account is only read (`.key()` /',
            'leaf-transfer target), never written. Marking it `mut` would break unsold',
            'settle, where `buyer == Pubkey::default()` (the System Program) cannot be',
            'a writable account. Mirrors `settle_nft_sale`.',
          ];
        },
        {
          name: 'feeAccount';
          docs: ['Fee account for marketplace fee if using fee config.'];
          writable: true;
          optional: true;
        },
        {
          name: 'feePaymentAccount';
          docs: ['Payment account for marketplace fee if using token payment.'];
          writable: true;
          optional: true;
        },
        {
          name: 'paymentMint';
          docs: ['Payment mint if using non-native payment token.'];
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'treeConfig';
        },
        {
          name: 'merkleTree';
          docs: ['`assert_config_line`.'];
          writable: true;
        },
        {
          name: 'logWrapper';
          address: 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV';
        },
        {
          name: 'compressionProgram';
          address: 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK';
        },
        {
          name: 'bubblegumProgram';
          address: 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
        {
          name: 'args';
          type: {
            defined: {
              name: 'cnftArgs';
            };
          };
        },
        {
          name: 'currentLeafOwner';
          type: 'pubkey';
        },
        {
          name: 'currentLeafDelegate';
          type: 'pubkey';
        },
      ];
    },
    {
      name: 'settleCoreAssetSale';
      docs: [
        'Settles a Core asset sale',
        "If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified).",
        'Distributes proceeds according to royalties and fee configuration.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can settle the sale)',
        '1. `[writable]` Gumball Machine account (must be in SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable, optional]` Authority PDA payment account',
        '4. `[writable]` Authority account',
        '5. `[writable, optional]` Authority payment account',
        '6. `[writable]` Seller account',
        '7. `[writable, optional]` Seller payment account',
        '8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '9. `[]` Buyer account',
        '10. `[writable, optional]` Fee account',
        '11. `[writable, optional]` Fee payment account',
        '12. `[optional]` Payment mint',
        '13. `[]` Token program',
        '14. `[]` Associated Token program',
        '15. `[]` System program',
        '16. `[]` Rent sysvar',
        '17. `[writable]` Asset account',
        '18. `[writable, optional]` Collection account if asset is part of one.',
        '19. `[]` MPL Core program.',
        'Remaining accounts: Royalty recipients',
      ];
      discriminator: [78, 55, 252, 82, 233, 15, 98, 51];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'authority';
          docs: ['Seller of the nft'];
          writable: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPaymentAccount';
          docs: ['Payment account for authority if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
        },
        {
          name: 'sellerPaymentAccount';
          docs: ['Payment account for seller if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'buyer';
          docs: ['buyer of the nft'];
        },
        {
          name: 'feeAccount';
          docs: ['Fee account for marketplace fee if using fee config'];
          writable: true;
          optional: true;
        },
        {
          name: 'feePaymentAccount';
          docs: ['Payment account for marketplace fee if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'paymentMint';
          docs: ['Payment mint if using non-native payment token'];
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'asset';
          writable: true;
        },
        {
          name: 'collection';
          writable: true;
          optional: true;
        },
        {
          name: 'mplCoreProgram';
          address: 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'settleNftSale';
      docs: [
        'Settles a legacy NFT sale',
        "If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified).",
        'Distributes proceeds according to royalties and fee configuration. Marks primary sale happened if applicable.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can settle the sale)',
        '1. `[writable]` Gumball Machine account (must be in SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable, optional]` Authority PDA payment account',
        '4. `[writable]` Authority account',
        '5. `[writable, optional]` Authority payment account',
        '6. `[writable]` Seller account',
        '7. `[writable, optional]` Seller payment account',
        '8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '9. `[]` Buyer account',
        '10. `[writable, optional]` Fee account',
        '11. `[writable, optional]` Fee payment account',
        '12. `[optional]` Payment mint',
        '13. `[]` Token program',
        '14. `[]` Associated Token program',
        '15. `[]` System program',
        '16. `[]` Rent sysvar',
        '17. `[]` Mint account',
        "18. `[writable]` Buyer's token account",
        "19. `[writable]` Authority PDA's token account",
        '20. `[writable]` Metadata account',
        '21. `[writable]` Edition account',
        '22. `[]` Token Metadata program',
        '23. `[writable, optional]` Seller token record (pNFT)',
        '24. `[writable, optional]` Authority PDA token record (pNFT)',
        '25. `[writable, optional]` Buyer token record (pNFT)',
        '26. `[optional]` Auth rules account (pNFT)',
        '27. `[optional]` Instructions sysvar (pNFT)',
        '28. `[optional]` Auth rules program (pNFT)',
        'Remaining accounts: Royalty recipients',
      ];
      discriminator: [31, 37, 41, 148, 108, 197, 35, 63];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'authority';
          docs: ['Seller of the nft'];
          writable: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPaymentAccount';
          docs: ['Payment account for authority if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'seller';
          docs: ['Seller of the nft'];
          writable: true;
        },
        {
          name: 'sellerPaymentAccount';
          docs: ['Payment account for seller if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'buyer';
          docs: ['buyer of the nft'];
        },
        {
          name: 'feeAccount';
          docs: ['Fee account for marketplace fee if using fee config'];
          writable: true;
          optional: true;
        },
        {
          name: 'feePaymentAccount';
          docs: ['Payment account for marketplace fee if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'paymentMint';
          docs: ['Payment mint if using non-native payment token'];
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'mint';
        },
        {
          name: 'tokenAccount';
          writable: true;
        },
        {
          name: 'buyerTokenAccount';
          docs: ['Nft token account for buyer'];
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'metadata';
          writable: true;
        },
        {
          name: 'edition';
          writable: true;
        },
        {
          name: 'tokenMetadataProgram';
          address: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        },
        {
          name: 'sellerTokenRecord';
          docs: ['OPTIONAL PNFT ACCOUNTS'];
          writable: true;
          optional: true;
        },
        {
          name: 'authorityPdaTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'buyerTokenRecord';
          writable: true;
          optional: true;
        },
        {
          name: 'authRules';
          optional: true;
        },
        {
          name: 'instructions';
          optional: true;
          address: 'Sysvar1nstructions1111111111111111111111111';
        },
        {
          name: 'authRulesProgram';
          optional: true;
          address: 'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg';
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'settleTokensSale';
      docs: [
        'Settles a fungible tokens sale',
        "If the item hasn't been claimed yet, it claims it for the seller (or buyer if specified).",
        'Distributes proceeds according to fee configuration.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can settle the sale)',
        '1. `[writable]` Gumball Machine account (must be in SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable, optional]` Authority PDA payment account',
        '4. `[writable]` Authority account',
        '5. `[writable, optional]` Authority payment account',
        '6. `[writable]` Seller account',
        '7. `[writable, optional]` Seller payment account',
        '8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '9. `[]` Buyer account',
        '10. `[writable, optional]` Fee account',
        '11. `[writable, optional]` Fee payment account',
        '12. `[optional]` Payment mint',
        '13. `[]` Token program',
        '14. `[]` Associated Token program',
        '15. `[]` System program',
        '16. `[]` Rent sysvar',
        '17. `[]` Mint account',
        "18. `[writable]` Receiver's token account (buyer or seller if buyer is default)",
        "19. `[writable]` Authority PDA's token account",
        'Remaining accounts: Fee recipients',
      ];
      discriminator: [49, 246, 210, 13, 79, 165, 190, 113];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'authority';
          docs: ['Seller of the nft'];
          writable: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPaymentAccount';
          docs: ['Payment account for authority if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'seller';
          docs: ['Seller of the item'];
          writable: true;
        },
        {
          name: 'sellerPaymentAccount';
          docs: ['Payment account for seller if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'buyer';
          docs: ['buyer of the item'];
        },
        {
          name: 'feeAccount';
          docs: ['Fee account for marketplace fee if using fee config'];
          writable: true;
          optional: true;
        },
        {
          name: 'feePaymentAccount';
          docs: ['Payment account for marketplace fee if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'paymentMint';
          docs: ['Payment mint if using non-native payment token'];
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'mint';
        },
        {
          name: 'receiverTokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        },
      ];
    },
    {
      name: 'settleTokensSaleClaimed';
      docs: [
        'Settles a fungible tokens sale that has already been claimed by the buyer or does not have a buyer.',
        'This can settle multiple items in a single transaction via the `start_index` and `end_index` args.',
        'Distributes proceeds according to fee configuration and sends unsold tokens back to the seller.',
        '',
        '# Accounts',
        '',
        '0. `[signer, writable]` Payer (anyone can settle the sale)',
        '1. `[writable]` Gumball Machine account (must be in SaleEnded state)',
        '2. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '3. `[writable, optional]` Authority PDA payment account',
        '4. `[writable]` Authority account',
        '5. `[writable, optional]` Authority payment account',
        '6. `[writable]` Seller account',
        '7. `[writable, optional]` Seller payment account',
        '8. `[writable]` Seller history account (PDA, seeds: ["seller_history", gumball_machine, seller])',
        '9. `[optional]` Payment mint',
        '10. `[]` Token program',
        '11. `[]` Associated Token program',
        '12. `[]` System program',
        '13. `[]` Rent sysvar',
        '14. `[]` Mint account',
        "15. `[writable]` Seller's token account (for receiving unsold tokens)",
        "16. `[writable]` Authority PDA's token account",
        'Remaining accounts: Fee recipients',
      ];
      discriminator: [78, 10, 170, 112, 84, 2, 243, 13];
      accounts: [
        {
          name: 'payer';
          docs: ['Anyone can settle the sale'];
          writable: true;
          signer: true;
        },
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'authority';
          docs: ['Seller of the tokens'];
          writable: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPaymentAccount';
          docs: ['Payment account for authority if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'seller';
          docs: ['Seller of the item'];
          writable: true;
        },
        {
          name: 'sellerPaymentAccount';
          docs: ['Payment account for seller if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'sellerHistory';
          docs: ['Seller history account.'];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  115,
                  101,
                  108,
                  108,
                  101,
                  114,
                  95,
                  104,
                  105,
                  115,
                  116,
                  111,
                  114,
                  121,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
              {
                kind: 'account';
                path: 'seller';
              },
            ];
          };
        },
        {
          name: 'paymentMint';
          docs: ['Payment mint if using non-native payment token'];
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
        {
          name: 'rent';
          address: 'SysvarRent111111111111111111111111111111111';
        },
        {
          name: 'mint';
        },
        {
          name: 'sellerTokenAccount';
          writable: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          writable: true;
        },
        {
          name: 'eventAuthority';
        },
        {
          name: 'program';
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'settleTokensSaleClaimedArgs';
            };
          };
        },
      ];
    },
    {
      name: 'startSale';
      docs: [
        'Allows minting to begin.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority (authority or mint_authority)',
      ];
      discriminator: [130, 69, 235, 113, 173, 219, 48, 228];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: [
            'Gumball Machine authority. This can be the mint authority or the authority.',
          ];
          signer: true;
        },
      ];
      args: [];
    },
    {
      name: 'updateSettings';
      docs: [
        'Updates gumball machine settings.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer, writable]` Gumball Machine authority',
      ];
      discriminator: [81, 166, 51, 213, 158, 84, 157, 108];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball machine account.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
          ];
          writable: true;
          signer: true;
          relations: ['gumballMachine'];
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: {
              name: 'updateArgs';
            };
          };
        },
      ];
    },
    {
      name: 'withdraw';
      docs: [
        'Withdraw the rent lamports and send them to the authority address.',
        'If a non-native payment mint was used, also closes the PDA payment token account,',
        "sending its balance to the authority's associated token account.",
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account (will be closed)',
        '1. `[signer, writable]` Gumball Machine authority',
        '2. `[signer, writable]` Gumball Machine mint authority',
        '3. `[writable]` Authority PDA (PDA, seeds: ["authority", gumball_machine])',
        '4. `[writable, optional]` Authority PDA payment account',
        '5. `[]` Token program',
        'Remaining accounts (if closing non-native payment account):',
        '- `[]` Payment Mint',
        "- `[writable]` Authority's token account for payment mint",
        '- `[]` Associated Token program',
        '- `[]` System program',
        '- `[]` Rent sysvar',
      ];
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34];
      accounts: [
        {
          name: 'gumballMachine';
          docs: ['Gumball Machine acccount.'];
          writable: true;
        },
        {
          name: 'authority';
          docs: ['Authority of the gumball machine.'];
          writable: true;
          signer: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'mintAuthority';
          docs: ['Mint authority of the gumball machine.'];
          writable: true;
          signer: true;
          relations: ['gumballMachine'];
        },
        {
          name: 'authorityPda';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  103,
                  117,
                  109,
                  98,
                  97,
                  108,
                  108,
                  95,
                  109,
                  97,
                  99,
                  104,
                  105,
                  110,
                  101,
                ];
              },
              {
                kind: 'account';
                path: 'gumballMachine';
              },
            ];
          };
        },
        {
          name: 'authorityPdaPaymentAccount';
          docs: ['Payment account for authority pda if using token payment'];
          writable: true;
          optional: true;
        },
        {
          name: 'tokenProgram';
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
        },
      ];
      args: [];
    },
  ];
  accounts: [
    {
      name: 'addItemRequest';
      discriminator: [234, 140, 142, 7, 121, 224, 48, 173];
    },
    {
      name: 'gumballMachine';
      discriminator: [87, 13, 57, 25, 98, 234, 26, 27];
    },
    {
      name: 'sellerHistory';
      discriminator: [88, 76, 98, 176, 228, 154, 34, 164];
    },
  ];
  events: [
    {
      name: 'claimItemEvent';
      discriminator: [60, 75, 118, 64, 253, 30, 11, 170];
    },
    {
      name: 'drawItemEvent';
      discriminator: [61, 185, 5, 236, 195, 249, 169, 187];
    },
    {
      name: 'idlHints';
      discriminator: [142, 251, 39, 135, 71, 0, 96, 192];
    },
    {
      name: 'sellItemEvent';
      discriminator: [182, 63, 192, 231, 178, 105, 22, 110];
    },
    {
      name: 'settleItemSaleEvent';
      discriminator: [67, 22, 152, 187, 101, 153, 165, 217];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'incorrectOwner';
      msg: 'Account does not have correct owner';
    },
    {
      code: 6001;
      name: 'uninitialized';
      msg: 'Account is not initialized';
    },
    {
      code: 6002;
      name: 'mintMismatch';
      msg: 'Mint Mismatch';
    },
    {
      code: 6003;
      name: 'indexGreaterThanLength';
      msg: 'Index greater than length';
    },
    {
      code: 6004;
      name: 'numericalOverflowError';
      msg: 'Numerical overflow error';
    },
    {
      code: 6005;
      name: 'tooManyCreators';
      msg: 'Can only provide up to 4 creators to gumball machine (because gumball machine is one)';
    },
    {
      code: 6006;
      name: 'gumballMachineEmpty';
      msg: 'Gumball machine is empty';
    },
    {
      code: 6007;
      name: 'hiddenSettingsDoNotHaveConfigLines';
      msg: 'Gumball machines using hidden uris do not have config lines, they have a single hash representing hashed order';
    },
    {
      code: 6008;
      name: 'cannotChangeNumberOfLines';
      msg: 'Cannot change number of lines unless is a hidden config';
    },
    {
      code: 6009;
      name: 'cannotSwitchToHiddenSettings';
      msg: 'Cannot switch to hidden settings after items available is greater than 0';
    },
    {
      code: 6010;
      name: 'incorrectCollectionAuthority';
      msg: 'Incorrect collection NFT authority';
    },
    {
      code: 6011;
      name: 'metadataAccountMustBeEmpty';
      msg: 'The metadata account has data in it, and this must be empty to mint a new NFT';
    },
    {
      code: 6012;
      name: 'noChangingCollectionDuringMint';
      msg: "Can't change collection settings after items have begun to be minted";
    },
    {
      code: 6013;
      name: 'exceededLengthError';
      msg: 'Value longer than expected maximum value';
    },
    {
      code: 6014;
      name: 'missingConfigLinesSettings';
      msg: 'Missing config lines settings';
    },
    {
      code: 6015;
      name: 'cannotIncreaseLength';
      msg: 'Cannot increase the length in config lines settings';
    },
    {
      code: 6016;
      name: 'cannotSwitchFromHiddenSettings';
      msg: 'Cannot switch from hidden settings';
    },
    {
      code: 6017;
      name: 'cannotChangeSequentialIndexGeneration';
      msg: 'Cannot change sequential index generation after items have begun to be minted';
    },
    {
      code: 6018;
      name: 'collectionKeyMismatch';
      msg: 'Collection public key mismatch';
    },
    {
      code: 6019;
      name: 'couldNotRetrieveConfigLineData';
      msg: 'Could not retrive config line data';
    },
    {
      code: 6020;
      name: 'notFullyLoaded';
      msg: 'Not all config lines were added to the gumball machine';
    },
    {
      code: 6021;
      name: 'instructionBuilderFailed';
      msg: 'Instruction could not be created';
    },
    {
      code: 6022;
      name: 'missingCollectionAuthorityRecord';
      msg: 'Missing collection authority record';
    },
    {
      code: 6023;
      name: 'missingMetadataDelegateRecord';
      msg: 'Missing metadata delegate record';
    },
    {
      code: 6024;
      name: 'invalidTokenStandard';
      msg: 'Invalid token standard';
    },
    {
      code: 6025;
      name: 'missingTokenAccount';
      msg: 'Missing token account';
    },
    {
      code: 6026;
      name: 'missingTokenRecord';
      msg: 'Missing token record';
    },
    {
      code: 6027;
      name: 'missingInstructionsSysvar';
      msg: 'Missing instructions sysvar account';
    },
    {
      code: 6028;
      name: 'missingSplAtaProgram';
      msg: 'Missing SPL ATA program';
    },
    {
      code: 6029;
      name: 'invalidAccountVersion';
      msg: 'Invalid account version';
    },
    {
      code: 6030;
      name: 'notPrimarySale';
      msg: 'Not a primary sale asset';
    },
    {
      code: 6031;
      name: 'invalidEditionAccount';
      msg: 'Invalid edition account';
    },
    {
      code: 6032;
      name: 'invalidMasterEditionSupply';
      msg: 'Invalid master edition supply';
    },
    {
      code: 6033;
      name: 'publicKeyMismatch';
      msg: 'Public key mismatch';
    },
    {
      code: 6034;
      name: 'invalidCollection';
      msg: 'Invalid collection';
    },
    {
      code: 6035;
      name: 'gumballMachineDetailsFinalized';
      msg: 'Gumball machine detailed finalized';
    },
    {
      code: 6036;
      name: 'invalidState';
      msg: 'Invalid state';
    },
    {
      code: 6037;
      name: 'invalidAuthority';
      msg: 'Invalid authority';
    },
    {
      code: 6038;
      name: 'invalidMintAuthority';
      msg: 'Invalid mint authority';
    },
    {
      code: 6039;
      name: 'invalidMint';
      msg: 'Invalid mint';
    },
    {
      code: 6040;
      name: 'invalidPaymentMint';
      msg: 'Invalid payment mint';
    },
    {
      code: 6041;
      name: 'invalidSeller';
      msg: 'Invalid seller';
    },
    {
      code: 6042;
      name: 'invalidBuyer';
      msg: 'Invalid buyer';
    },
    {
      code: 6043;
      name: 'uriTooLong';
      msg: 'URI too long';
    },
    {
      code: 6044;
      name: 'invalidProofPath';
      msg: 'Invalid proof path';
    },
    {
      code: 6045;
      name: 'invalidSettingUpdate';
      msg: 'Invalid setting update';
    },
    {
      code: 6046;
      name: 'sellerTooManyItems';
      msg: 'Seller has too many items';
    },
    {
      code: 6047;
      name: 'notAllSettled';
      msg: 'Not all items have been settled';
    },
    {
      code: 6048;
      name: 'itemAlreadySettled';
      msg: 'Item already settled';
    },
    {
      code: 6049;
      name: 'itemAlreadyClaimed';
      msg: 'Item already claimed';
    },
    {
      code: 6050;
      name: 'itemAlreadyDrawn';
      msg: 'Item already drawn';
    },
    {
      code: 6051;
      name: 'invalidGumballMachine';
      msg: 'Invalid gumball machine';
    },
    {
      code: 6052;
      name: 'sellerCannotBeAuthority';
      msg: 'Seller cannot be authority';
    },
    {
      code: 6053;
      name: 'invalidAssetPlugin';
      msg: 'Asset has an invalid plugin';
    },
    {
      code: 6054;
      name: 'invalidAmount';
      msg: 'Invalid amount';
    },
    {
      code: 6055;
      name: 'duplicateIndex';
      msg: 'Duplicate index';
    },
    {
      code: 6056;
      name: 'invalidInputLength';
      msg: 'Invalid input length';
    },
    {
      code: 6057;
      name: 'buyBackNotEnabled';
      msg: 'Buy back not enabled';
    },
    {
      code: 6058;
      name: 'buyBackFundsNotZero';
      msg: 'Buy back funds not zero';
    },
    {
      code: 6059;
      name: 'insufficientFunds';
      msg: 'Insufficient funds';
    },
    {
      code: 6060;
      name: 'invalidVersion';
      msg: 'Invalid version';
    },
    {
      code: 6061;
      name: 'invalidOracleSigner';
      msg: 'Invalid oracle signer';
    },
    {
      code: 6062;
      name: 'invalidPayer';
      msg: 'Invalid payer';
    },
    {
      code: 6063;
      name: 'notImplemented';
      msg: 'Not implemented';
    },
    {
      code: 6064;
      name: 'buyBackCutoffReached';
      msg: 'Buy back cutoff reached';
    },
    {
      code: 6065;
      name: 'notASoloGumball';
      msg: 'Not a solo gumball';
    },
    {
      code: 6066;
      name: 'itemNotClaimed';
      msg: 'Item not claimed';
    },
    {
      code: 6067;
      name: 'itemNotSettled';
      msg: 'Item not settled';
    },
    {
      code: 6068;
      name: 'missingItemIndex';
      msg: 'Missing item index';
    },
    {
      code: 6069;
      name: 'unsupportedCnftVersion';
      msg: 'Unsupported Bubblegum version (only V1 compressed NFTs can be traded)';
    },
    {
      code: 6070;
      name: 'invalidMerkleTree';
      msg: 'Invalid merkle tree for the stored asset id';
    },
    {
      code: 6071;
      name: 'accountAlreadyInitialized';
      msg: 'Account is already initialized';
    },
  ];
  types: [
    {
      name: 'addItemArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'sellerProofPath';
            type: {
              option: {
                vec: {
                  array: ['u8', 32];
                };
              };
            };
          },
          {
            name: 'index';
            type: {
              option: 'u32';
            };
          },
        ];
      };
    },
    {
      name: 'addItemRequest';
      docs: ['Add item request state.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'gumballMachine';
            docs: ['Gumball machine address.'];
            type: 'pubkey';
          },
          {
            name: 'seller';
            docs: ['Seller address.'];
            type: 'pubkey';
          },
          {
            name: 'asset';
            docs: ['Asset address.'];
            type: 'pubkey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: {
                name: 'tokenStandard';
              };
            };
          },
        ];
      };
    },
    {
      name: 'buyBackConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'enabled';
            docs: ['Whether buying back prizes is enabled'];
            type: 'bool';
          },
          {
            name: 'toGumballMachine';
            docs: [
              'Whether buying back prizes should be added back to the gumball machine (not yet supported)',
            ];
            type: 'bool';
          },
          {
            name: 'oracleSigner';
            docs: [
              'Authority that must sign when buying back prizes, to ensure pricing is correct',
            ];
            type: 'pubkey';
          },
          {
            name: 'valuePct';
            docs: [
              'Percentage of prize value the creator/gumball machine will pay for buying back prizes',
            ];
            type: 'u8';
          },
          {
            name: 'marketplaceFeeBps';
            docs: [
              'Fee in basis points paid to marketplace authority when buying back prizes (paid from funds_available)',
            ];
            type: 'u16';
          },
          {
            name: 'cutoffPct';
            docs: [
              'Buy backs are disabled when the percentage of items remaining is less than or equal to this value',
              '0 means there is no cutoff, 100 means buy back is always disabled, 50 means buy back is disabled when 50% of items are sold',
              'If an item is sold back to the gumball machine to increase the remaining % above this cutoff, buy back is re-enabled',
            ];
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'claimItemEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            type: 'pubkey';
          },
          {
            name: 'authority';
            type: 'pubkey';
          },
          {
            name: 'seller';
            type: 'pubkey';
          },
          {
            name: 'buyer';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'cnftArgs';
      docs: [
        'Leaf parameters shared by all compressed-NFT instructions.',
        '',
        'Everything here is verified against the on-chain merkle root by the Bubblegum',
        'V1 `Transfer` CPI: a lie about `seller_fee_basis_points` changes `data_hash`',
        'and a lie about `creators` changes `creator_hash`, either of which makes the',
        'proof fail. This is what makes royalties trustless without server trust.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'root';
            docs: [
              'Current merkle root (fetched fresh from DAS at build time).',
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'metaHash';
            docs: [
              'Inner `keccak(borsh(MetadataArgs))` supplied from DAS. `data_hash` is',
              'recomputed on-chain as `keccak(meta_hash ‖ sfbp_le)`.',
            ];
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'sellerFeeBasisPoints';
            docs: ['Seller fee basis points, folded into `data_hash`.'];
            type: 'u16';
          },
          {
            name: 'creators';
            docs: [
              'Creators, folded into `creator_hash` and used for royalty payouts.',
            ];
            type: {
              vec: {
                defined: {
                  name: 'cnftCreator';
                };
              };
            };
          },
          {
            name: 'nonce';
            docs: [
              'Leaf nonce. Binds the asset id: `asset_id = PDA(["asset", tree, nonce_le])`.',
            ];
            type: 'u64';
          },
          {
            name: 'index';
            docs: ['Leaf index within the merkle tree.'];
            type: 'u32';
          },
          {
            name: 'version';
            docs: [
              'Bubblegum leaf version. Only V1 (`1`) is supported for on-chain trading;',
              'V2 leaves are rejected (see `assert_cnft_v1`).',
            ];
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'cnftCreator';
      docs: [
        'Creator entry for a compressed NFT leaf.',
        '',
        'Mirrors the field layout of `mpl_bubblegum::types::Creator` /',
        '`mpl_token_metadata::types::Creator`, but is defined locally so it can be used',
        'directly as an Anchor instruction argument (the mpl types only derive borsh,',
        'not `AnchorSerialize`/`AnchorDeserialize`). The `(address, verified, share)`',
        'tuple is folded into `creator_hash` exactly as Bubblegum does on-chain, so',
        'these values are proof-bound by the Transfer CPI.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'address';
            docs: ['Creator wallet.'];
            type: 'pubkey';
          },
          {
            name: 'verified';
            docs: ['Whether the creator is verified on the leaf.'];
            type: 'bool';
          },
          {
            name: 'share';
            docs: ['Royalty share (0-100). Sum across creators must be 100.'];
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'configLine';
      docs: ['Config line struct for storing asset data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'pubkey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'pubkey';
          },
          {
            name: 'buyer';
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.',
            ];
            type: 'pubkey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: {
                name: 'tokenStandard';
              };
            };
          },
        ];
      };
    },
    {
      name: 'configLineInput';
      docs: ['Config line struct for storing asset (NFT) data pre-mint.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'pubkey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'pubkey';
          },
        ];
      };
    },
    {
      name: 'configLineV2';
      docs: ['Config line struct for storing asset data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'pubkey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'pubkey';
          },
          {
            name: 'buyer';
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.',
            ];
            type: 'pubkey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: {
                name: 'tokenStandard';
              };
            };
          },
          {
            name: 'amount';
            docs: ['Amount of the asset.'];
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'configLineV2Input';
      docs: ['Config line struct for storing asset (NFT) data pre-mint.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'pubkey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'pubkey';
          },
          {
            name: 'amount';
            docs: ['Amount of the asset.'];
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'drawItemEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            type: 'pubkey';
          },
          {
            name: 'buyer';
            type: 'pubkey';
          },
          {
            name: 'index';
            type: 'u32';
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
        'The gumball machine account is variable-size and manually (de)serialized, so',
        "Anchor's IDL generator never encounters the config-line structs and omits",
        'them from the IDL. Referencing them here forces them into `idl.types`, so the',
        'generated JS client (codama) renders their codecs — which the hand-written',
        '`clients/js/src/hooked/gumballMachineAccountData.ts` decoder depends on.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'configLine';
            type: {
              defined: {
                name: 'configLine';
              };
            };
          },
          {
            name: 'configLineInput';
            type: {
              defined: {
                name: 'configLineInput';
              };
            };
          },
          {
            name: 'configLineV2';
            type: {
              defined: {
                name: 'configLineV2';
              };
            };
          },
          {
            name: 'configLineV2Input';
            type: {
              defined: {
                name: 'configLineV2Input';
              };
            };
          },
        ];
      };
    },
    {
      name: 'initializeArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'settings';
            type: {
              defined: {
                name: 'gumballSettings';
              };
            };
          },
          {
            name: 'feeConfig';
            type: {
              option: {
                defined: {
                  name: 'feeConfig';
                };
              };
            };
          },
          {
            name: 'disablePrimarySplit';
            type: 'bool';
          },
          {
            name: 'buyBackConfig';
            type: {
              option: {
                defined: {
                  name: 'buyBackConfig';
                };
              };
            };
          },
          {
            name: 'disableRoyalties';
            type: 'bool';
          },
        ];
      };
    },
    {
      name: 'sellItemEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            type: 'pubkey';
          },
          {
            name: 'authority';
            type: 'pubkey';
          },
          {
            name: 'seller';
            type: 'pubkey';
          },
          {
            name: 'buyer';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'tokenStandard';
            type: {
              defined: {
                name: 'tokenStandard';
              };
            };
          },
        ];
      };
    },
    {
      name: 'sellerHistory';
      docs: [
        'Seller history state to track count of items submitted to a gumball machine.',
      ];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'gumballMachine';
            docs: ["Gumball machine we're tracking for"];
            type: 'pubkey';
          },
          {
            name: 'seller';
            docs: ['Seller address'];
            type: 'pubkey';
          },
          {
            name: 'itemCount';
            docs: ['Item count submitted by this seller'];
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'settleItemSaleEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            type: 'pubkey';
          },
          {
            name: 'authority';
            type: 'pubkey';
          },
          {
            name: 'seller';
            type: 'pubkey';
          },
          {
            name: 'buyer';
            type: 'pubkey';
          },
          {
            name: 'totalProceeds';
            type: 'u64';
          },
          {
            name: 'paymentMint';
            type: 'pubkey';
          },
          {
            name: 'feeConfig';
            type: {
              option: {
                defined: {
                  name: 'feeConfig';
                };
              };
            };
          },
          {
            name: 'curatorFeeBps';
            type: 'u16';
          },
          {
            name: 'amount';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'settleTokensSaleClaimedArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'startIndex';
            type: 'u32';
          },
          {
            name: 'endIndex';
            type: 'u32';
          },
        ];
      };
    },
    {
      name: 'tokenStandard';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'nonFungible';
          },
          {
            name: 'core';
          },
          {
            name: 'fungible';
          },
          {
            name: 'programmableNonFungible';
          },
          {
            name: 'compressed';
          },
        ];
      };
    },
    {
      name: 'updateArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'settings';
            type: {
              defined: {
                name: 'gumballSettings';
              };
            };
          },
          {
            name: 'buyBackConfig';
            type: {
              option: {
                defined: {
                  name: 'buyBackConfig';
                };
              };
            };
          },
        ];
      };
    },
  ];
};
