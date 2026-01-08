export const idlFactory = ({ IDL }) => {
  const Result_2 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const PaymentStatus = IDL.Variant({
    'pending' : IDL.Null,
    'completed' : IDL.Null,
    'refunded' : IDL.Null,
    'failed' : IDL.Null,
  });
  const PaymentRecord = IDL.Record({
    'creditsGranted' : IDL.Nat,
    'status' : PaymentStatus,
    'tbCyclesRequested' : IDL.Float64,
    'icpSpent' : IDL.Nat,
    'userPrincipal' : IDL.Principal,
    'timestamp' : IDL.Int,
    'amountUSD' : IDL.Float64,
    'paymentIntentId' : IDL.Text,
  });
  const Result_3 = IDL.Variant({
    'ok' : IDL.Vec(PaymentRecord),
    'err' : IDL.Text,
  });
  const TransactionType = IDL.Variant({
    'sent' : IDL.Null,
    'canister' : IDL.Null,
    'received' : IDL.Null,
  });
  const Transaction = IDL.Record({
    'transactionType' : TransactionType,
    'isPositive' : IDL.Bool,
    'memo' : IDL.Opt(IDL.Text),
    'counterparty' : IDL.Text,
    'timestamp' : IDL.Int,
    'amount' : IDL.Nat,
  });
  const CanisterDefaultSettings = IDL.Record({
    'durationInDays' : IDL.Nat,
    'freezingThreshold' : IDL.Opt(IDL.Nat),
    'memoryGB' : IDL.Nat,
    'computeAllocation' : IDL.Nat,
    'cyclesAmount' : IDL.Nat,
  });
  const Result_1 = IDL.Variant({
    'ok' : IDL.Record({ 'receivedChunks' : IDL.Nat, 'totalChunks' : IDL.Nat }),
    'err' : IDL.Text,
  });
  const Result = IDL.Variant({ 'ok' : PaymentRecord, 'err' : IDL.Text });
  return IDL.Service({
    'clearAllLogs' : IDL.Func([], [IDL.Nat], []),
    'createCanisterWithSettings' : IDL.Func(
        [IDL.Principal, IDL.Nat, IDL.Nat, IDL.Opt(IDL.Nat), IDL.Nat, IDL.Nat],
        [Result_2],
        [],
      ),
    'createPlatformWallet' : IDL.Func([], [IDL.Text], []),
    'deleteCanister' : IDL.Func([IDL.Principal], [Result_2], []),
    'deployStoredWasm' : IDL.Func(
        [IDL.Text, IDL.Principal, IDL.Principal],
        [Result_2],
        [],
      ),
    'deployToExistingCanister' : IDL.Func(
        [IDL.Principal, IDL.Vec(IDL.Nat8)],
        [Result_2],
        [],
      ),
    'finalizeWasmUpload' : IDL.Func([IDL.Text], [Result_2], []),
    'getAdminPrincipal' : IDL.Func([], [Result_2], []),
    'getCallerPrincipal' : IDL.Func([], [IDL.Text], []),
    'getLogs' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'getNewLogsSince' : IDL.Func(
        [IDL.Nat, IDL.Opt(IDL.Nat)],
        [IDL.Record({ 'logs' : IDL.Vec(IDL.Text), 'nextMarker' : IDL.Nat })],
        ['query'],
      ),
    'getPaymentHistory' : IDL.Func([IDL.Opt(IDL.Principal)], [Result_3], []),
    'getPlatformBalance' : IDL.Func([], [IDL.Nat], []),
    'getPlatformCycleBalance' : IDL.Func([], [IDL.Nat], []),
    'getPlatformTransactions' : IDL.Func(
        [IDL.Opt(IDL.Nat)],
        [IDL.Vec(Transaction)],
        ['query'],
      ),
    'getPlatformWalletId' : IDL.Func(
        [],
        [
          IDL.Opt(
            IDL.Record({
              'principal' : IDL.Text,
              'subaccount' : IDL.Text,
              'accountIdentifier' : IDL.Text,
            })
          ),
        ],
        ['query'],
      ),
    'getPricingInfo' : IDL.Func(
        [],
        [
          IDL.Record({
            'maxAmountUSD' : IDL.Float64,
            'description' : IDL.Text,
            'creditsPerUSD' : IDL.Nat,
            'minAmountUSD' : IDL.Float64,
          }),
        ],
        ['query'],
      ),
    'getStripePublishableKey' : IDL.Func([], [IDL.Text], ['query']),
    'getStripeSecretKey' : IDL.Func([], [Result_2], []),
    'getUserPlatformCanister' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Principal)],
        [],
      ),
    'isAdmin' : IDL.Func([], [IDL.Bool], []),
    'logDebug' : IDL.Func([IDL.Text], [], []),
    'logError' : IDL.Func([IDL.Text], [], []),
    'logInfo' : IDL.Func([IDL.Text], [], []),
    'logWarn' : IDL.Func([IDL.Text], [], []),
    'recordPaymentAndCreditUser' : IDL.Func(
        [IDL.Text, IDL.Float64, IDL.Principal],
        [Result_2],
        [],
      ),
    'recordPaymentWithCalculatedICP' : IDL.Func(
        [IDL.Text, IDL.Float64, IDL.Principal, IDL.Nat, IDL.Float64, IDL.Nat],
        [Result_2],
        [],
      ),
    'removeUserPlatformCanister' : IDL.Func([IDL.Principal], [Result_2], []),
    'sendICPFromPlatform' : IDL.Func([IDL.Principal, IDL.Nat], [Result_2], []),
    'sendICPFromPlatformToAccountId' : IDL.Func(
        [IDL.Text, IDL.Nat],
        [Result_2],
        [],
      ),
    'startWasmUploadSession' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Nat],
        [Result_2],
        [],
      ),
    'topUpCanisterCMC' : IDL.Func([IDL.Principal, IDL.Nat], [Result_2], []),
    'topUpUserCanisterFromPlatform' : IDL.Func(
        [IDL.Principal, IDL.Float64],
        [Result_2],
        [],
      ),
    'topUpUserCanisterWithExactICP' : IDL.Func(
        [IDL.Principal, IDL.Nat],
        [Result_2],
        [],
      ),
    'updateAdminPrincipal' : IDL.Func([IDL.Text], [Result_2], []),
    'updateCanisterDefaults' : IDL.Func(
        [CanisterDefaultSettings],
        [Result_2],
        [],
      ),
    'updateStripeKeys' : IDL.Func([IDL.Text, IDL.Text], [Result_2], []),
    'uploadWasmChunk' : IDL.Func(
        [IDL.Text, IDL.Nat, IDL.Vec(IDL.Nat8)],
        [Result_1],
        [],
      ),
    'verifyPayment' : IDL.Func([IDL.Text], [Result], []),
    'wallet_receive' : IDL.Func(
        [],
        [IDL.Record({ 'accepted' : IDL.Nat64 })],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
