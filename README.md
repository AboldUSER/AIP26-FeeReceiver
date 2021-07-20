Fee Reciever Contract built for AirSwap AIP-26

A smart contract developed to receive protocol fees in a variety of tokens. Each token in a fee pool can be converted by calling a function on the contract, which swaps the balance for (stable)coin using an on-chain AMM. Once swapped, the (stable)coin will be transferred to the rewards pool contract(s).