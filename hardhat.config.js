require('dotenv').config()
require("@nomiclabs/hardhat-waffle");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

module.exports = {
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
      timeout: 1000000,
    },
    hardhat: {
      forking: {
        url: 'https://eth-mainnet.alchemyapi.io/v2/' + process.env.ALCHEMY_API_KEY,
        blockNumber: 12904065
      }
    },
    coverage: {
      url: 'http://localhost:8555',
    },
    ganache: {
      url: 'http://127.0.0.1:7545',
      },
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/' + process.env.INFURA_API_KEY,
      accounts: {
        mnemonic: process.env.MNEMONIC || '',
      },
      timeout: 1000000,
    },
    mainnet: {
      url: 'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
      gasPrice: 72e9,
      accounts: {
        mnemonic: process.env.MNEMONIC || '',
      },
      timeout: 1000000,
    },
  },
  solidity: {
    version: '0.8.0',
  },
  mocha: {
    timeout: 1000000,
  },
  paths: {
    artifacts: './build',
  },
}