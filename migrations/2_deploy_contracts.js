const FeeReceiver = artifacts.require("FeeReceiver");

// Change the arguements prior to deployment
module.exports = function (deployer) {
  deployer.deploy(FeeReceiver, 
    "0x6b175474e89094c44da98b954eedeac495271d0f", 
    "0x6b175474e89094c44da98b954eedeac495271d0f",
    "0x6b175474e89094c44da98b954eedeac495271d0f", 
    1, 
    ["0x6b175474e89094c44da98b954eedeac495271d0f"], 
    [10]);
};