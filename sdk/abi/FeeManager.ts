export const feeManagerAbi = [
  {
    inputs: [
      { internalType: "uint16", name: "_coverage", type: "uint16" },
      { internalType: "uint16", name: "_claim", type: "uint16" },
      { internalType: "address", name: "_owner", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  { inputs: [], name: "EscrowFeeManager__FeeTooHigh", type: "error" },
  { inputs: [], name: "EscrowFeeManager__UnsupportedFeeConfiguration", type: "error" },
  { inputs: [], name: "EscrowFeeManager__ZeroAddressProvided", type: "error" },
  { inputs: [], name: "NewOwnerIsZeroAddress", type: "error" },
  { inputs: [], name: "Unauthorized", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint256", name: "coverage", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "claim", type: "uint256" },
    ],
    name: "DefaultFeesSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "oldOwner", type: "address" },
      { indexed: true, internalType: "address", name: "newOwner", type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "coverage", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "claim", type: "uint256" },
    ],
    name: "SpecialFeesSet",
    type: "event",
  },
  {
    inputs: [],
    name: "MAX_BPS",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_contractor", type: "address" },
      { internalType: "uint256", name: "_claimedAmount", type: "uint256" },
      { internalType: "enum Enums.FeeConfig", name: "_feeConfig", type: "uint8" },
    ],
    name: "computeClaimableAmountAndFee",
    outputs: [
      { internalType: "uint256", name: "claimableAmount", type: "uint256" },
      { internalType: "uint256", name: "feeDeducted", type: "uint256" },
      { internalType: "uint256", name: "clientFee", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_client", type: "address" },
      { internalType: "uint256", name: "_depositAmount", type: "uint256" },
      { internalType: "enum Enums.FeeConfig", name: "_feeConfig", type: "uint8" },
    ],
    name: "computeDepositAmountAndFee",
    outputs: [
      { internalType: "uint256", name: "totalDepositAmount", type: "uint256" },
      { internalType: "uint256", name: "feeApplied", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "defaultFees",
    outputs: [
      { internalType: "uint16", name: "coverage", type: "uint16" },
      { internalType: "uint16", name: "claim", type: "uint16" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_user", type: "address" }],
    name: "getClaimFee",
    outputs: [{ internalType: "uint16", name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_user", type: "address" }],
    name: "getCoverageFee",
    outputs: [{ internalType: "uint16", name: "", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "result", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_user", type: "address" },
      { internalType: "uint16", name: "_coverage", type: "uint16" },
      { internalType: "uint16", name: "_claim", type: "uint16" },
    ],
    name: "setSpecialFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "specialFees",
    outputs: [
      { internalType: "uint16", name: "coverage", type: "uint16" },
      { internalType: "uint16", name: "claim", type: "uint16" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint16", name: "_coverage", type: "uint16" },
      { internalType: "uint16", name: "_claim", type: "uint16" },
    ],
    name: "updateDefaultFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
