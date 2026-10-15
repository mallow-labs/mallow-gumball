import {
  BUY_BACK_CONFIG_SIZE,
  CONFIG_LINE_V2_SIZE,
  GUMBALL_MACHINE_SIZE,
} from '../constants';

export function getGumballMachineSizeForItemCount(
  itemCount: number | bigint,
  version = 6
): number {
  const items = Number(itemCount);

  return Math.ceil(
    GUMBALL_MACHINE_SIZE +
      // Number of currently items inserted.
      4 +
      // Config line data.
      items * CONFIG_LINE_V2_SIZE +
      // Bit mask to keep track of which items have been claimed.
      (4 + Math.floor(items / 8) + 1) +
      // Bit mask to keep track of which items have been settled.
      (4 + Math.floor(items / 8) + 1) +
      // Mint indices.
      (4 + items * 4) +
      4 + // Unused
      1 + // disablePrimarySplit
      BUY_BACK_CONFIG_SIZE +
      8 + // buyBackFundsAvailable
      8 + // totalProceedsSettled
      (version >= 6 ? 40 + items * 16 : 0) // draw payments, refund reserve and per-item settlement ledger
  );
}
