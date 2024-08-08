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
export class CmIncorrectOwnerError extends ProgramError {
  readonly name: string = 'IncorrectOwner';

  readonly code: number = 0x1770; // 6000

  constructor(program: Program, cause?: Error) {
    super('Account does not have correct owner', program, cause);
  }
}
codeToErrorMap.set(0x1770, CmIncorrectOwnerError);
nameToErrorMap.set('IncorrectOwner', CmIncorrectOwnerError);

/** Uninitialized: Account is not initialized */
export class CmUninitializedError extends ProgramError {
  readonly name: string = 'Uninitialized';

  readonly code: number = 0x1771; // 6001

  constructor(program: Program, cause?: Error) {
    super('Account is not initialized', program, cause);
  }
}
codeToErrorMap.set(0x1771, CmUninitializedError);
nameToErrorMap.set('Uninitialized', CmUninitializedError);

/** MintMismatch: Mint Mismatch */
export class CmMintMismatchError extends ProgramError {
  readonly name: string = 'MintMismatch';

  readonly code: number = 0x1772; // 6002

  constructor(program: Program, cause?: Error) {
    super('Mint Mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1772, CmMintMismatchError);
nameToErrorMap.set('MintMismatch', CmMintMismatchError);

/** IndexGreaterThanLength: Index greater than length */
export class CmIndexGreaterThanLengthError extends ProgramError {
  readonly name: string = 'IndexGreaterThanLength';

  readonly code: number = 0x1773; // 6003

  constructor(program: Program, cause?: Error) {
    super('Index greater than length', program, cause);
  }
}
codeToErrorMap.set(0x1773, CmIndexGreaterThanLengthError);
nameToErrorMap.set('IndexGreaterThanLength', CmIndexGreaterThanLengthError);

/** NumericalOverflowError: Numerical overflow error */
export class CmNumericalOverflowErrorError extends ProgramError {
  readonly name: string = 'NumericalOverflowError';

  readonly code: number = 0x1774; // 6004

  constructor(program: Program, cause?: Error) {
    super('Numerical overflow error', program, cause);
  }
}
codeToErrorMap.set(0x1774, CmNumericalOverflowErrorError);
nameToErrorMap.set('NumericalOverflowError', CmNumericalOverflowErrorError);

/** TooManyCreators: Can only provide up to 4 creators to gumball machine (because gumball machine is one) */
export class CmTooManyCreatorsError extends ProgramError {
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
codeToErrorMap.set(0x1775, CmTooManyCreatorsError);
nameToErrorMap.set('TooManyCreators', CmTooManyCreatorsError);

/** GumballMachineEmpty: Gumball machine is empty */
export class CmGumballMachineEmptyError extends ProgramError {
  readonly name: string = 'GumballMachineEmpty';

  readonly code: number = 0x1776; // 6006

  constructor(program: Program, cause?: Error) {
    super('Gumball machine is empty', program, cause);
  }
}
codeToErrorMap.set(0x1776, CmGumballMachineEmptyError);
nameToErrorMap.set('GumballMachineEmpty', CmGumballMachineEmptyError);

/** HiddenSettingsDoNotHaveConfigLines: Gumball machines using hidden uris do not have config lines, they have a single hash representing hashed order */
export class CmHiddenSettingsDoNotHaveConfigLinesError extends ProgramError {
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
codeToErrorMap.set(0x1777, CmHiddenSettingsDoNotHaveConfigLinesError);
nameToErrorMap.set(
  'HiddenSettingsDoNotHaveConfigLines',
  CmHiddenSettingsDoNotHaveConfigLinesError
);

/** CannotChangeNumberOfLines: Cannot change number of lines unless is a hidden config */
export class CmCannotChangeNumberOfLinesError extends ProgramError {
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
codeToErrorMap.set(0x1778, CmCannotChangeNumberOfLinesError);
nameToErrorMap.set(
  'CannotChangeNumberOfLines',
  CmCannotChangeNumberOfLinesError
);

/** CannotSwitchToHiddenSettings: Cannot switch to hidden settings after items available is greater than 0 */
export class CmCannotSwitchToHiddenSettingsError extends ProgramError {
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
codeToErrorMap.set(0x1779, CmCannotSwitchToHiddenSettingsError);
nameToErrorMap.set(
  'CannotSwitchToHiddenSettings',
  CmCannotSwitchToHiddenSettingsError
);

/** IncorrectCollectionAuthority: Incorrect collection NFT authority */
export class CmIncorrectCollectionAuthorityError extends ProgramError {
  readonly name: string = 'IncorrectCollectionAuthority';

  readonly code: number = 0x177a; // 6010

  constructor(program: Program, cause?: Error) {
    super('Incorrect collection NFT authority', program, cause);
  }
}
codeToErrorMap.set(0x177a, CmIncorrectCollectionAuthorityError);
nameToErrorMap.set(
  'IncorrectCollectionAuthority',
  CmIncorrectCollectionAuthorityError
);

/** MetadataAccountMustBeEmpty: The metadata account has data in it, and this must be empty to mint a new NFT */
export class CmMetadataAccountMustBeEmptyError extends ProgramError {
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
codeToErrorMap.set(0x177b, CmMetadataAccountMustBeEmptyError);
nameToErrorMap.set(
  'MetadataAccountMustBeEmpty',
  CmMetadataAccountMustBeEmptyError
);

/** NoChangingCollectionDuringMint: Can't change collection settings after items have begun to be minted */
export class CmNoChangingCollectionDuringMintError extends ProgramError {
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
codeToErrorMap.set(0x177c, CmNoChangingCollectionDuringMintError);
nameToErrorMap.set(
  'NoChangingCollectionDuringMint',
  CmNoChangingCollectionDuringMintError
);

/** ExceededLengthError: Value longer than expected maximum value */
export class CmExceededLengthErrorError extends ProgramError {
  readonly name: string = 'ExceededLengthError';

  readonly code: number = 0x177d; // 6013

  constructor(program: Program, cause?: Error) {
    super('Value longer than expected maximum value', program, cause);
  }
}
codeToErrorMap.set(0x177d, CmExceededLengthErrorError);
nameToErrorMap.set('ExceededLengthError', CmExceededLengthErrorError);

/** MissingConfigLinesSettings: Missing config lines settings */
export class CmMissingConfigLinesSettingsError extends ProgramError {
  readonly name: string = 'MissingConfigLinesSettings';

  readonly code: number = 0x177e; // 6014

  constructor(program: Program, cause?: Error) {
    super('Missing config lines settings', program, cause);
  }
}
codeToErrorMap.set(0x177e, CmMissingConfigLinesSettingsError);
nameToErrorMap.set(
  'MissingConfigLinesSettings',
  CmMissingConfigLinesSettingsError
);

/** CannotIncreaseLength: Cannot increase the length in config lines settings */
export class CmCannotIncreaseLengthError extends ProgramError {
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
codeToErrorMap.set(0x177f, CmCannotIncreaseLengthError);
nameToErrorMap.set('CannotIncreaseLength', CmCannotIncreaseLengthError);

/** CannotSwitchFromHiddenSettings: Cannot switch from hidden settings */
export class CmCannotSwitchFromHiddenSettingsError extends ProgramError {
  readonly name: string = 'CannotSwitchFromHiddenSettings';

  readonly code: number = 0x1780; // 6016

  constructor(program: Program, cause?: Error) {
    super('Cannot switch from hidden settings', program, cause);
  }
}
codeToErrorMap.set(0x1780, CmCannotSwitchFromHiddenSettingsError);
nameToErrorMap.set(
  'CannotSwitchFromHiddenSettings',
  CmCannotSwitchFromHiddenSettingsError
);

/** CannotChangeSequentialIndexGeneration: Cannot change sequential index generation after items have begun to be minted */
export class CmCannotChangeSequentialIndexGenerationError extends ProgramError {
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
codeToErrorMap.set(0x1781, CmCannotChangeSequentialIndexGenerationError);
nameToErrorMap.set(
  'CannotChangeSequentialIndexGeneration',
  CmCannotChangeSequentialIndexGenerationError
);

/** CollectionKeyMismatch: Collection public key mismatch */
export class CmCollectionKeyMismatchError extends ProgramError {
  readonly name: string = 'CollectionKeyMismatch';

  readonly code: number = 0x1782; // 6018

  constructor(program: Program, cause?: Error) {
    super('Collection public key mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1782, CmCollectionKeyMismatchError);
nameToErrorMap.set('CollectionKeyMismatch', CmCollectionKeyMismatchError);

/** CouldNotRetrieveConfigLineData: Could not retrive config line data */
export class CmCouldNotRetrieveConfigLineDataError extends ProgramError {
  readonly name: string = 'CouldNotRetrieveConfigLineData';

  readonly code: number = 0x1783; // 6019

  constructor(program: Program, cause?: Error) {
    super('Could not retrive config line data', program, cause);
  }
}
codeToErrorMap.set(0x1783, CmCouldNotRetrieveConfigLineDataError);
nameToErrorMap.set(
  'CouldNotRetrieveConfigLineData',
  CmCouldNotRetrieveConfigLineDataError
);

/** NotFullyLoaded: Not all config lines were added to the gumball machine */
export class CmNotFullyLoadedError extends ProgramError {
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
codeToErrorMap.set(0x1784, CmNotFullyLoadedError);
nameToErrorMap.set('NotFullyLoaded', CmNotFullyLoadedError);

/** InstructionBuilderFailed: Instruction could not be created */
export class CmInstructionBuilderFailedError extends ProgramError {
  readonly name: string = 'InstructionBuilderFailed';

  readonly code: number = 0x1785; // 6021

  constructor(program: Program, cause?: Error) {
    super('Instruction could not be created', program, cause);
  }
}
codeToErrorMap.set(0x1785, CmInstructionBuilderFailedError);
nameToErrorMap.set('InstructionBuilderFailed', CmInstructionBuilderFailedError);

/** MissingCollectionAuthorityRecord: Missing collection authority record */
export class CmMissingCollectionAuthorityRecordError extends ProgramError {
  readonly name: string = 'MissingCollectionAuthorityRecord';

  readonly code: number = 0x1786; // 6022

  constructor(program: Program, cause?: Error) {
    super('Missing collection authority record', program, cause);
  }
}
codeToErrorMap.set(0x1786, CmMissingCollectionAuthorityRecordError);
nameToErrorMap.set(
  'MissingCollectionAuthorityRecord',
  CmMissingCollectionAuthorityRecordError
);

/** MissingMetadataDelegateRecord: Missing metadata delegate record */
export class CmMissingMetadataDelegateRecordError extends ProgramError {
  readonly name: string = 'MissingMetadataDelegateRecord';

  readonly code: number = 0x1787; // 6023

  constructor(program: Program, cause?: Error) {
    super('Missing metadata delegate record', program, cause);
  }
}
codeToErrorMap.set(0x1787, CmMissingMetadataDelegateRecordError);
nameToErrorMap.set(
  'MissingMetadataDelegateRecord',
  CmMissingMetadataDelegateRecordError
);

/** InvalidTokenStandard: Invalid token standard */
export class CmInvalidTokenStandardError extends ProgramError {
  readonly name: string = 'InvalidTokenStandard';

  readonly code: number = 0x1788; // 6024

  constructor(program: Program, cause?: Error) {
    super('Invalid token standard', program, cause);
  }
}
codeToErrorMap.set(0x1788, CmInvalidTokenStandardError);
nameToErrorMap.set('InvalidTokenStandard', CmInvalidTokenStandardError);

/** MissingTokenAccount: Missing token account */
export class CmMissingTokenAccountError extends ProgramError {
  readonly name: string = 'MissingTokenAccount';

  readonly code: number = 0x1789; // 6025

  constructor(program: Program, cause?: Error) {
    super('Missing token account', program, cause);
  }
}
codeToErrorMap.set(0x1789, CmMissingTokenAccountError);
nameToErrorMap.set('MissingTokenAccount', CmMissingTokenAccountError);

/** MissingTokenRecord: Missing token record */
export class CmMissingTokenRecordError extends ProgramError {
  readonly name: string = 'MissingTokenRecord';

  readonly code: number = 0x178a; // 6026

  constructor(program: Program, cause?: Error) {
    super('Missing token record', program, cause);
  }
}
codeToErrorMap.set(0x178a, CmMissingTokenRecordError);
nameToErrorMap.set('MissingTokenRecord', CmMissingTokenRecordError);

/** MissingInstructionsSysvar: Missing instructions sysvar account */
export class CmMissingInstructionsSysvarError extends ProgramError {
  readonly name: string = 'MissingInstructionsSysvar';

  readonly code: number = 0x178b; // 6027

  constructor(program: Program, cause?: Error) {
    super('Missing instructions sysvar account', program, cause);
  }
}
codeToErrorMap.set(0x178b, CmMissingInstructionsSysvarError);
nameToErrorMap.set(
  'MissingInstructionsSysvar',
  CmMissingInstructionsSysvarError
);

/** MissingSplAtaProgram: Missing SPL ATA program */
export class CmMissingSplAtaProgramError extends ProgramError {
  readonly name: string = 'MissingSplAtaProgram';

  readonly code: number = 0x178c; // 6028

  constructor(program: Program, cause?: Error) {
    super('Missing SPL ATA program', program, cause);
  }
}
codeToErrorMap.set(0x178c, CmMissingSplAtaProgramError);
nameToErrorMap.set('MissingSplAtaProgram', CmMissingSplAtaProgramError);

/** InvalidAccountVersion: Invalid account version */
export class CmInvalidAccountVersionError extends ProgramError {
  readonly name: string = 'InvalidAccountVersion';

  readonly code: number = 0x178d; // 6029

  constructor(program: Program, cause?: Error) {
    super('Invalid account version', program, cause);
  }
}
codeToErrorMap.set(0x178d, CmInvalidAccountVersionError);
nameToErrorMap.set('InvalidAccountVersion', CmInvalidAccountVersionError);

/** NotPrimarySale: Not a primary sale asset */
export class CmNotPrimarySaleError extends ProgramError {
  readonly name: string = 'NotPrimarySale';

  readonly code: number = 0x178e; // 6030

  constructor(program: Program, cause?: Error) {
    super('Not a primary sale asset', program, cause);
  }
}
codeToErrorMap.set(0x178e, CmNotPrimarySaleError);
nameToErrorMap.set('NotPrimarySale', CmNotPrimarySaleError);

/** InvalidEditionAccount: Invalid edition account */
export class CmInvalidEditionAccountError extends ProgramError {
  readonly name: string = 'InvalidEditionAccount';

  readonly code: number = 0x178f; // 6031

  constructor(program: Program, cause?: Error) {
    super('Invalid edition account', program, cause);
  }
}
codeToErrorMap.set(0x178f, CmInvalidEditionAccountError);
nameToErrorMap.set('InvalidEditionAccount', CmInvalidEditionAccountError);

/** InvalidMasterEditionSupply: Invalid master edition supply */
export class CmInvalidMasterEditionSupplyError extends ProgramError {
  readonly name: string = 'InvalidMasterEditionSupply';

  readonly code: number = 0x1790; // 6032

  constructor(program: Program, cause?: Error) {
    super('Invalid master edition supply', program, cause);
  }
}
codeToErrorMap.set(0x1790, CmInvalidMasterEditionSupplyError);
nameToErrorMap.set(
  'InvalidMasterEditionSupply',
  CmInvalidMasterEditionSupplyError
);

/** PublicKeyMismatch: Public key mismatch */
export class CmPublicKeyMismatchError extends ProgramError {
  readonly name: string = 'PublicKeyMismatch';

  readonly code: number = 0x1791; // 6033

  constructor(program: Program, cause?: Error) {
    super('Public key mismatch', program, cause);
  }
}
codeToErrorMap.set(0x1791, CmPublicKeyMismatchError);
nameToErrorMap.set('PublicKeyMismatch', CmPublicKeyMismatchError);

/** InvalidCollection: Invalid collection */
export class CmInvalidCollectionError extends ProgramError {
  readonly name: string = 'InvalidCollection';

  readonly code: number = 0x1792; // 6034

  constructor(program: Program, cause?: Error) {
    super('Invalid collection', program, cause);
  }
}
codeToErrorMap.set(0x1792, CmInvalidCollectionError);
nameToErrorMap.set('InvalidCollection', CmInvalidCollectionError);

/** GumballMachineDetailsFinalized: Gumball machine detailed finalized */
export class CmGumballMachineDetailsFinalizedError extends ProgramError {
  readonly name: string = 'GumballMachineDetailsFinalized';

  readonly code: number = 0x1793; // 6035

  constructor(program: Program, cause?: Error) {
    super('Gumball machine detailed finalized', program, cause);
  }
}
codeToErrorMap.set(0x1793, CmGumballMachineDetailsFinalizedError);
nameToErrorMap.set(
  'GumballMachineDetailsFinalized',
  CmGumballMachineDetailsFinalizedError
);

/** InvalidState: Invalid state */
export class CmInvalidStateError extends ProgramError {
  readonly name: string = 'InvalidState';

  readonly code: number = 0x1794; // 6036

  constructor(program: Program, cause?: Error) {
    super('Invalid state', program, cause);
  }
}
codeToErrorMap.set(0x1794, CmInvalidStateError);
nameToErrorMap.set('InvalidState', CmInvalidStateError);

/** InvalidAuthority: Invalid authority */
export class CmInvalidAuthorityError extends ProgramError {
  readonly name: string = 'InvalidAuthority';

  readonly code: number = 0x1795; // 6037

  constructor(program: Program, cause?: Error) {
    super('Invalid authority', program, cause);
  }
}
codeToErrorMap.set(0x1795, CmInvalidAuthorityError);
nameToErrorMap.set('InvalidAuthority', CmInvalidAuthorityError);

/** InvalidMint: Invalid mint */
export class CmInvalidMintError extends ProgramError {
  readonly name: string = 'InvalidMint';

  readonly code: number = 0x1796; // 6038

  constructor(program: Program, cause?: Error) {
    super('Invalid mint', program, cause);
  }
}
codeToErrorMap.set(0x1796, CmInvalidMintError);
nameToErrorMap.set('InvalidMint', CmInvalidMintError);

/** InvalidPaymentMint: Invalid payment mint */
export class CmInvalidPaymentMintError extends ProgramError {
  readonly name: string = 'InvalidPaymentMint';

  readonly code: number = 0x1797; // 6039

  constructor(program: Program, cause?: Error) {
    super('Invalid payment mint', program, cause);
  }
}
codeToErrorMap.set(0x1797, CmInvalidPaymentMintError);
nameToErrorMap.set('InvalidPaymentMint', CmInvalidPaymentMintError);

/** InvalidSeller: Invalid seller */
export class CmInvalidSellerError extends ProgramError {
  readonly name: string = 'InvalidSeller';

  readonly code: number = 0x1798; // 6040

  constructor(program: Program, cause?: Error) {
    super('Invalid seller', program, cause);
  }
}
codeToErrorMap.set(0x1798, CmInvalidSellerError);
nameToErrorMap.set('InvalidSeller', CmInvalidSellerError);

/** InvalidBuyer: Invalid buyer */
export class CmInvalidBuyerError extends ProgramError {
  readonly name: string = 'InvalidBuyer';

  readonly code: number = 0x1799; // 6041

  constructor(program: Program, cause?: Error) {
    super('Invalid buyer', program, cause);
  }
}
codeToErrorMap.set(0x1799, CmInvalidBuyerError);
nameToErrorMap.set('InvalidBuyer', CmInvalidBuyerError);

/** UriTooLong: URI too long */
export class CmUriTooLongError extends ProgramError {
  readonly name: string = 'UriTooLong';

  readonly code: number = 0x179a; // 6042

  constructor(program: Program, cause?: Error) {
    super('URI too long', program, cause);
  }
}
codeToErrorMap.set(0x179a, CmUriTooLongError);
nameToErrorMap.set('UriTooLong', CmUriTooLongError);

/** InvalidProofPath: Invalid proof path */
export class CmInvalidProofPathError extends ProgramError {
  readonly name: string = 'InvalidProofPath';

  readonly code: number = 0x179b; // 6043

  constructor(program: Program, cause?: Error) {
    super('Invalid proof path', program, cause);
  }
}
codeToErrorMap.set(0x179b, CmInvalidProofPathError);
nameToErrorMap.set('InvalidProofPath', CmInvalidProofPathError);

/** InvalidSettingUpdate: Invalid setting update */
export class CmInvalidSettingUpdateError extends ProgramError {
  readonly name: string = 'InvalidSettingUpdate';

  readonly code: number = 0x179c; // 6044

  constructor(program: Program, cause?: Error) {
    super('Invalid setting update', program, cause);
  }
}
codeToErrorMap.set(0x179c, CmInvalidSettingUpdateError);
nameToErrorMap.set('InvalidSettingUpdate', CmInvalidSettingUpdateError);

/** SellerTooManyItems: Seller has too many items */
export class CmSellerTooManyItemsError extends ProgramError {
  readonly name: string = 'SellerTooManyItems';

  readonly code: number = 0x179d; // 6045

  constructor(program: Program, cause?: Error) {
    super('Seller has too many items', program, cause);
  }
}
codeToErrorMap.set(0x179d, CmSellerTooManyItemsError);
nameToErrorMap.set('SellerTooManyItems', CmSellerTooManyItemsError);

/** NotAllSettled: Not all items have been settled */
export class CmNotAllSettledError extends ProgramError {
  readonly name: string = 'NotAllSettled';

  readonly code: number = 0x179e; // 6046

  constructor(program: Program, cause?: Error) {
    super('Not all items have been settled', program, cause);
  }
}
codeToErrorMap.set(0x179e, CmNotAllSettledError);
nameToErrorMap.set('NotAllSettled', CmNotAllSettledError);

/**
 * Attempts to resolve a custom program error from the provided error code.
 * @category Errors
 */
export function getMplCandyMachineErrorFromCode(
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
export function getMplCandyMachineErrorFromName(
  name: string,
  program: Program,
  cause?: Error
): ProgramError | null {
  const constructor = nameToErrorMap.get(name);
  return constructor ? new constructor(program, cause) : null;
}
