/**
 * server/veritas/flows/index.ts
 *
 * Flow registry. The market flow is implemented (it asserts the trustless resolver).
 * The chain flows are registered as pending stubs — they need the testnet wallet
 * manager (funded test ALGO) before they can walk land/commander/token/trade. Adding a
 * flow is: implement a FlowRunner and list it here.
 */

import type { FlowRunner } from "../types.js";
import { skip } from "../assert.js";
import { marketFlow } from "./market.js";
import { tokenFlow } from "./token.js";

function pending(name: string): FlowRunner {
  return {
    name,
    run: async () => [skip(`${name} flow`, "not yet implemented — needs purchase/auth choreography on top of the wallet manager")],
  };
}

/** All registered flows, in run order. */
export const FLOWS: FlowRunner[] = [
  pending("land"),
  pending("commander"),
  tokenFlow,
  pending("trade"),
  marketFlow,
];
