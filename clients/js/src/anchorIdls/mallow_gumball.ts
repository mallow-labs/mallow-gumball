export type MallowGumball = {
  version: '0.9.0';
  name: 'mallow_gumball';
  instructions: [
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: [
            'Gumball Machine account. The account space must be allocated to allow accounts larger',
            'than 10kb.',
            '',
          ];
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: false;
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
            '',
          ];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Payer of the transaction.'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'InitializeArgs';
          };
        },
      ];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
          ];
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'UpdateArgs';
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the nft'];
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'edition';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sellerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['OPTIONAL PNFT ACCOUNTS'];
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'AddItemArgs';
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the asset.'];
        },
        {
          name: 'asset';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ["Core asset's collection if it's part of one."];
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'AddItemArgs';
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the tokens'];
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
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
            defined: 'AddItemArgs';
          };
        },
      ];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'addItemRequest';
          isMut: true;
          isSigner: false;
          docs: ['Add item request account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the nft'];
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'edition';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sellerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['OPTIONAL PNFT ACCOUNTS'];
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'addItemRequest';
          isMut: true;
          isSigner: false;
          docs: ['Add item request account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the asset.'];
        },
        {
          name: 'asset';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ["Core asset's collection if it's part of one."];
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'addItemRequest';
          isMut: true;
          isSigner: false;
          docs: ['Add item request account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the NFT.'];
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'edition';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL PNFT ACCOUNTS',
            '/// CHECK: Safe due to token metadata program check',
          ];
        },
        {
          name: 'sellerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'addItemRequest';
          isMut: true;
          isSigner: false;
          docs: ['Add item request account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: true;
          docs: ['Seller of the asset.'];
        },
        {
          name: 'asset';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ["Core asset's collection if it's part of one."];
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'addItemRequest';
          isMut: true;
          isSigner: false;
          docs: ['Add item request account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: ['Authority of the gumball machine.'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'asset';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'edition';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL PNFT ACCOUNTS',
            '/// CHECK: Safe due to token metadata program check',
          ];
        },
        {
          name: 'sellerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
          docs: ['Seller of the asset.'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'asset';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ["Core asset's collection if it's part of one."];
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
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
      name: 'startSale';
      docs: [
        'Allows minting to begin.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority (authority or mint_authority)',
      ];
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
          docs: [
            'Gumball Machine authority. This can be the mint authority or the authority.',
          ];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
          ];
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'mintAuthority';
          isMut: false;
          isSigner: true;
          docs: [
            'Gumball machine mint authority (mint only allowed for the mint_authority).',
          ];
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Payer for the transaction and account allocation (rent).'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['NFT account owner.', ''];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
          docs: ['System program.'];
        },
        {
          name: 'recentSlothashes';
          isMut: false;
          isSigner: false;
          docs: ['SlotHashes sysvar cluster data.', ''];
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'mintAuthority';
          isMut: false;
          isSigner: true;
          docs: [
            'Gumball machine mint authority (mint only allowed for the mint_authority).',
          ];
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: [
            'Must be the oracle signer or seller (oracle signer can sell on behalf of the seller to allow auto-buy back)',
          ];
        },
        {
          name: 'oracleSigner';
          isMut: false;
          isSigner: true;
          docs: ['Oracle signer'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
          docs: ['Mint of the item (or asset for Core assets)'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the item'];
        },
        {
          name: 'buyer';
          isMut: true;
          isSigner: false;
          docs: ['Buyer of the item'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'feeAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL FEE ACCOUNTS - only required if there is a fee config on the gumball machine',
            'Marketplace fee account',
          ];
        },
        {
          name: 'feePaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Marketplace fee payment account'];
        },
        {
          name: 'paymentMint';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL SPL TOKEN ACCOUNTS - only required if selling for SPL token',
            'Mint of payment token',
          ];
        },
        {
          name: 'sellerPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Seller payment account'];
        },
        {
          name: 'authorityPdaPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Authority PDA payment account'];
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL CORE ASSET ACCOUNTS - only required if selling Core asset',
            'Collection of the asset',
          ];
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL TOKEN ACCOUNTS - only required if selling NFT or Fungible assets',
            'Authority PDA token account',
          ];
        },
        {
          name: 'sellerTokenAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Seller token account'];
        },
        {
          name: 'buyerTokenAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Buyer token account'];
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: [
            'OPTIONAL NFT ACCOUNTS - only required if selling NFT or PNFT',
          ];
        },
        {
          name: 'edition';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authorityPdaTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['OPTIONAL PNFT ACCOUNTS - only required if selling PNFT'];
        },
        {
          name: 'buyerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['buyer of the nft'];
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'asset';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['buyer of the nft'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'buyerTokenAccount';
          isMut: true;
          isSigner: false;
          docs: ['Nft token account for buyer'];
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'edition';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sellerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['OPTIONAL PNFT ACCOUNTS'];
        },
        {
          name: 'authorityPdaTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'buyerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine authority'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['buyer of the nft'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'buyerTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
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
          name: 'authority';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'authorityPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for authority if using token payment'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'sellerPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for seller if using token payment'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['buyer of the nft'];
        },
        {
          name: 'feeAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Fee account for marketplace fee if using fee config'];
        },
        {
          name: 'feePaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for marketplace fee if using token payment'];
        },
        {
          name: 'paymentMint';
          isMut: false;
          isSigner: false;
          isOptional: true;
          docs: ['Payment mint if using non-native payment token'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'asset';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'collection';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'mplCoreProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
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
          name: 'authority';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'authorityPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for authority if using token payment'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'sellerPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for seller if using token payment'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['buyer of the nft'];
        },
        {
          name: 'feeAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Fee account for marketplace fee if using fee config'];
        },
        {
          name: 'feePaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for marketplace fee if using token payment'];
        },
        {
          name: 'paymentMint';
          isMut: false;
          isSigner: false;
          isOptional: true;
          docs: ['Payment mint if using non-native payment token'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'buyerTokenAccount';
          isMut: true;
          isSigner: false;
          docs: ['Nft token account for buyer'];
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'metadata';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'edition';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sellerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['OPTIONAL PNFT ACCOUNTS'];
        },
        {
          name: 'authorityPdaTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'buyerTokenRecord';
          isMut: true;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRules';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'authRulesProgram';
          isMut: false;
          isSigner: false;
          isOptional: true;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
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
          name: 'authority';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the nft'];
        },
        {
          name: 'authorityPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for authority if using token payment'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the item'];
        },
        {
          name: 'sellerPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for seller if using token payment'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'buyer';
          isMut: false;
          isSigner: false;
          docs: ['buyer of the item'];
        },
        {
          name: 'feeAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Fee account for marketplace fee if using fee config'];
        },
        {
          name: 'feePaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for marketplace fee if using token payment'];
        },
        {
          name: 'paymentMint';
          isMut: false;
          isSigner: false;
          isOptional: true;
          docs: ['Payment mint if using non-native payment token'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'receiverTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
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
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
          docs: ['Anyone can settle the sale'];
        },
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball machine account.'];
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
          name: 'authority';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the tokens'];
        },
        {
          name: 'authorityPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for authority if using token payment'];
        },
        {
          name: 'seller';
          isMut: true;
          isSigner: false;
          docs: ['Seller of the item'];
        },
        {
          name: 'sellerPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for seller if using token payment'];
        },
        {
          name: 'sellerHistory';
          isMut: true;
          isSigner: false;
          docs: ['Seller history account.'];
        },
        {
          name: 'paymentMint';
          isMut: false;
          isSigner: false;
          isOptional: true;
          docs: ['Payment mint if using non-native payment token'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sellerTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPdaTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'SettleTokensSaleClaimedArgs';
          };
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
          docs: ['Autority of the gumball machine.'];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine account.'];
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: true;
          docs: ['Gumball Machine authority'];
        },
        {
          name: 'mintAuthority';
          isMut: false;
          isSigner: true;
          docs: ['New gumball machine authority'];
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine acccount.'];
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: ['Authority of the gumball machine.'];
        },
        {
          name: 'mintAuthority';
          isMut: true;
          isSigner: true;
          docs: ['Mint authority of the gumball machine.'];
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
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
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
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: ['Gumball Machine acccount.'];
        },
        {
          name: 'authority';
          isMut: true;
          isSigner: true;
          docs: ['Authority of the gumball machine.'];
        },
        {
          name: 'authorityPda';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authorityPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ["Authority's token account if using token payment"];
        },
        {
          name: 'authorityPdaPaymentAccount';
          isMut: true;
          isSigner: false;
          isOptional: true;
          docs: ['Payment account for authority pda if using token payment'];
        },
        {
          name: 'paymentMint';
          isMut: false;
          isSigner: false;
          isOptional: true;
          docs: ['Payment mint if using non-native payment token'];
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
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
  ];
  accounts: [
    {
      name: 'addItemRequest';
      docs: ['Add item request state.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'gumballMachine';
            docs: ['Gumball machine address.'];
            type: 'publicKey';
          },
          {
            name: 'seller';
            docs: ['Seller address.'];
            type: 'publicKey';
          },
          {
            name: 'asset';
            docs: ['Asset address.'];
            type: 'publicKey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: 'TokenStandard';
            };
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
            type: 'publicKey';
          },
          {
            name: 'mintAuthority';
            docs: [
              'Authority address allowed to mint from the gumball machine.',
            ];
            type: 'publicKey';
          },
          {
            name: 'marketplaceFeeConfig';
            docs: ['Fee config for the marketplace this gumball is listed on'];
            type: {
              option: {
                defined: 'FeeConfig';
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
              defined: 'GumballState';
            };
          },
          {
            name: 'settings';
            docs: ['User-defined settings'];
            type: {
              defined: 'GumballSettings';
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
            type: 'publicKey';
          },
          {
            name: 'seller';
            docs: ['Seller address'];
            type: 'publicKey';
          },
          {
            name: 'itemCount';
            docs: ['Item count submitted by this seller'];
            type: 'u64';
          },
        ];
      };
    },
  ];
  types: [
    {
      name: 'AddItemArgs';
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
      name: 'InitializeArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'settings';
            type: {
              defined: 'GumballSettings';
            };
          },
          {
            name: 'feeConfig';
            type: {
              option: {
                defined: 'FeeConfig';
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
                defined: 'BuyBackConfig';
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
      name: 'SettleTokensSaleClaimedArgs';
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
      name: 'UpdateArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'settings';
            type: {
              defined: 'GumballSettings';
            };
          },
          {
            name: 'buyBackConfig';
            type: {
              option: {
                defined: 'BuyBackConfig';
              };
            };
          },
        ];
      };
    },
    {
      name: 'FeeConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'feeAccount';
            docs: ['Where fees will go'];
            type: 'publicKey';
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
      name: 'BuyBackConfig';
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
            type: 'publicKey';
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
      name: 'ConfigLineInput';
      docs: ['Config line struct for storing asset (NFT) data pre-mint.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'publicKey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'ConfigLineV2Input';
      docs: ['Config line struct for storing asset (NFT) data pre-mint.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'publicKey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'publicKey';
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
      name: 'ConfigLine';
      docs: ['Config line struct for storing asset data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'publicKey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'publicKey';
          },
          {
            name: 'buyer';
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.',
            ];
            type: 'publicKey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: 'TokenStandard';
            };
          },
        ];
      };
    },
    {
      name: 'ConfigLineV2';
      docs: ['Config line struct for storing asset data.'];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'mint';
            docs: ['Mint account of the asset.'];
            type: 'publicKey';
          },
          {
            name: 'seller';
            docs: ['Wallet that submitted the asset for sale.'];
            type: 'publicKey';
          },
          {
            name: 'buyer';
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.',
            ];
            type: 'publicKey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: 'TokenStandard';
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
      name: 'GumballSettings';
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
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'TokenStandard';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'NonFungible';
          },
          {
            name: 'Core';
          },
          {
            name: 'Fungible';
          },
          {
            name: 'ProgrammableNonFungible';
          },
        ];
      };
    },
    {
      name: 'GumballState';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'None';
          },
          {
            name: 'DetailsFinalized';
          },
          {
            name: 'SaleLive';
          },
          {
            name: 'SaleEnded';
          },
        ];
      };
    },
  ];
  events: [
    {
      name: 'ClaimItemEvent';
      fields: [
        {
          name: 'mint';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'authority';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'seller';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'buyer';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'amount';
          type: 'u64';
          index: false;
        },
      ];
    },
    {
      name: 'DrawItemEvent';
      fields: [
        {
          name: 'authority';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'buyer';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'index';
          type: 'u32';
          index: false;
        },
      ];
    },
    {
      name: 'SellItemEvent';
      fields: [
        {
          name: 'mint';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'authority';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'seller';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'buyer';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'amount';
          type: 'u64';
          index: false;
        },
        {
          name: 'tokenStandard';
          type: {
            defined: 'TokenStandard';
          };
          index: false;
        },
      ];
    },
    {
      name: 'SettleItemSaleEvent';
      fields: [
        {
          name: 'mint';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'authority';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'seller';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'buyer';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'totalProceeds';
          type: 'u64';
          index: false;
        },
        {
          name: 'paymentMint';
          type: 'publicKey';
          index: false;
        },
        {
          name: 'feeConfig';
          type: {
            option: {
              defined: 'FeeConfig';
            };
          };
          index: false;
        },
        {
          name: 'curatorFeeBps';
          type: 'u16';
          index: false;
        },
        {
          name: 'amount';
          type: 'u64';
          index: false;
        },
      ];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'IncorrectOwner';
      msg: 'Account does not have correct owner';
    },
    {
      code: 6001;
      name: 'Uninitialized';
      msg: 'Account is not initialized';
    },
    {
      code: 6002;
      name: 'MintMismatch';
      msg: 'Mint Mismatch';
    },
    {
      code: 6003;
      name: 'IndexGreaterThanLength';
      msg: 'Index greater than length';
    },
    {
      code: 6004;
      name: 'NumericalOverflowError';
      msg: 'Numerical overflow error';
    },
    {
      code: 6005;
      name: 'TooManyCreators';
      msg: 'Can only provide up to 4 creators to gumball machine (because gumball machine is one)';
    },
    {
      code: 6006;
      name: 'GumballMachineEmpty';
      msg: 'Gumball machine is empty';
    },
    {
      code: 6007;
      name: 'HiddenSettingsDoNotHaveConfigLines';
      msg: 'Gumball machines using hidden uris do not have config lines, they have a single hash representing hashed order';
    },
    {
      code: 6008;
      name: 'CannotChangeNumberOfLines';
      msg: 'Cannot change number of lines unless is a hidden config';
    },
    {
      code: 6009;
      name: 'CannotSwitchToHiddenSettings';
      msg: 'Cannot switch to hidden settings after items available is greater than 0';
    },
    {
      code: 6010;
      name: 'IncorrectCollectionAuthority';
      msg: 'Incorrect collection NFT authority';
    },
    {
      code: 6011;
      name: 'MetadataAccountMustBeEmpty';
      msg: 'The metadata account has data in it, and this must be empty to mint a new NFT';
    },
    {
      code: 6012;
      name: 'NoChangingCollectionDuringMint';
      msg: "Can't change collection settings after items have begun to be minted";
    },
    {
      code: 6013;
      name: 'ExceededLengthError';
      msg: 'Value longer than expected maximum value';
    },
    {
      code: 6014;
      name: 'MissingConfigLinesSettings';
      msg: 'Missing config lines settings';
    },
    {
      code: 6015;
      name: 'CannotIncreaseLength';
      msg: 'Cannot increase the length in config lines settings';
    },
    {
      code: 6016;
      name: 'CannotSwitchFromHiddenSettings';
      msg: 'Cannot switch from hidden settings';
    },
    {
      code: 6017;
      name: 'CannotChangeSequentialIndexGeneration';
      msg: 'Cannot change sequential index generation after items have begun to be minted';
    },
    {
      code: 6018;
      name: 'CollectionKeyMismatch';
      msg: 'Collection public key mismatch';
    },
    {
      code: 6019;
      name: 'CouldNotRetrieveConfigLineData';
      msg: 'Could not retrive config line data';
    },
    {
      code: 6020;
      name: 'NotFullyLoaded';
      msg: 'Not all config lines were added to the gumball machine';
    },
    {
      code: 6021;
      name: 'InstructionBuilderFailed';
      msg: 'Instruction could not be created';
    },
    {
      code: 6022;
      name: 'MissingCollectionAuthorityRecord';
      msg: 'Missing collection authority record';
    },
    {
      code: 6023;
      name: 'MissingMetadataDelegateRecord';
      msg: 'Missing metadata delegate record';
    },
    {
      code: 6024;
      name: 'InvalidTokenStandard';
      msg: 'Invalid token standard';
    },
    {
      code: 6025;
      name: 'MissingTokenAccount';
      msg: 'Missing token account';
    },
    {
      code: 6026;
      name: 'MissingTokenRecord';
      msg: 'Missing token record';
    },
    {
      code: 6027;
      name: 'MissingInstructionsSysvar';
      msg: 'Missing instructions sysvar account';
    },
    {
      code: 6028;
      name: 'MissingSplAtaProgram';
      msg: 'Missing SPL ATA program';
    },
    {
      code: 6029;
      name: 'InvalidAccountVersion';
      msg: 'Invalid account version';
    },
    {
      code: 6030;
      name: 'NotPrimarySale';
      msg: 'Not a primary sale asset';
    },
    {
      code: 6031;
      name: 'InvalidEditionAccount';
      msg: 'Invalid edition account';
    },
    {
      code: 6032;
      name: 'InvalidMasterEditionSupply';
      msg: 'Invalid master edition supply';
    },
    {
      code: 6033;
      name: 'PublicKeyMismatch';
      msg: 'Public key mismatch';
    },
    {
      code: 6034;
      name: 'InvalidCollection';
      msg: 'Invalid collection';
    },
    {
      code: 6035;
      name: 'GumballMachineDetailsFinalized';
      msg: 'Gumball machine detailed finalized';
    },
    {
      code: 6036;
      name: 'InvalidState';
      msg: 'Invalid state';
    },
    {
      code: 6037;
      name: 'InvalidAuthority';
      msg: 'Invalid authority';
    },
    {
      code: 6038;
      name: 'InvalidMintAuthority';
      msg: 'Invalid mint authority';
    },
    {
      code: 6039;
      name: 'InvalidMint';
      msg: 'Invalid mint';
    },
    {
      code: 6040;
      name: 'InvalidPaymentMint';
      msg: 'Invalid payment mint';
    },
    {
      code: 6041;
      name: 'InvalidSeller';
      msg: 'Invalid seller';
    },
    {
      code: 6042;
      name: 'InvalidBuyer';
      msg: 'Invalid buyer';
    },
    {
      code: 6043;
      name: 'UriTooLong';
      msg: 'URI too long';
    },
    {
      code: 6044;
      name: 'InvalidProofPath';
      msg: 'Invalid proof path';
    },
    {
      code: 6045;
      name: 'InvalidSettingUpdate';
      msg: 'Invalid setting update';
    },
    {
      code: 6046;
      name: 'SellerTooManyItems';
      msg: 'Seller has too many items';
    },
    {
      code: 6047;
      name: 'NotAllSettled';
      msg: 'Not all items have been settled';
    },
    {
      code: 6048;
      name: 'ItemAlreadySettled';
      msg: 'Item already settled';
    },
    {
      code: 6049;
      name: 'ItemAlreadyClaimed';
      msg: 'Item already claimed';
    },
    {
      code: 6050;
      name: 'ItemAlreadyDrawn';
      msg: 'Item already drawn';
    },
    {
      code: 6051;
      name: 'InvalidGumballMachine';
      msg: 'Invalid gumball machine';
    },
    {
      code: 6052;
      name: 'SellerCannotBeAuthority';
      msg: 'Seller cannot be authority';
    },
    {
      code: 6053;
      name: 'InvalidAssetPlugin';
      msg: 'Asset has an invalid plugin';
    },
    {
      code: 6054;
      name: 'InvalidAmount';
      msg: 'Invalid amount';
    },
    {
      code: 6055;
      name: 'DuplicateIndex';
      msg: 'Duplicate index';
    },
    {
      code: 6056;
      name: 'InvalidInputLength';
      msg: 'Invalid input length';
    },
    {
      code: 6057;
      name: 'BuyBackNotEnabled';
      msg: 'Buy back not enabled';
    },
    {
      code: 6058;
      name: 'BuyBackFundsNotZero';
      msg: 'Buy back funds not zero';
    },
    {
      code: 6059;
      name: 'InsufficientFunds';
      msg: 'Insufficient funds';
    },
    {
      code: 6060;
      name: 'InvalidVersion';
      msg: 'Invalid version';
    },
    {
      code: 6061;
      name: 'InvalidOracleSigner';
      msg: 'Invalid oracle signer';
    },
    {
      code: 6062;
      name: 'InvalidPayer';
      msg: 'Invalid payer';
    },
    {
      code: 6063;
      name: 'NotImplemented';
      msg: 'Not implemented';
    },
    {
      code: 6064;
      name: 'BuyBackCutoffReached';
      msg: 'Buy back cutoff reached';
    },
    {
      code: 6065;
      name: 'NotASoloGumball';
      msg: 'Not a solo gumball';
    },
    {
      code: 6066;
      name: 'ItemNotClaimed';
      msg: 'Item not claimed';
    },
    {
      code: 6067;
      name: 'ItemNotSettled';
      msg: 'Item not settled';
    },
    {
      code: 6068;
      name: 'MissingItemIndex';
      msg: 'Missing item index';
    },
  ];
};

export const IDL: MallowGumball = {
  version: '0.9.0',
  name: 'mallow_gumball',
  instructions: [
    {
      name: 'initialize',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: [
            'Gumball Machine account. The account space must be allocated to allow accounts larger',
            'than 10kb.',
            '',
          ],
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: false,
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
            '',
          ],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Payer of the transaction.'],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'InitializeArgs',
          },
        },
      ],
    },
    {
      name: 'updateSettings',
      docs: [
        'Updates gumball machine settings.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer, writable]` Gumball Machine authority',
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
          ],
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'UpdateArgs',
          },
        },
      ],
    },
    {
      name: 'addNft',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the nft'],
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'edition',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sellerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['OPTIONAL PNFT ACCOUNTS'],
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'AddItemArgs',
          },
        },
      ],
    },
    {
      name: 'addCoreAsset',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the asset.'],
        },
        {
          name: 'asset',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ["Core asset's collection if it's part of one."],
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'AddItemArgs',
          },
        },
      ],
    },
    {
      name: 'addTokens',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the tokens'],
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'quantity',
          type: 'u16',
        },
        {
          name: 'args',
          type: {
            defined: 'AddItemArgs',
          },
        },
      ],
    },
    {
      name: 'requestAddNft',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'addItemRequest',
          isMut: true,
          isSigner: false,
          docs: ['Add item request account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the nft'],
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'edition',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sellerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['OPTIONAL PNFT ACCOUNTS'],
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
      ],
      args: [],
    },
    {
      name: 'requestAddCoreAsset',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'addItemRequest',
          isMut: true,
          isSigner: false,
          docs: ['Add item request account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the asset.'],
        },
        {
          name: 'asset',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ["Core asset's collection if it's part of one."],
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'cancelAddNftRequest',
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
      ],
      accounts: [
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'addItemRequest',
          isMut: true,
          isSigner: false,
          docs: ['Add item request account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the NFT.'],
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'edition',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL PNFT ACCOUNTS',
            '/// CHECK: Safe due to token metadata program check',
          ],
        },
        {
          name: 'sellerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
      ],
      args: [],
    },
    {
      name: 'cancelAddCoreAssetRequest',
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
      ],
      accounts: [
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'addItemRequest',
          isMut: true,
          isSigner: false,
          docs: ['Add item request account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: true,
          docs: ['Seller of the asset.'],
        },
        {
          name: 'asset',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ["Core asset's collection if it's part of one."],
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'approveAddItem',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'addItemRequest',
          isMut: true,
          isSigner: false,
          docs: ['Add item request account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: ['Authority of the gumball machine.'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'asset',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'removeNft',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'edition',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL PNFT ACCOUNTS',
            '/// CHECK: Safe due to token metadata program check',
          ],
        },
        {
          name: 'sellerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'removeCoreAsset',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
          docs: ['Seller of the asset.'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'asset',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ["Core asset's collection if it's part of one."],
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'removeTokens',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'indices',
          type: 'bytes',
        },
        {
          name: 'amount',
          type: 'u64',
        },
      ],
    },
    {
      name: 'removeTokensSpan',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: [
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)',
          ],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'startIndex',
          type: 'u32',
        },
        {
          name: 'endIndex',
          type: 'u32',
        },
      ],
    },
    {
      name: 'startSale',
      docs: [
        'Allows minting to begin.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority (authority or mint_authority)',
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
          docs: [
            'Gumball Machine authority. This can be the mint authority or the authority.',
          ],
        },
      ],
      args: [],
    },
    {
      name: 'endSale',
      docs: [
        'Disables minting and allows sales to be settled.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer, writable]` Gumball Machine authority',
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
          ],
        },
      ],
      args: [],
    },
    {
      name: 'draw',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'mintAuthority',
          isMut: false,
          isSigner: true,
          docs: [
            'Gumball machine mint authority (mint only allowed for the mint_authority).',
          ],
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Payer for the transaction and account allocation (rent).'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['NFT account owner.', ''],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
          docs: ['System program.'],
        },
        {
          name: 'recentSlothashes',
          isMut: false,
          isSigner: false,
          docs: ['SlotHashes sysvar cluster data.', ''],
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'incrementTotalRevenue',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'mintAuthority',
          isMut: false,
          isSigner: true,
          docs: [
            'Gumball machine mint authority (mint only allowed for the mint_authority).',
          ],
        },
      ],
      args: [
        {
          name: 'revenue',
          type: 'u64',
        },
      ],
    },
    {
      name: 'sellItem',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: [
            'Must be the oracle signer or seller (oracle signer can sell on behalf of the seller to allow auto-buy back)',
          ],
        },
        {
          name: 'oracleSigner',
          isMut: false,
          isSigner: true,
          docs: ['Oracle signer'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
          docs: ['Mint of the item (or asset for Core assets)'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the item'],
        },
        {
          name: 'buyer',
          isMut: true,
          isSigner: false,
          docs: ['Buyer of the item'],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'feeAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL FEE ACCOUNTS - only required if there is a fee config on the gumball machine',
            'Marketplace fee account',
          ],
        },
        {
          name: 'feePaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Marketplace fee payment account'],
        },
        {
          name: 'paymentMint',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL SPL TOKEN ACCOUNTS - only required if selling for SPL token',
            'Mint of payment token',
          ],
        },
        {
          name: 'sellerPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Seller payment account'],
        },
        {
          name: 'authorityPdaPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Authority PDA payment account'],
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL CORE ASSET ACCOUNTS - only required if selling Core asset',
            'Collection of the asset',
          ],
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL TOKEN ACCOUNTS - only required if selling NFT or Fungible assets',
            'Authority PDA token account',
          ],
        },
        {
          name: 'sellerTokenAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Seller token account'],
        },
        {
          name: 'buyerTokenAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Buyer token account'],
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: [
            'OPTIONAL NFT ACCOUNTS - only required if selling NFT or PNFT',
          ],
        },
        {
          name: 'edition',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authorityPdaTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['OPTIONAL PNFT ACCOUNTS - only required if selling PNFT'],
        },
        {
          name: 'buyerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
        {
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'buyPrice',
          type: 'u64',
        },
      ],
    },
    {
      name: 'claimCoreAsset',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['buyer of the nft'],
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'asset',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'claimNft',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['buyer of the nft'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'buyerTokenAccount',
          isMut: true,
          isSigner: false,
          docs: ['Nft token account for buyer'],
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'edition',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sellerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['OPTIONAL PNFT ACCOUNTS'],
        },
        {
          name: 'authorityPdaTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'buyerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'claimTokens',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine authority'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['buyer of the nft'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'buyerTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'settleCoreAssetSale',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
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
          name: 'authority',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'authorityPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for authority if using token payment'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'sellerPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for seller if using token payment'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['buyer of the nft'],
        },
        {
          name: 'feeAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Fee account for marketplace fee if using fee config'],
        },
        {
          name: 'feePaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for marketplace fee if using token payment'],
        },
        {
          name: 'paymentMint',
          isMut: false,
          isSigner: false,
          isOptional: true,
          docs: ['Payment mint if using non-native payment token'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'asset',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'collection',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'mplCoreProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'settleNftSale',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
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
          name: 'authority',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'authorityPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for authority if using token payment'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'sellerPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for seller if using token payment'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['buyer of the nft'],
        },
        {
          name: 'feeAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Fee account for marketplace fee if using fee config'],
        },
        {
          name: 'feePaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for marketplace fee if using token payment'],
        },
        {
          name: 'paymentMint',
          isMut: false,
          isSigner: false,
          isOptional: true,
          docs: ['Payment mint if using non-native payment token'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'buyerTokenAccount',
          isMut: true,
          isSigner: false,
          docs: ['Nft token account for buyer'],
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'metadata',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'edition',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sellerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['OPTIONAL PNFT ACCOUNTS'],
        },
        {
          name: 'authorityPdaTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'buyerTokenRecord',
          isMut: true,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRules',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'authRulesProgram',
          isMut: false,
          isSigner: false,
          isOptional: true,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'settleTokensSale',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
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
          name: 'authority',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the nft'],
        },
        {
          name: 'authorityPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for authority if using token payment'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the item'],
        },
        {
          name: 'sellerPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for seller if using token payment'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'buyer',
          isMut: false,
          isSigner: false,
          docs: ['buyer of the item'],
        },
        {
          name: 'feeAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Fee account for marketplace fee if using fee config'],
        },
        {
          name: 'feePaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for marketplace fee if using token payment'],
        },
        {
          name: 'paymentMint',
          isMut: false,
          isSigner: false,
          isOptional: true,
          docs: ['Payment mint if using non-native payment token'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'receiverTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'index',
          type: 'u32',
        },
      ],
    },
    {
      name: 'settleTokensSaleClaimed',
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
      ],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
          docs: ['Anyone can settle the sale'],
        },
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball machine account.'],
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
          name: 'authority',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the tokens'],
        },
        {
          name: 'authorityPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for authority if using token payment'],
        },
        {
          name: 'seller',
          isMut: true,
          isSigner: false,
          docs: ['Seller of the item'],
        },
        {
          name: 'sellerPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for seller if using token payment'],
        },
        {
          name: 'sellerHistory',
          isMut: true,
          isSigner: false,
          docs: ['Seller history account.'],
        },
        {
          name: 'paymentMint',
          isMut: false,
          isSigner: false,
          isOptional: true,
          docs: ['Payment mint if using non-native payment token'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sellerTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPdaTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'eventAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'program',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'SettleTokensSaleClaimedArgs',
          },
        },
      ],
    },
    {
      name: 'setAuthority',
      docs: [
        'Set a new authority of the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
          docs: ['Autority of the gumball machine.'],
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
      name: 'setMintAuthority',
      docs: [
        'Set a new mint authority of the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
        '2. `[signer]` New gumball machine authority',
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine account.'],
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: true,
          docs: ['Gumball Machine authority'],
        },
        {
          name: 'mintAuthority',
          isMut: false,
          isSigner: true,
          docs: ['New gumball machine authority'],
        },
      ],
      args: [],
    },
    {
      name: 'withdraw',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine acccount.'],
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: ['Authority of the gumball machine.'],
        },
        {
          name: 'mintAuthority',
          isMut: true,
          isSigner: true,
          docs: ['Mint authority of the gumball machine.'],
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
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'manageBuyBackFunds',
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
      ],
      accounts: [
        {
          name: 'gumballMachine',
          isMut: true,
          isSigner: false,
          docs: ['Gumball Machine acccount.'],
        },
        {
          name: 'authority',
          isMut: true,
          isSigner: true,
          docs: ['Authority of the gumball machine.'],
        },
        {
          name: 'authorityPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authorityPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ["Authority's token account if using token payment"],
        },
        {
          name: 'authorityPdaPaymentAccount',
          isMut: true,
          isSigner: false,
          isOptional: true,
          docs: ['Payment account for authority pda if using token payment'],
        },
        {
          name: 'paymentMint',
          isMut: false,
          isSigner: false,
          isOptional: true,
          docs: ['Payment mint if using non-native payment token'],
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'isWithdraw',
          type: 'bool',
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'addItemRequest',
      docs: ['Add item request state.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'gumballMachine',
            docs: ['Gumball machine address.'],
            type: 'publicKey',
          },
          {
            name: 'seller',
            docs: ['Seller address.'],
            type: 'publicKey',
          },
          {
            name: 'asset',
            docs: ['Asset address.'],
            type: 'publicKey',
          },
          {
            name: 'tokenStandard',
            docs: ['Token standard.'],
            type: {
              defined: 'TokenStandard',
            },
          },
        ],
      },
    },
    {
      name: 'gumballMachine',
      docs: ['Gumball machine state and config data.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'version',
            docs: ['Version of the account.'],
            type: 'u8',
          },
          {
            name: 'authority',
            docs: ['Authority address.'],
            type: 'publicKey',
          },
          {
            name: 'mintAuthority',
            docs: [
              'Authority address allowed to mint from the gumball machine.',
            ],
            type: 'publicKey',
          },
          {
            name: 'marketplaceFeeConfig',
            docs: ['Fee config for the marketplace this gumball is listed on'],
            type: {
              option: {
                defined: 'FeeConfig',
              },
            },
          },
          {
            name: 'itemsRedeemed',
            docs: ['Number of assets redeemed.'],
            type: 'u64',
          },
          {
            name: 'itemsSettled',
            docs: ['Number of assets settled after sale.'],
            type: 'u64',
          },
          {
            name: 'totalRevenue',
            docs: ['Amount of lamports/tokens received from purchases.'],
            type: 'u64',
          },
          {
            name: 'state',
            docs: [
              'True if the authority has finalized details, which prevents adding more nfts.',
            ],
            type: {
              defined: 'GumballState',
            },
          },
          {
            name: 'settings',
            docs: ['User-defined settings'],
            type: {
              defined: 'GumballSettings',
            },
          },
        ],
      },
    },
    {
      name: 'sellerHistory',
      docs: [
        'Seller history state to track count of items submitted to a gumball machine.',
      ],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'gumballMachine',
            docs: ["Gumball machine we're tracking for"],
            type: 'publicKey',
          },
          {
            name: 'seller',
            docs: ['Seller address'],
            type: 'publicKey',
          },
          {
            name: 'itemCount',
            docs: ['Item count submitted by this seller'],
            type: 'u64',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'AddItemArgs',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'sellerProofPath',
            type: {
              option: {
                vec: {
                  array: ['u8', 32],
                },
              },
            },
          },
          {
            name: 'index',
            type: {
              option: 'u32',
            },
          },
        ],
      },
    },
    {
      name: 'InitializeArgs',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'settings',
            type: {
              defined: 'GumballSettings',
            },
          },
          {
            name: 'feeConfig',
            type: {
              option: {
                defined: 'FeeConfig',
              },
            },
          },
          {
            name: 'disablePrimarySplit',
            type: 'bool',
          },
          {
            name: 'buyBackConfig',
            type: {
              option: {
                defined: 'BuyBackConfig',
              },
            },
          },
          {
            name: 'disableRoyalties',
            type: 'bool',
          },
        ],
      },
    },
    {
      name: 'SettleTokensSaleClaimedArgs',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'startIndex',
            type: 'u32',
          },
          {
            name: 'endIndex',
            type: 'u32',
          },
        ],
      },
    },
    {
      name: 'UpdateArgs',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'settings',
            type: {
              defined: 'GumballSettings',
            },
          },
          {
            name: 'buyBackConfig',
            type: {
              option: {
                defined: 'BuyBackConfig',
              },
            },
          },
        ],
      },
    },
    {
      name: 'FeeConfig',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'feeAccount',
            docs: ['Where fees will go'],
            type: 'publicKey',
          },
          {
            name: 'feeBps',
            docs: ['Sale basis points for fees'],
            type: 'u16',
          },
        ],
      },
    },
    {
      name: 'BuyBackConfig',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'enabled',
            docs: ['Whether buying back prizes is enabled'],
            type: 'bool',
          },
          {
            name: 'toGumballMachine',
            docs: [
              'Whether buying back prizes should be added back to the gumball machine (not yet supported)',
            ],
            type: 'bool',
          },
          {
            name: 'oracleSigner',
            docs: [
              'Authority that must sign when buying back prizes, to ensure pricing is correct',
            ],
            type: 'publicKey',
          },
          {
            name: 'valuePct',
            docs: [
              'Percentage of prize value the creator/gumball machine will pay for buying back prizes',
            ],
            type: 'u8',
          },
          {
            name: 'marketplaceFeeBps',
            docs: [
              'Fee in basis points paid to marketplace authority when buying back prizes (paid from funds_available)',
            ],
            type: 'u16',
          },
          {
            name: 'cutoffPct',
            docs: [
              'Buy backs are disabled when the percentage of items remaining is less than or equal to this value',
              '0 means there is no cutoff, 100 means buy back is always disabled, 50 means buy back is disabled when 50% of items are sold',
              'If an item is sold back to the gumball machine to increase the remaining % above this cutoff, buy back is re-enabled',
            ],
            type: 'u8',
          },
        ],
      },
    },
    {
      name: 'ConfigLineInput',
      docs: ['Config line struct for storing asset (NFT) data pre-mint.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'mint',
            docs: ['Mint account of the asset.'],
            type: 'publicKey',
          },
          {
            name: 'seller',
            docs: ['Wallet that submitted the asset for sale.'],
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'ConfigLineV2Input',
      docs: ['Config line struct for storing asset (NFT) data pre-mint.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'mint',
            docs: ['Mint account of the asset.'],
            type: 'publicKey',
          },
          {
            name: 'seller',
            docs: ['Wallet that submitted the asset for sale.'],
            type: 'publicKey',
          },
          {
            name: 'amount',
            docs: ['Amount of the asset.'],
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'ConfigLine',
      docs: ['Config line struct for storing asset data.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'mint',
            docs: ['Mint account of the asset.'],
            type: 'publicKey',
          },
          {
            name: 'seller',
            docs: ['Wallet that submitted the asset for sale.'],
            type: 'publicKey',
          },
          {
            name: 'buyer',
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.',
            ],
            type: 'publicKey',
          },
          {
            name: 'tokenStandard',
            docs: ['Token standard.'],
            type: {
              defined: 'TokenStandard',
            },
          },
        ],
      },
    },
    {
      name: 'ConfigLineV2',
      docs: ['Config line struct for storing asset data.'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'mint',
            docs: ['Mint account of the asset.'],
            type: 'publicKey',
          },
          {
            name: 'seller',
            docs: ['Wallet that submitted the asset for sale.'],
            type: 'publicKey',
          },
          {
            name: 'buyer',
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.',
            ],
            type: 'publicKey',
          },
          {
            name: 'tokenStandard',
            docs: ['Token standard.'],
            type: {
              defined: 'TokenStandard',
            },
          },
          {
            name: 'amount',
            docs: ['Amount of the asset.'],
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'GumballSettings',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'uri',
            docs: ['Uri of off-chain metadata, max length 196'],
            type: 'string',
          },
          {
            name: 'itemCapacity',
            docs: ['Number of assets that can be added.'],
            type: 'u64',
          },
          {
            name: 'itemsPerSeller',
            docs: ['Max number of items that can be added by a single seller.'],
            type: 'u16',
          },
          {
            name: 'sellersMerkleRoot',
            docs: [
              'Merkle root hash for sellers who can add items to the machine.',
            ],
            type: {
              option: {
                array: ['u8', 32],
              },
            },
          },
          {
            name: 'curatorFeeBps',
            docs: ['Fee basis points paid to the machine authority.'],
            type: 'u16',
          },
          {
            name: 'hideSoldItems',
            docs: [
              'True if the front end should hide items that have been sold.',
            ],
            type: 'bool',
          },
          {
            name: 'paymentMint',
            docs: ['Payment token for the mint'],
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'TokenStandard',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'NonFungible',
          },
          {
            name: 'Core',
          },
          {
            name: 'Fungible',
          },
          {
            name: 'ProgrammableNonFungible',
          },
        ],
      },
    },
    {
      name: 'GumballState',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'None',
          },
          {
            name: 'DetailsFinalized',
          },
          {
            name: 'SaleLive',
          },
          {
            name: 'SaleEnded',
          },
        ],
      },
    },
  ],
  events: [
    {
      name: 'ClaimItemEvent',
      fields: [
        {
          name: 'mint',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'authority',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'seller',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'buyer',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'amount',
          type: 'u64',
          index: false,
        },
      ],
    },
    {
      name: 'DrawItemEvent',
      fields: [
        {
          name: 'authority',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'buyer',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'index',
          type: 'u32',
          index: false,
        },
      ],
    },
    {
      name: 'SellItemEvent',
      fields: [
        {
          name: 'mint',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'authority',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'seller',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'buyer',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'amount',
          type: 'u64',
          index: false,
        },
        {
          name: 'tokenStandard',
          type: {
            defined: 'TokenStandard',
          },
          index: false,
        },
      ],
    },
    {
      name: 'SettleItemSaleEvent',
      fields: [
        {
          name: 'mint',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'authority',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'seller',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'buyer',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'totalProceeds',
          type: 'u64',
          index: false,
        },
        {
          name: 'paymentMint',
          type: 'publicKey',
          index: false,
        },
        {
          name: 'feeConfig',
          type: {
            option: {
              defined: 'FeeConfig',
            },
          },
          index: false,
        },
        {
          name: 'curatorFeeBps',
          type: 'u16',
          index: false,
        },
        {
          name: 'amount',
          type: 'u64',
          index: false,
        },
      ],
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'IncorrectOwner',
      msg: 'Account does not have correct owner',
    },
    {
      code: 6001,
      name: 'Uninitialized',
      msg: 'Account is not initialized',
    },
    {
      code: 6002,
      name: 'MintMismatch',
      msg: 'Mint Mismatch',
    },
    {
      code: 6003,
      name: 'IndexGreaterThanLength',
      msg: 'Index greater than length',
    },
    {
      code: 6004,
      name: 'NumericalOverflowError',
      msg: 'Numerical overflow error',
    },
    {
      code: 6005,
      name: 'TooManyCreators',
      msg: 'Can only provide up to 4 creators to gumball machine (because gumball machine is one)',
    },
    {
      code: 6006,
      name: 'GumballMachineEmpty',
      msg: 'Gumball machine is empty',
    },
    {
      code: 6007,
      name: 'HiddenSettingsDoNotHaveConfigLines',
      msg: 'Gumball machines using hidden uris do not have config lines, they have a single hash representing hashed order',
    },
    {
      code: 6008,
      name: 'CannotChangeNumberOfLines',
      msg: 'Cannot change number of lines unless is a hidden config',
    },
    {
      code: 6009,
      name: 'CannotSwitchToHiddenSettings',
      msg: 'Cannot switch to hidden settings after items available is greater than 0',
    },
    {
      code: 6010,
      name: 'IncorrectCollectionAuthority',
      msg: 'Incorrect collection NFT authority',
    },
    {
      code: 6011,
      name: 'MetadataAccountMustBeEmpty',
      msg: 'The metadata account has data in it, and this must be empty to mint a new NFT',
    },
    {
      code: 6012,
      name: 'NoChangingCollectionDuringMint',
      msg: "Can't change collection settings after items have begun to be minted",
    },
    {
      code: 6013,
      name: 'ExceededLengthError',
      msg: 'Value longer than expected maximum value',
    },
    {
      code: 6014,
      name: 'MissingConfigLinesSettings',
      msg: 'Missing config lines settings',
    },
    {
      code: 6015,
      name: 'CannotIncreaseLength',
      msg: 'Cannot increase the length in config lines settings',
    },
    {
      code: 6016,
      name: 'CannotSwitchFromHiddenSettings',
      msg: 'Cannot switch from hidden settings',
    },
    {
      code: 6017,
      name: 'CannotChangeSequentialIndexGeneration',
      msg: 'Cannot change sequential index generation after items have begun to be minted',
    },
    {
      code: 6018,
      name: 'CollectionKeyMismatch',
      msg: 'Collection public key mismatch',
    },
    {
      code: 6019,
      name: 'CouldNotRetrieveConfigLineData',
      msg: 'Could not retrive config line data',
    },
    {
      code: 6020,
      name: 'NotFullyLoaded',
      msg: 'Not all config lines were added to the gumball machine',
    },
    {
      code: 6021,
      name: 'InstructionBuilderFailed',
      msg: 'Instruction could not be created',
    },
    {
      code: 6022,
      name: 'MissingCollectionAuthorityRecord',
      msg: 'Missing collection authority record',
    },
    {
      code: 6023,
      name: 'MissingMetadataDelegateRecord',
      msg: 'Missing metadata delegate record',
    },
    {
      code: 6024,
      name: 'InvalidTokenStandard',
      msg: 'Invalid token standard',
    },
    {
      code: 6025,
      name: 'MissingTokenAccount',
      msg: 'Missing token account',
    },
    {
      code: 6026,
      name: 'MissingTokenRecord',
      msg: 'Missing token record',
    },
    {
      code: 6027,
      name: 'MissingInstructionsSysvar',
      msg: 'Missing instructions sysvar account',
    },
    {
      code: 6028,
      name: 'MissingSplAtaProgram',
      msg: 'Missing SPL ATA program',
    },
    {
      code: 6029,
      name: 'InvalidAccountVersion',
      msg: 'Invalid account version',
    },
    {
      code: 6030,
      name: 'NotPrimarySale',
      msg: 'Not a primary sale asset',
    },
    {
      code: 6031,
      name: 'InvalidEditionAccount',
      msg: 'Invalid edition account',
    },
    {
      code: 6032,
      name: 'InvalidMasterEditionSupply',
      msg: 'Invalid master edition supply',
    },
    {
      code: 6033,
      name: 'PublicKeyMismatch',
      msg: 'Public key mismatch',
    },
    {
      code: 6034,
      name: 'InvalidCollection',
      msg: 'Invalid collection',
    },
    {
      code: 6035,
      name: 'GumballMachineDetailsFinalized',
      msg: 'Gumball machine detailed finalized',
    },
    {
      code: 6036,
      name: 'InvalidState',
      msg: 'Invalid state',
    },
    {
      code: 6037,
      name: 'InvalidAuthority',
      msg: 'Invalid authority',
    },
    {
      code: 6038,
      name: 'InvalidMintAuthority',
      msg: 'Invalid mint authority',
    },
    {
      code: 6039,
      name: 'InvalidMint',
      msg: 'Invalid mint',
    },
    {
      code: 6040,
      name: 'InvalidPaymentMint',
      msg: 'Invalid payment mint',
    },
    {
      code: 6041,
      name: 'InvalidSeller',
      msg: 'Invalid seller',
    },
    {
      code: 6042,
      name: 'InvalidBuyer',
      msg: 'Invalid buyer',
    },
    {
      code: 6043,
      name: 'UriTooLong',
      msg: 'URI too long',
    },
    {
      code: 6044,
      name: 'InvalidProofPath',
      msg: 'Invalid proof path',
    },
    {
      code: 6045,
      name: 'InvalidSettingUpdate',
      msg: 'Invalid setting update',
    },
    {
      code: 6046,
      name: 'SellerTooManyItems',
      msg: 'Seller has too many items',
    },
    {
      code: 6047,
      name: 'NotAllSettled',
      msg: 'Not all items have been settled',
    },
    {
      code: 6048,
      name: 'ItemAlreadySettled',
      msg: 'Item already settled',
    },
    {
      code: 6049,
      name: 'ItemAlreadyClaimed',
      msg: 'Item already claimed',
    },
    {
      code: 6050,
      name: 'ItemAlreadyDrawn',
      msg: 'Item already drawn',
    },
    {
      code: 6051,
      name: 'InvalidGumballMachine',
      msg: 'Invalid gumball machine',
    },
    {
      code: 6052,
      name: 'SellerCannotBeAuthority',
      msg: 'Seller cannot be authority',
    },
    {
      code: 6053,
      name: 'InvalidAssetPlugin',
      msg: 'Asset has an invalid plugin',
    },
    {
      code: 6054,
      name: 'InvalidAmount',
      msg: 'Invalid amount',
    },
    {
      code: 6055,
      name: 'DuplicateIndex',
      msg: 'Duplicate index',
    },
    {
      code: 6056,
      name: 'InvalidInputLength',
      msg: 'Invalid input length',
    },
    {
      code: 6057,
      name: 'BuyBackNotEnabled',
      msg: 'Buy back not enabled',
    },
    {
      code: 6058,
      name: 'BuyBackFundsNotZero',
      msg: 'Buy back funds not zero',
    },
    {
      code: 6059,
      name: 'InsufficientFunds',
      msg: 'Insufficient funds',
    },
    {
      code: 6060,
      name: 'InvalidVersion',
      msg: 'Invalid version',
    },
    {
      code: 6061,
      name: 'InvalidOracleSigner',
      msg: 'Invalid oracle signer',
    },
    {
      code: 6062,
      name: 'InvalidPayer',
      msg: 'Invalid payer',
    },
    {
      code: 6063,
      name: 'NotImplemented',
      msg: 'Not implemented',
    },
    {
      code: 6064,
      name: 'BuyBackCutoffReached',
      msg: 'Buy back cutoff reached',
    },
    {
      code: 6065,
      name: 'NotASoloGumball',
      msg: 'Not a solo gumball',
    },
    {
      code: 6066,
      name: 'ItemNotClaimed',
      msg: 'Item not claimed',
    },
    {
      code: 6067,
      name: 'ItemNotSettled',
      msg: 'Item not settled',
    },
    {
      code: 6068,
      name: 'MissingItemIndex',
      msg: 'Missing item index',
    },
  ],
};
