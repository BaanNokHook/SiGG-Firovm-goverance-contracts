const QtumGov = artifacts.require("QtumGov");
const MobileValidator = artifacts.require("MobileValidator");
const POAGovernance = artifacts.require("POAGovernance");

const ADMIN_ADDRESSES = ["0x346f0bbbc6b4ffedf2e7f18d7ba5265748663c17"];

const GOV_ADDRESSES = ["0x346f0bbbc6b4ffedf2e7f18d7ba5265748663c17"];

module.exports = async (deployer) => {
  await deployer.deploy(QtumGov, ADMIN_ADDRESSES, GOV_ADDRESSES);
  const qtumGov = await QtumGov.deployed();

  await deployer.deploy(MobileValidator, qtumGov.address);
  const mobileValidator = await MobileValidator.deployed();

  await deployer.deploy(POAGovernance, qtumGov.address);
  const poaGovernance = await POAGovernance.deployed();

  console.log("QtumGov deployed to:", qtumGov.address);
  console.log("MobileValidator deployed to:", mobileValidator.address);
  console.log("POAGovernance deployed to:", poaGovernance.address);
};
