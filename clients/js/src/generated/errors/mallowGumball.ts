/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Program, ProgramError } from '@metaplex-foundation/umi';

type ProgramErrorConstructor = new (
  program: Program,
  cause?: Error
) => ProgramError;
const codeToErrorMap: Map<number, ProgramErrorConstructor> = new Map();
const nameToErrorMap: Map<string, ProgramErrorConstructor> = new Map();

/** IncorrectOwner: Account does not have correct owner */
export class IncorrectOwnerError extends ProgramError {
  readonly name: string = 'IncorrectOwner';

  readonly code: number = 0x1770; // 6000

  constructor(program: Program, cause?: Error) {
    super('Account does not have correct owner', program, cause);
  }
}
codeToErrorMap.set(0x1770, IncorrectOwnerError);
nameToErrorMap.set('IncorrectOwner', IncorrectOwnerError);

/** Uninitialized: Account is not initialized */
export class UninitializedError extends ProgramError {
  readonly name: string = 'Uninitialized';

  readonly code: number = 0x1771; // 6001

  constructor(program: Program, cause?: Error) {
    super('Account is not initialized', program, cause);
  }
}
codeToErrorMap.set(0x1771, UninitializedError);
nameToErrorMap.set('Uninitialized', UninitializedError);

/** MintMismatch: Mint Mismatch */
export class MintMismatchError extends ProgramError {
  readonly name: string = 'MintMismatch';

  readonly code: number = 0x1772; // 6002

  constructor(program: Program, cause?: Error) {
    super('Mint Mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1772, MintMismatchError);
nameToErrorMap.set('MintMismatch', MintMismatchError);

/** IndexGreaterThanLength: Index greater than length */
export class IndexGreaterThanLengthError extends ProgramError {
  readonly name: string = 'IndexGreaterThanLength';

  readonly code: number = 0x1773; // 6003

  constructor(program: Program, cause?: Error) {
    super('Index greater than length', program, cause);
  }
}
codeToErrorMap.set(0x1773, IndexGreaterThanLengthError);
nameToErrorMap.set('IndexGreaterThanLength', IndexGreaterThanLengthError);

/** NumericalOverflowError: Numerical overflow error */
export class NumericalOverflowErrorError extends ProgramError {
  readonly name: string = 'NumericalOverflowError';

  readonly code: number = 0x1774; // 6004

  constructor(program: Program, cause?: Error) {
    super('Numerical overflow error', program, cause);
  }
}
codeToErrorMap.set(0x1774, NumericalOverflowErrorError);
nameToErrorMap.set('NumericalOverflowError', NumericalOverflowErrorError);

/** TooManyCreators: Can only provide up to 4 creators to gumball machine (because gumball machine is one) */
export class TooManyCreatorsError extends ProgramError {
  readonly name: string = 'TooManyCreators';

  readonly code: number = 0x1775; // 6005

  constructor(program: Program, cause?: Error) {
    super(
      'Can only provide up to 4 creators to gumball machine (because gumball machine is one)',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1775, TooManyCreatorsError);
nameToErrorMap.set('TooManyCreators', TooManyCreatorsError);

/** GumballMachineEmpty: Gumball machine is empty */
export class GumballMachineEmptyError extends ProgramError {
  readonly name: string = 'GumballMachineEmpty';

  readonly code: number = 0x1776; // 6006

  constructor(program: Program, cause?: Error) {
    super('Gumball machine is empty', program, cause);
  }
}
codeToErrorMap.set(0x1776, GumballMachineEmptyError);
nameToErrorMap.set('GumballMachineEmpty', GumballMachineEmptyError);

/** HiddenSettingsDoNotHaveConfigLines: Gumball machines using hidden uris do not have config lines, they have a single hash representing hashed order */
export class HiddenSettingsDoNotHaveConfigLinesError extends ProgramError {
  readonly name: string = 'HiddenSettingsDoNotHaveConfigLines';

  readonly code: number = 0x1777; // 6007

  constructor(program: Program, cause?: Error) {
    super(
      'Gumball machines using hidden uris do not have config lines, they have a single hash representing hashed order',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1777, HiddenSettingsDoNotHaveConfigLinesError);
nameToErrorMap.set(
  'HiddenSettingsDoNotHaveConfigLines',
  HiddenSettingsDoNotHaveConfigLinesError
);

/** CannotChangeNumberOfLines: Cannot change number of lines unless is a hidden config */
export class CannotChangeNumberOfLinesError extends ProgramError {
  readonly name: string = 'CannotChangeNumberOfLines';

  readonly code: number = 0x1778; // 6008

  constructor(program: Program, cause?: Error) {
    super(
      'Cannot change number of lines unless is a hidden config',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1778, CannotChangeNumberOfLinesError);
nameToErrorMap.set('CannotChangeNumberOfLines', CannotChangeNumberOfLinesError);

/** CannotSwitchToHiddenSettings: Cannot switch to hidden settings after items available is greater than 0 */
export class CannotSwitchToHiddenSettingsError extends ProgramError {
  readonly name: string = 'CannotSwitchToHiddenSettings';

  readonly code: number = 0x1779; // 6009

  constructor(program: Program, cause?: Error) {
    super(
      'Cannot switch to hidden settings after items available is greater than 0',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1779, CannotSwitchToHiddenSettingsError);
nameToErrorMap.set(
  'CannotSwitchToHiddenSettings',
  CannotSwitchToHiddenSettingsError
);

/** IncorrectCollectionAuthority: Incorrect collection NFT authority */
export class IncorrectCollectionAuthorityError extends ProgramError {
  readonly name: string = 'IncorrectCollectionAuthority';

  readonly code: number = 0x177a; // 6010

  constructor(program: Program, cause?: Error) {
    super('Incorrect collection NFT authority', program, cause);
  }
}
codeToErrorMap.set(0x177a, IncorrectCollectionAuthorityError);
nameToErrorMap.set(
  'IncorrectCollectionAuthority',
  IncorrectCollectionAuthorityError
);

/** MetadataAccountMustBeEmpty: The metadata account has data in it, and this must be empty to mint a new NFT */
export class MetadataAccountMustBeEmptyError extends ProgramError {
  readonly name: string = 'MetadataAccountMustBeEmpty';

  readonly code: number = 0x177b; // 6011

  constructor(program: Program, cause?: Error) {
    super(
      'The metadata account has data in it, and this must be empty to mint a new NFT',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x177b, MetadataAccountMustBeEmptyError);
nameToErrorMap.set(
  'MetadataAccountMustBeEmpty',
  MetadataAccountMustBeEmptyError
);

/** NoChangingCollectionDuringMint: Can't change collection settings after items have begun to be minted */
export class NoChangingCollectionDuringMintError extends ProgramError {
  readonly name: string = 'NoChangingCollectionDuringMint';

  readonly code: number = 0x177c; // 6012

  constructor(program: Program, cause?: Error) {
    super(
      "Can't change collection settings after items have begun to be minted",
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x177c, NoChangingCollectionDuringMintError);
nameToErrorMap.set(
  'NoChangingCollectionDuringMint',
  NoChangingCollectionDuringMintError
);

/** ExceededLengthError: Value longer than expected maximum value */
export class ExceededLengthErrorError extends ProgramError {
  readonly name: string = 'ExceededLengthError';

  readonly code: number = 0x177d; // 6013

  constructor(program: Program, cause?: Error) {
    super('Value longer than expected maximum value', program, cause);
  }
}
codeToErrorMap.set(0x177d, ExceededLengthErrorError);
nameToErrorMap.set('ExceededLengthError', ExceededLengthErrorError);

/** MissingConfigLinesSettings: Missing config lines settings */
export class MissingConfigLinesSettingsError extends ProgramError {
  readonly name: string = 'MissingConfigLinesSettings';

  readonly code: number = 0x177e; // 6014

  constructor(program: Program, cause?: Error) {
    super('Missing config lines settings', program, cause);
  }
}
codeToErrorMap.set(0x177e, MissingConfigLinesSettingsError);
nameToErrorMap.set(
  'MissingConfigLinesSettings',
  MissingConfigLinesSettingsError
);

/** CannotIncreaseLength: Cannot increase the length in config lines settings */
export class CannotIncreaseLengthError extends ProgramError {
  readonly name: string = 'CannotIncreaseLength';

  readonly code: number = 0x177f; // 6015

  constructor(program: Program, cause?: Error) {
    super(
      'Cannot increase the length in config lines settings',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x177f, CannotIncreaseLengthError);
nameToErrorMap.set('CannotIncreaseLength', CannotIncreaseLengthError);

/** CannotSwitchFromHiddenSettings: Cannot switch from hidden settings */
export class CannotSwitchFromHiddenSettingsError extends ProgramError {
  readonly name: string = 'CannotSwitchFromHiddenSettings';

  readonly code: number = 0x1780; // 6016

  constructor(program: Program, cause?: Error) {
    super('Cannot switch from hidden settings', program, cause);
  }
}
codeToErrorMap.set(0x1780, CannotSwitchFromHiddenSettingsError);
nameToErrorMap.set(
  'CannotSwitchFromHiddenSettings',
  CannotSwitchFromHiddenSettingsError
);

/** CannotChangeSequentialIndexGeneration: Cannot change sequential index generation after items have begun to be minted */
export class CannotChangeSequentialIndexGenerationError extends ProgramError {
  readonly name: string = 'CannotChangeSequentialIndexGeneration';

  readonly code: number = 0x1781; // 6017

  constructor(program: Program, cause?: Error) {
    super(
      'Cannot change sequential index generation after items have begun to be minted',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1781, CannotChangeSequentialIndexGenerationError);
nameToErrorMap.set(
  'CannotChangeSequentialIndexGeneration',
  CannotChangeSequentialIndexGenerationError
);

/** CollectionKeyMismatch: Collection public key mismatch */
export class CollectionKeyMismatchError extends ProgramError {
  readonly name: string = 'CollectionKeyMismatch';

  readonly code: number = 0x1782; // 6018

  constructor(program: Program, cause?: Error) {
    super('Collection public key mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1782, CollectionKeyMismatchError);
nameToErrorMap.set('CollectionKeyMismatch', CollectionKeyMismatchError);

/** CouldNotRetrieveConfigLineData: Could not retrive config line data */
export class CouldNotRetrieveConfigLineDataError extends ProgramError {
  readonly name: string = 'CouldNotRetrieveConfigLineData';

  readonly code: number = 0x1783; // 6019

  constructor(program: Program, cause?: Error) {
    super('Could not retrive config line data', program, cause);
  }
}
codeToErrorMap.set(0x1783, CouldNotRetrieveConfigLineDataError);
nameToErrorMap.set(
  'CouldNotRetrieveConfigLineData',
  CouldNotRetrieveConfigLineDataError
);

/** NotFullyLoaded: Not all config lines were added to the gumball machine */
export class NotFullyLoadedError extends ProgramError {
  readonly name: string = 'NotFullyLoaded';

  readonly code: number = 0x1784; // 6020

  constructor(program: Program, cause?: Error) {
    super(
      'Not all config lines were added to the gumball machine',
      program,
      cause
    );
  }
}
codeToErrorMap.set(0x1784, NotFullyLoadedError);
nameToErrorMap.set('NotFullyLoaded', NotFullyLoadedError);

/** InstructionBuilderFailed: Instruction could not be created */
export class InstructionBuilderFailedError extends ProgramError {
  readonly name: string = 'InstructionBuilderFailed';

  readonly code: number = 0x1785; // 6021

  constructor(program: Program, cause?: Error) {
    super('Instruction could not be created', program, cause);
  }
}
codeToErrorMap.set(0x1785, InstructionBuilderFailedError);
nameToErrorMap.set('InstructionBuilderFailed', InstructionBuilderFailedError);

/** MissingCollectionAuthorityRecord: Missing collection authority record */
export class MissingCollectionAuthorityRecordError extends ProgramError {
  readonly name: string = 'MissingCollectionAuthorityRecord';

  readonly code: number = 0x1786; // 6022

  constructor(program: Program, cause?: Error) {
    super('Missing collection authority record', program, cause);
  }
}
codeToErrorMap.set(0x1786, MissingCollectionAuthorityRecordError);
nameToErrorMap.set(
  'MissingCollectionAuthorityRecord',
  MissingCollectionAuthorityRecordError
);

/** MissingMetadataDelegateRecord: Missing metadata delegate record */
export class MissingMetadataDelegateRecordError extends ProgramError {
  readonly name: string = 'MissingMetadataDelegateRecord';

  readonly code: number = 0x1787; // 6023

  constructor(program: Program, cause?: Error) {
    super('Missing metadata delegate record', program, cause);
  }
}
codeToErrorMap.set(0x1787, MissingMetadataDelegateRecordError);
nameToErrorMap.set(
  'MissingMetadataDelegateRecord',
  MissingMetadataDelegateRecordError
);

/** InvalidTokenStandard: Invalid token standard */
export class InvalidTokenStandardError extends ProgramError {
  readonly name: string = 'InvalidTokenStandard';

  readonly code: number = 0x1788; // 6024

  constructor(program: Program, cause?: Error) {
    super('Invalid token standard', program, cause);
  }
}
codeToErrorMap.set(0x1788, InvalidTokenStandardError);
nameToErrorMap.set('InvalidTokenStandard', InvalidTokenStandardError);

/** MissingTokenAccount: Missing token account */
export class MissingTokenAccountError extends ProgramError {
  readonly name: string = 'MissingTokenAccount';

  readonly code: number = 0x1789; // 6025

  constructor(program: Program, cause?: Error) {
    super('Missing token account', program, cause);
  }
}
codeToErrorMap.set(0x1789, MissingTokenAccountError);
nameToErrorMap.set('MissingTokenAccount', MissingTokenAccountError);

/** MissingTokenRecord: Missing token record */
export class MissingTokenRecordError extends ProgramError {
  readonly name: string = 'MissingTokenRecord';

  readonly code: number = 0x178a; // 6026

  constructor(program: Program, cause?: Error) {
    super('Missing token record', program, cause);
  }
}
codeToErrorMap.set(0x178a, MissingTokenRecordError);
nameToErrorMap.set('MissingTokenRecord', MissingTokenRecordError);

/** MissingInstructionsSysvar: Missing instructions sysvar account */
export class MissingInstructionsSysvarError extends ProgramError {
  readonly name: string = 'MissingInstructionsSysvar';

  readonly code: number = 0x178b; // 6027

  constructor(program: Program, cause?: Error) {
    super('Missing instructions sysvar account', program, cause);
  }
}
codeToErrorMap.set(0x178b, MissingInstructionsSysvarError);
nameToErrorMap.set('MissingInstructionsSysvar', MissingInstructionsSysvarError);

/** MissingSplAtaProgram: Missing SPL ATA program */
export class MissingSplAtaProgramError extends ProgramError {
  readonly name: string = 'MissingSplAtaProgram';

  readonly code: number = 0x178c; // 6028

  constructor(program: Program, cause?: Error) {
    super('Missing SPL ATA program', program, cause);
  }
}
codeToErrorMap.set(0x178c, MissingSplAtaProgramError);
nameToErrorMap.set('MissingSplAtaProgram', MissingSplAtaProgramError);

/** InvalidAccountVersion: Invalid account version */
export class InvalidAccountVersionError extends ProgramError {
  readonly name: string = 'InvalidAccountVersion';

  readonly code: number = 0x178d; // 6029

  constructor(program: Program, cause?: Error) {
    super('Invalid account version', program, cause);
  }
}
codeToErrorMap.set(0x178d, InvalidAccountVersionError);
nameToErrorMap.set('InvalidAccountVersion', InvalidAccountVersionError);

/** NotPrimarySale: Not a primary sale asset */
export class NotPrimarySaleError extends ProgramError {
  readonly name: string = 'NotPrimarySale';

  readonly code: number = 0x178e; // 6030

  constructor(program: Program, cause?: Error) {
    super('Not a primary sale asset', program, cause);
  }
}
codeToErrorMap.set(0x178e, NotPrimarySaleError);
nameToErrorMap.set('NotPrimarySale', NotPrimarySaleError);

/** InvalidEditionAccount: Invalid edition account */
export class InvalidEditionAccountError extends ProgramError {
  readonly name: string = 'InvalidEditionAccount';

  readonly code: number = 0x178f; // 6031

  constructor(program: Program, cause?: Error) {
    super('Invalid edition account', program, cause);
  }
}
codeToErrorMap.set(0x178f, InvalidEditionAccountError);
nameToErrorMap.set('InvalidEditionAccount', InvalidEditionAccountError);

/** InvalidMasterEditionSupply: Invalid master edition supply */
export class InvalidMasterEditionSupplyError extends ProgramError {
  readonly name: string = 'InvalidMasterEditionSupply';

  readonly code: number = 0x1790; // 6032

  constructor(program: Program, cause?: Error) {
    super('Invalid master edition supply', program, cause);
  }
}
codeToErrorMap.set(0x1790, InvalidMasterEditionSupplyError);
nameToErrorMap.set(
  'InvalidMasterEditionSupply',
  InvalidMasterEditionSupplyError
);

/** PublicKeyMismatch: Public key mismatch */
export class PublicKeyMismatchError extends ProgramError {
  readonly name: string = 'PublicKeyMismatch';

  readonly code: number = 0x1791; // 6033

  constructor(program: Program, cause?: Error) {
    super('Public key mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1791, PublicKeyMismatchError);
nameToErrorMap.set('PublicKeyMismatch', PublicKeyMismatchError);

/** InvalidCollection: Invalid collection */
export class InvalidCollectionError extends ProgramError {
  readonly name: string = 'InvalidCollection';

  readonly code: number = 0x1792; // 6034

  constructor(program: Program, cause?: Error) {
    super('Invalid collection', program, cause);
  }
}
codeToErrorMap.set(0x1792, InvalidCollectionError);
nameToErrorMap.set('InvalidCollection', InvalidCollectionError);

/** GumballMachineDetailsFinalized: Gumball machine detailed finalized */
export class GumballMachineDetailsFinalizedError extends ProgramError {
  readonly name: string = 'GumballMachineDetailsFinalized';

  readonly code: number = 0x1793; // 6035

  constructor(program: Program, cause?: Error) {
    super('Gumball machine detailed finalized', program, cause);
  }
}
codeToErrorMap.set(0x1793, GumballMachineDetailsFinalizedError);
nameToErrorMap.set(
  'GumballMachineDetailsFinalized',
  GumballMachineDetailsFinalizedError
);

/** InvalidState: Invalid state */
export class InvalidStateError extends ProgramError {
  readonly name: string = 'InvalidState';

  readonly code: number = 0x1794; // 6036

  constructor(program: Program, cause?: Error) {
    super('Invalid state', program, cause);
  }
}
codeToErrorMap.set(0x1794, InvalidStateError);
nameToErrorMap.set('InvalidState', InvalidStateError);

/** InvalidAuthority: Invalid authority */
export class InvalidAuthorityError extends ProgramError {
  readonly name: string = 'InvalidAuthority';

  readonly code: number = 0x1795; // 6037

  constructor(program: Program, cause?: Error) {
    super('Invalid authority', program, cause);
  }
}
codeToErrorMap.set(0x1795, InvalidAuthorityError);
nameToErrorMap.set('InvalidAuthority', InvalidAuthorityError);

/** InvalidMintAuthority: Invalid mint authority */
export class InvalidMintAuthorityError extends ProgramError {
  readonly name: string = 'InvalidMintAuthority';

  readonly code: number = 0x1796; // 6038

  constructor(program: Program, cause?: Error) {
    super('Invalid mint authority', program, cause);
  }
}
codeToErrorMap.set(0x1796, InvalidMintAuthorityError);
nameToErrorMap.set('InvalidMintAuthority', InvalidMintAuthorityError);

/** InvalidMint: Invalid mint */
export class InvalidMintError extends ProgramError {
  readonly name: string = 'InvalidMint';

  readonly code: number = 0x1797; // 6039

  constructor(program: Program, cause?: Error) {
    super('Invalid mint', program, cause);
  }
}
codeToErrorMap.set(0x1797, InvalidMintError);
nameToErrorMap.set('InvalidMint', InvalidMintError);

/** InvalidPaymentMint: Invalid payment mint */
export class InvalidPaymentMintError extends ProgramError {
  readonly name: string = 'InvalidPaymentMint';

  readonly code: number = 0x1798; // 6040

  constructor(program: Program, cause?: Error) {
    super('Invalid payment mint', program, cause);
  }
}
codeToErrorMap.set(0x1798, InvalidPaymentMintError);
nameToErrorMap.set('InvalidPaymentMint', InvalidPaymentMintError);

/** InvalidSeller: Invalid seller */
export class InvalidSellerError extends ProgramError {
  readonly name: string = 'InvalidSeller';

  readonly code: number = 0x1799; // 6041

  constructor(program: Program, cause?: Error) {
    super('Invalid seller', program, cause);
  }
}
codeToErrorMap.set(0x1799, InvalidSellerError);
nameToErrorMap.set('InvalidSeller', InvalidSellerError);

/** InvalidBuyer: Invalid buyer */
export class InvalidBuyerError extends ProgramError {
  readonly name: string = 'InvalidBuyer';

  readonly code: number = 0x179a; // 6042

  constructor(program: Program, cause?: Error) {
    super('Invalid buyer', program, cause);
  }
}
codeToErrorMap.set(0x179a, InvalidBuyerError);
nameToErrorMap.set('InvalidBuyer', InvalidBuyerError);

/** UriTooLong: URI too long */
export class UriTooLongError extends ProgramError {
  readonly name: string = 'UriTooLong';

  readonly code: number = 0x179b; // 6043

  constructor(program: Program, cause?: Error) {
    super('URI too long', program, cause);
  }
}
codeToErrorMap.set(0x179b, UriTooLongError);
nameToErrorMap.set('UriTooLong', UriTooLongError);

/** InvalidProofPath: Invalid proof path */
export class InvalidProofPathError extends ProgramError {
  readonly name: string = 'InvalidProofPath';

  readonly code: number = 0x179c; // 6044

  constructor(program: Program, cause?: Error) {
    super('Invalid proof path', program, cause);
  }
}
codeToErrorMap.set(0x179c, InvalidProofPathError);
nameToErrorMap.set('InvalidProofPath', InvalidProofPathError);

/** InvalidSettingUpdate: Invalid setting update */
export class InvalidSettingUpdateError extends ProgramError {
  readonly name: string = 'InvalidSettingUpdate';

  readonly code: number = 0x179d; // 6045

  constructor(program: Program, cause?: Error) {
    super('Invalid setting update', program, cause);
  }
}
codeToErrorMap.set(0x179d, InvalidSettingUpdateError);
nameToErrorMap.set('InvalidSettingUpdate', InvalidSettingUpdateError);

/** SellerTooManyItems: Seller has too many items */
export class SellerTooManyItemsError extends ProgramError {
  readonly name: string = 'SellerTooManyItems';

  readonly code: number = 0x179e; // 6046

  constructor(program: Program, cause?: Error) {
    super('Seller has too many items', program, cause);
  }
}
codeToErrorMap.set(0x179e, SellerTooManyItemsError);
nameToErrorMap.set('SellerTooManyItems', SellerTooManyItemsError);

/** NotAllSettled: Not all items have been settled */
export class NotAllSettledError extends ProgramError {
  readonly name: string = 'NotAllSettled';

  readonly code: number = 0x179f; // 6047

  constructor(program: Program, cause?: Error) {
    super('Not all items have been settled', program, cause);
  }
}
codeToErrorMap.set(0x179f, NotAllSettledError);
nameToErrorMap.set('NotAllSettled', NotAllSettledError);

/** ItemAlreadySettled: Item already settled */
export class ItemAlreadySettledError extends ProgramError {
  readonly name: string = 'ItemAlreadySettled';

  readonly code: number = 0x17a0; // 6048

  constructor(program: Program, cause?: Error) {
    super('Item already settled', program, cause);
  }
}
codeToErrorMap.set(0x17a0, ItemAlreadySettledError);
nameToErrorMap.set('ItemAlreadySettled', ItemAlreadySettledError);

/** ItemAlreadyClaimed: Item already claimed */
export class ItemAlreadyClaimedError extends ProgramError {
  readonly name: string = 'ItemAlreadyClaimed';

  readonly code: number = 0x17a1; // 6049

  constructor(program: Program, cause?: Error) {
    super('Item already claimed', program, cause);
  }
}
codeToErrorMap.set(0x17a1, ItemAlreadyClaimedError);
nameToErrorMap.set('ItemAlreadyClaimed', ItemAlreadyClaimedError);

/** ItemAlreadyDrawn: Item already drawn */
export class ItemAlreadyDrawnError extends ProgramError {
  readonly name: string = 'ItemAlreadyDrawn';

  readonly code: number = 0x17a2; // 6050

  constructor(program: Program, cause?: Error) {
    super('Item already drawn', program, cause);
  }
}
codeToErrorMap.set(0x17a2, ItemAlreadyDrawnError);
nameToErrorMap.set('ItemAlreadyDrawn', ItemAlreadyDrawnError);

/** InvalidGumballMachine: Invalid gumball machine */
export class InvalidGumballMachineError extends ProgramError {
  readonly name: string = 'InvalidGumballMachine';

  readonly code: number = 0x17a3; // 6051

  constructor(program: Program, cause?: Error) {
    super('Invalid gumball machine', program, cause);
  }
}
codeToErrorMap.set(0x17a3, InvalidGumballMachineError);
nameToErrorMap.set('InvalidGumballMachine', InvalidGumballMachineError);

/** SellerCannotBeAuthority: Seller cannot be authority */
export class SellerCannotBeAuthorityError extends ProgramError {
  readonly name: string = 'SellerCannotBeAuthority';

  readonly code: number = 0x17a4; // 6052

  constructor(program: Program, cause?: Error) {
    super('Seller cannot be authority', program, cause);
  }
}
codeToErrorMap.set(0x17a4, SellerCannotBeAuthorityError);
nameToErrorMap.set('SellerCannotBeAuthority', SellerCannotBeAuthorityError);

/** InvalidAssetPlugin: Asset has an invalid plugin */
export class InvalidAssetPluginError extends ProgramError {
  readonly name: string = 'InvalidAssetPlugin';

  readonly code: number = 0x17a5; // 6053

  constructor(program: Program, cause?: Error) {
    super('Asset has an invalid plugin', program, cause);
  }
}
codeToErrorMap.set(0x17a5, InvalidAssetPluginError);
nameToErrorMap.set('InvalidAssetPlugin', InvalidAssetPluginError);

/** InvalidAmount: Invalid amount */
export class InvalidAmountError extends ProgramError {
  readonly name: string = 'InvalidAmount';

  readonly code: number = 0x17a6; // 6054

  constructor(program: Program, cause?: Error) {
    super('Invalid amount', program, cause);
  }
}
codeToErrorMap.set(0x17a6, InvalidAmountError);
nameToErrorMap.set('InvalidAmount', InvalidAmountError);

/** DuplicateIndex: Duplicate index */
export class DuplicateIndexError extends ProgramError {
  readonly name: string = 'DuplicateIndex';

  readonly code: number = 0x17a7; // 6055

  constructor(program: Program, cause?: Error) {
    super('Duplicate index', program, cause);
  }
}
codeToErrorMap.set(0x17a7, DuplicateIndexError);
nameToErrorMap.set('DuplicateIndex', DuplicateIndexError);

/** InvalidInputLength: Invalid input length */
export class InvalidInputLengthError extends ProgramError {
  readonly name: string = 'InvalidInputLength';

  readonly code: number = 0x17a8; // 6056

  constructor(program: Program, cause?: Error) {
    super('Invalid input length', program, cause);
  }
}
codeToErrorMap.set(0x17a8, InvalidInputLengthError);
nameToErrorMap.set('InvalidInputLength', InvalidInputLengthError);

/** BuyBackNotEnabled: Buy back not enabled */
export class BuyBackNotEnabledError extends ProgramError {
  readonly name: string = 'BuyBackNotEnabled';

  readonly code: number = 0x17a9; // 6057

  constructor(program: Program, cause?: Error) {
    super('Buy back not enabled', program, cause);
  }
}
codeToErrorMap.set(0x17a9, BuyBackNotEnabledError);
nameToErrorMap.set('BuyBackNotEnabled', BuyBackNotEnabledError);

/** BuyBackFundsNotZero: Buy back funds not zero */
export class BuyBackFundsNotZeroError extends ProgramError {
  readonly name: string = 'BuyBackFundsNotZero';

  readonly code: number = 0x17aa; // 6058

  constructor(program: Program, cause?: Error) {
    super('Buy back funds not zero', program, cause);
  }
}
codeToErrorMap.set(0x17aa, BuyBackFundsNotZeroError);
nameToErrorMap.set('BuyBackFundsNotZero', BuyBackFundsNotZeroError);

/** InsufficientFunds: Insufficient funds */
export class InsufficientFundsError extends ProgramError {
  readonly name: string = 'InsufficientFunds';

  readonly code: number = 0x17ab; // 6059

  constructor(program: Program, cause?: Error) {
    super('Insufficient funds', program, cause);
  }
}
codeToErrorMap.set(0x17ab, InsufficientFundsError);
nameToErrorMap.set('InsufficientFunds', InsufficientFundsError);

/**
 * Attempts to resolve a custom program error from the provided error code.
 * @category Errors
 */
export function getMallowGumballErrorFromCode(
  code: number,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = codeToErrorMap.get(code);
  return constructor ? new constructor(program, cause) : null;
}

/**
 * Attempts to resolve a custom program error from the provided error name, i.e. 'Unauthorized'.
 * @category Errors
 */
export function getMallowGumballErrorFromName(
  name: string,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = nameToErrorMap.get(name);
  return constructor ? new constructor(program, cause) : null;
}
