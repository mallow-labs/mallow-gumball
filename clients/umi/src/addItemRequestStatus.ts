/** Decode the appended status without a second RPC read. Legacy requests are pending. */
export function getAddItemRequestStatus(
  data: ArrayLike<number>
): 'pending' | 'rejected' {
  return data[106] === 2 ? 'rejected' : 'pending';
}
