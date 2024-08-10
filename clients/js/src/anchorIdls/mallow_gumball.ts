export type MallowGumball = {
  version: '3.0.1';
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
        '2. `[]` Gumball Machine authority',
        '3. `[signer]` Payer'
      ];
      accounts: [
        {
          name: 'gumballMachine';
          isMut: true;
          isSigner: false;
          docs: [
            'Gumball Machine account. The account space must be allocated to allow accounts larger',
            'than 10kb.',
            ''
          ];
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: false;
          docs: [
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.',
            ''
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
        }
      ];
      args: [
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
        }
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
        '1. `[signer]` Gumball Machine authority'
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
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.'
          ];
        }
      ];
      args: [
        {
          name: 'settings';
          type: {
            defined: 'GumballSettings';
          };
        }
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
        '1. `[signer]` Gumball Machine authority'
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
          isMut: false;
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
        }
      ];
      args: [
        {
          name: 'sellerProofPath';
          type: {
            option: {
              vec: {
                array: ['u8', 32];
              };
            };
          };
        }
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
        '1. `[signer]` Gumball Machine authority'
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
        }
      ];
      args: [
        {
          name: 'sellerProofPath';
          type: {
            option: {
              vec: {
                array: ['u8', 32];
              };
            };
          };
        }
      ];
    },
    {
      name: 'removeNft';
      docs: [
        'Remove legacy NFT from the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
            'Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)'
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
          name: 'tmpTokenAccount';
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
        }
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        }
      ];
    },
    {
      name: 'removeCoreAsset';
      docs: [
        'Remove Core asset from the gumball machine.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
        }
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        }
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
        '1. `[signer]` Gumball Machine authority'
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
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.'
          ];
        }
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
        '1. `[signer]` Gumball Machine authority'
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
            'Gumball Machine authority. This is the address that controls the upate of the gumball machine.'
          ];
        }
      ];
      args: [];
    },
    {
      name: 'draw';
      docs: [
        'Mint an NFT.',
        '',
        'Only the gumball machine mint authority is allowed to mint. This handler mints both',
        'NFTs and Programmable NFTs.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)',
        '2. `[signer]` Gumball Machine mint authority',
        '3. `[signer]` Payer',
        '4. `[writable]` Mint account of the NFT',
        '18. `[]` System program',
        '20. `[]` SlotHashes sysvar cluster data.'
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
            'Gumball machine mint authority (mint only allowed for the mint_authority).'
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
        }
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
        '0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)',
        '2. `[signer]` Gumball Machine mint authority'
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
            'Gumball machine mint authority (mint only allowed for the mint_authority).'
          ];
        }
      ];
      args: [
        {
          name: 'revenue';
          type: 'u64';
        }
      ];
    },
    {
      name: 'claimCoreAsset';
      docs: [
        'Settles a Core asset sale',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
          isMut: false;
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
        }
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        }
      ];
    },
    {
      name: 'claimNft';
      docs: [
        'Settles a legacy NFT sale',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
          name: 'tmpTokenAccount';
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
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        }
      ];
    },
    {
      name: 'settleCoreAssetSale';
      docs: [
        'Settles a Core asset sale',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
          isMut: false;
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
        }
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        }
      ];
    },
    {
      name: 'settleNftSale';
      docs: [
        'Settles a legacy NFT sale',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
          name: 'tmpTokenAccount';
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
          name: 'eventAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'program';
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: 'index';
          type: 'u32';
        }
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
        '1. `[signer]` Gumball Machine authority'
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
        }
      ];
      args: [
        {
          name: 'newAuthority';
          type: 'publicKey';
        }
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
        '1. `[signer]` New gumball machine authority'
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
        }
      ];
      args: [];
    },
    {
      name: 'withdraw';
      docs: [
        'Withdraw the rent lamports and send them to the authority address.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority'
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
        }
      ];
      args: [];
    }
  ];
  accounts: [
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
              'Authority address allowed to mint from the gumball machine.'
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
            name: 'finalizedItemsCount';
            docs: ['Number of assets loaded at the time the sale started.'];
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
              'True if the authority has finalized details, which prevents adding more nfts.'
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
          }
        ];
      };
    },
    {
      name: 'sellerHistory';
      docs: [
        'Seller history state to track count of items submitted to a gumball machine.'
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
          }
        ];
      };
    }
  ];
  types: [
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
          }
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
          }
        ];
      };
    },
    {
      name: 'ConfigLine';
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
            name: 'buyer';
            docs: [
              'Wallet that will receive the asset upon sale. Empty until drawn.'
            ];
            type: 'publicKey';
          },
          {
            name: 'tokenStandard';
            docs: ['Token standard.'];
            type: {
              defined: 'TokenStandard';
            };
          }
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
              'Merkle root hash for sellers who can add items to the machine.'
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
              'True if the front end should hide items that have been sold.'
            ];
            type: 'bool';
          },
          {
            name: 'paymentMint';
            docs: ['Payment token for the mint'];
            type: 'publicKey';
          }
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
          }
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
          }
        ];
      };
    }
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
        }
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
          type: 'u64';
          index: false;
        }
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
        }
      ];
    }
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
      name: 'InvalidMint';
      msg: 'Invalid mint';
    },
    {
      code: 6039;
      name: 'InvalidPaymentMint';
      msg: 'Invalid payment mint';
    },
    {
      code: 6040;
      name: 'InvalidSeller';
      msg: 'Invalid seller';
    },
    {
      code: 6041;
      name: 'InvalidBuyer';
      msg: 'Invalid buyer';
    },
    {
      code: 6042;
      name: 'UriTooLong';
      msg: 'URI too long';
    },
    {
      code: 6043;
      name: 'InvalidProofPath';
      msg: 'Invalid proof path';
    },
    {
      code: 6044;
      name: 'InvalidSettingUpdate';
      msg: 'Invalid setting update';
    },
    {
      code: 6045;
      name: 'SellerTooManyItems';
      msg: 'Seller has too many items';
    },
    {
      code: 6046;
      name: 'NotAllSettled';
      msg: 'Not all items have been settled';
    }
  ];
};

export const IDL: MallowGumball = {
  version: '3.0.1',
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
        '2. `[]` Gumball Machine authority',
        '3. `[signer]` Payer',
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
        '1. `[signer]` Gumball Machine authority',
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
          name: 'settings',
          type: {
            defined: 'GumballSettings',
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
          isMut: false,
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
      ],
      args: [
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
          name: 'sellerProofPath',
          type: {
            option: {
              vec: {
                array: ['u8', 32],
              },
            },
          },
        },
      ],
    },
    {
      name: 'removeNft',
      docs: [
        'Remove legacy NFT from the gumball machine.',
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
          name: 'tmpTokenAccount',
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
      name: 'startSale',
      docs: [
        'Allows minting to begin.',
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
      name: 'endSale',
      docs: [
        'Disables minting and allows sales to be settled.',
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
        'Mint an NFT.',
        '',
        'Only the gumball machine mint authority is allowed to mint. This handler mints both',
        'NFTs and Programmable NFTs.',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)',
        '2. `[signer]` Gumball Machine mint authority',
        '3. `[signer]` Payer',
        '4. `[writable]` Mint account of the NFT',
        '18. `[]` System program',
        '20. `[]` SlotHashes sysvar cluster data.',
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
        '0. `[writable]` Gumball Machine account (must be pre-allocated but zero content)',
        '2. `[signer]` Gumball Machine mint authority',
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
      name: 'claimCoreAsset',
      docs: [
        'Settles a Core asset sale',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
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
          isMut: false,
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
        'Settles a legacy NFT sale',
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
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
          name: 'tmpTokenAccount',
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
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
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
          isMut: false,
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
        '',
        '# Accounts',
        '',
        '0. `[writable]` Gumball Machine account',
        '1. `[signer]` Gumball Machine authority',
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
          name: 'tmpTokenAccount',
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
        '1. `[signer]` New gumball machine authority',
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
  ],
  accounts: [
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
            name: 'finalizedItemsCount',
            docs: ['Number of assets loaded at the time the sale started.'],
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
      name: 'ConfigLine',
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
          type: 'u64',
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
      name: 'InvalidMint',
      msg: 'Invalid mint',
    },
    {
      code: 6039,
      name: 'InvalidPaymentMint',
      msg: 'Invalid payment mint',
    },
    {
      code: 6040,
      name: 'InvalidSeller',
      msg: 'Invalid seller',
    },
    {
      code: 6041,
      name: 'InvalidBuyer',
      msg: 'Invalid buyer',
    },
    {
      code: 6042,
      name: 'UriTooLong',
      msg: 'URI too long',
    },
    {
      code: 6043,
      name: 'InvalidProofPath',
      msg: 'Invalid proof path',
    },
    {
      code: 6044,
      name: 'InvalidSettingUpdate',
      msg: 'Invalid setting update',
    },
    {
      code: 6045,
      name: 'SellerTooManyItems',
      msg: 'Seller has too many items',
    },
    {
      code: 6046,
      name: 'NotAllSettled',
      msg: 'Not all items have been settled',
    },
  ],
};