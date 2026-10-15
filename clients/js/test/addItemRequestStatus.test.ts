import test from 'ava';
import { getAddItemRequestStatus } from '../src';

test('R9-08: request status distinguishes legacy pending, counted pending and rejected', (t) => {
  const legacy = new Uint8Array(105);
  t.is(getAddItemRequestStatus(legacy), 'pending');
  const request = new Uint8Array(107);
  request[106] = 1;
  t.is(getAddItemRequestStatus(request), 'pending');
  request[106] = 2;
  t.is(getAddItemRequestStatus(request), 'rejected');
});
