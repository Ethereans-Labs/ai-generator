# Multiverse by Ethereans Labs

## Installation & Initialization
use `yarn`

initialization should be automatic once you install dependency

But, if any trouble occurs, it is always possible to run

```shell
npx multiverse init
```

## Commands

### Run procedures within in the optional `.env` file
```shell
npx multiverse
```

### Compile all Smart Contracts within the `contracts` project folder and put data in a freshly-created `build` folder
```shell
npx multiverse compile
```

### On-the fly compilation of a Smart Contract
```shell
npx multiverse compile <solidity_file_path.sol> <smart_contract_name_within_the_solidity_file> <solidity_version_to_use_for_compilation>
```

### Generate a flatted version of all Smart Contracts the `contracts` project folder and put data in a freshly-created `flat` folder
```shell
npx multiverse flat
```

## `.env` file parameters

### BLOCKCHAIN_CONNECTION_STRING
optional, the Ethereum node URL to fork

### HARDFORK
optional, the EVM hardfork codename (e.g. berlin, london, etc)

### FORK_BLOCK_NUMBER
optional, specify a fork block number

### BLOCKS_TO_JUMP
optional, specify how many empty blocks to create at start

### BLOCKCHAIN_CONNECTION_FOR_LOGS_STRING
optional, fill with an alternative Ethereum node URL to query for eth_getLogs

### BLOCKCHAIN_SERVER_PORT
optional, specify a server port to be used for the forked node

### BYPASS_GAS_PRICE
optional, true will bypass mainnet gas price check

### PRODUCTION
optional, true will not fork and real network will be used

### SECONDS_TO_WAIT
optional, if `PRODUCTION` is `true`, this is the number of seconds the environment will wait before to start all procedures. Default is 7

### SIMULATE
optional, true means that transactions need private keys also in forked network

### TRANSACTION_HASHES_TO_DUMP
optional, comma-separated transaction hashes to be debugged and dumped

### ENVIRONMENT
optional, can be traditional (default) or optimism

### PROCEDURES
optional, comma-separated paths containing the procedures to run and test

### PRIVATE_KEY
optional, comma-separated private keys for accounts to add in the knowledgeBase

### ACCOUNTS
optional, comma-separated accounts to unlock and fill

### BLOCKCHAIN_CONNECTION_STRING_L2
if ENVIRONMENT is optimism, all previous configuration keys must be used to specify Optimism configuration by appending _L2 to the key name