import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface CanisterDefaultSettings {
  'durationInDays' : bigint,
  'freezingThreshold' : [] | [bigint],
  'memoryGB' : bigint,
  'computeAllocation' : bigint,
  'cyclesAmount' : bigint,
}
export interface PaymentRecord {
  'creditsGranted' : bigint,
  'status' : PaymentStatus,
  'tbCyclesRequested' : number,
  'icpSpent' : bigint,
  'userPrincipal' : Principal,
  'timestamp' : bigint,
  'amountUSD' : number,
  'paymentIntentId' : string,
}
export type PaymentStatus = { 'pending' : null } |
  { 'completed' : null } |
  { 'refunded' : null } |
  { 'failed' : null };
export type Result = { 'ok' : PaymentRecord } |
  { 'err' : string };
export type Result_1 = {
    'ok' : { 'receivedChunks' : bigint, 'totalChunks' : bigint }
  } |
  { 'err' : string };
export type Result_2 = { 'ok' : string } |
  { 'err' : string };
export type Result_3 = { 'ok' : Array<PaymentRecord> } |
  { 'err' : string };
export interface Transaction {
  'transactionType' : TransactionType,
  'isPositive' : boolean,
  'memo' : [] | [string],
  'counterparty' : string,
  'timestamp' : bigint,
  'amount' : bigint,
}
export type TransactionType = { 'sent' : null } |
  { 'canister' : null } |
  { 'received' : null };
export interface _SERVICE {
  'clearAllLogs' : ActorMethod<[], bigint>,
  'createCanisterWithSettings' : ActorMethod<
    [Principal, bigint, bigint, [] | [bigint], bigint, bigint],
    Result_2
  >,
  'createPlatformWallet' : ActorMethod<[], string>,
  'deleteCanister' : ActorMethod<[Principal], Result_2>,
  'deployStoredWasm' : ActorMethod<[string, Principal, Principal], Result_2>,
  'deployToExistingCanister' : ActorMethod<
    [Principal, Uint8Array | number[]],
    Result_2
  >,
  'finalizeWasmUpload' : ActorMethod<[string], Result_2>,
  'getAdminPrincipal' : ActorMethod<[], Result_2>,
  'getCallerPrincipal' : ActorMethod<[], string>,
  'getLogs' : ActorMethod<[], Array<string>>,
  'getNewLogsSince' : ActorMethod<
    [bigint, [] | [bigint]],
    { 'logs' : Array<string>, 'nextMarker' : bigint }
  >,
  'getPaymentHistory' : ActorMethod<[[] | [Principal]], Result_3>,
  'getPlatformBalance' : ActorMethod<[], bigint>,
  'getPlatformCycleBalance' : ActorMethod<[], bigint>,
  'getPlatformTransactions' : ActorMethod<[[] | [bigint]], Array<Transaction>>,
  'getPlatformWalletId' : ActorMethod<
    [],
    [] | [
      {
        'principal' : string,
        'subaccount' : string,
        'accountIdentifier' : string,
      }
    ]
  >,
  'getPricingInfo' : ActorMethod<
    [],
    {
      'maxAmountUSD' : number,
      'description' : string,
      'creditsPerUSD' : bigint,
      'minAmountUSD' : number,
    }
  >,
  'getStripePublishableKey' : ActorMethod<[], string>,
  'getStripeSecretKey' : ActorMethod<[], Result_2>,
  'getUserPlatformCanister' : ActorMethod<[Principal], Array<Principal>>,
  'isAdmin' : ActorMethod<[], boolean>,
  'logDebug' : ActorMethod<[string], undefined>,
  'logError' : ActorMethod<[string], undefined>,
  'logInfo' : ActorMethod<[string], undefined>,
  'logWarn' : ActorMethod<[string], undefined>,
  'recordPaymentAndCreditUser' : ActorMethod<
    [string, number, Principal],
    Result_2
  >,
  'recordPaymentWithCalculatedICP' : ActorMethod<
    [string, number, Principal, bigint, number, bigint],
    Result_2
  >,
  'removeUserPlatformCanister' : ActorMethod<[Principal], Result_2>,
  'sendICPFromPlatform' : ActorMethod<[Principal, bigint], Result_2>,
  'sendICPFromPlatformToAccountId' : ActorMethod<[string, bigint], Result_2>,
  'startWasmUploadSession' : ActorMethod<[string, bigint, bigint], Result_2>,
  'topUpCanisterCMC' : ActorMethod<[Principal, bigint], Result_2>,
  'topUpUserCanisterFromPlatform' : ActorMethod<[Principal, number], Result_2>,
  'topUpUserCanisterWithExactICP' : ActorMethod<[Principal, bigint], Result_2>,
  'updateAdminPrincipal' : ActorMethod<[string], Result_2>,
  'updateCanisterDefaults' : ActorMethod<[CanisterDefaultSettings], Result_2>,
  'updateStripeKeys' : ActorMethod<[string, string], Result_2>,
  'uploadWasmChunk' : ActorMethod<
    [string, bigint, Uint8Array | number[]],
    Result_1
  >,
  'verifyPayment' : ActorMethod<[string], Result>,
  'wallet_receive' : ActorMethod<[], { 'accepted' : bigint }>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
