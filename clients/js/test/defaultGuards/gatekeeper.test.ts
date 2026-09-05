import test from 'ava';

/**
 * DEFERRED: there is NO umi source test for the gatekeeper guard
 * (`clients/umi/test/defaultGuards/gatekeeper.test.ts` does not exist), so there
 * is nothing to port 1:1. Additionally, exercising the gatekeeper guard requires
 * minting a Civic gateway token for the buyer, and no kit-compatible Civic
 * gateway client is available in this repo. Left as a placeholder until both a
 * source test and a kit gateway-token helper exist.
 */
test.todo(
  'gatekeeper: no umi source test to port + needs a Civic gateway-token helper'
);
