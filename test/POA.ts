import { BigNumberish, Contract, Signer } from "ethers";
import { ethers } from "hardhat";
import deepEqualInAnyOrder from "deep-equal-in-any-order";

import chai from "chai";
chai.use(deepEqualInAnyOrder);
const { expect } = chai;

describe("Governance for managing miners", function () {
  let governanceContract: Contract, qtumGov: Contract;
  let adminAddresses: string | any[], govAddresses: string | any[];
  let proposerAddress: Signer,
    proposerAddress2: Signer,
    adminAddress1: Signer,
    adminAddress2: Signer,
    adminAddress3: Signer,
    adminAddress4: Signer,
    nonAdminAddress1: Signer;

  let pID = 0;
  let pID2 = 0;

  const minerAddress = "0xa4E9a3Bc17D73206dEe6262Db13AED86966Ed2c2";
  const utxos = [
    {
      index: 0,
      txId: "0x34ea60691bba863dfd16754861c79400aaf0a67072ee0bef130f4d7084139536",
    },
    {
      index: 0,
      txId: "0xb4e02566779d510d3b9b376e04ddbf347b387e2d03c5a6e375d0b84eb016f564",
    },
  ];

  const minerAddress2 = "0x5e00A28B8E1B4eD59b480D46fe2ec9d2aFCA8015";
  const utxos2 = [
    {
      index: 0,
      txId: "0xf29c2e72755d6a6845c22ed419ddda9bbf91876db33812a3577dbe5da9a99454",
    },
    {
      index: 0,
      txId: "0x4205e6e9b7ddac6b7bdfb5e7ade80ae2cc9a92d3a17830fc8906357372635f9d",
    },
  ];
  beforeEach(async () => {
    const exampleAddresses = await ethers.getSigners();
    const adminAddressSigners = exampleAddresses.slice(0, 6);
    adminAddresses = adminAddressSigners.map((entry) => entry.address);
    govAddresses = exampleAddresses.slice(6, 8).map((entry) => entry.address);
    const QtumGov = await ethers.getContractFactory("QtumGov");
    qtumGov = await QtumGov.deploy(adminAddresses, govAddresses);

    const MobileValidator = await ethers.getContractFactory("MobileValidator");
    const mobileValidator = await MobileValidator.deploy(qtumGov.address, {
      gasLimit: 5000000,
    });
    const POAGov = await ethers.getContractFactory("POAGovernance");
    governanceContract = await POAGov.deploy(qtumGov.address);

    await qtumGov.setContracts(
      mobileValidator.address,
      governanceContract.address
    );

    proposerAddress = adminAddressSigners[0];
    adminAddress1 = adminAddressSigners[1];
    adminAddress2 = adminAddressSigners[2];
    adminAddress3 = adminAddressSigners[3];
    adminAddress4 = adminAddressSigners[4];
    nonAdminAddress1 = exampleAddresses[13];
    proposerAddress2 = exampleAddresses[5];
  });

  it("Should ensure the admin and gov addresses exist in the right number", async function () {
    // await admins.deployed();
    const addressesFromAdmin = await qtumGov.getAddressesList(0);
    const addressesFromGov = await qtumGov.getAddressesList(1);

    expect(addressesFromAdmin.length).to.equal(adminAddresses.length);
    expect(addressesFromGov.length).to.equal(govAddresses.length);
  });

  it("Should load admin and gov addresses in the governance contract", async () => {
    for (let index = 0; index < adminAddresses.length; index++) {
      // eslint-disable-next-line no-unused-expressions
      expect(
        await governanceContract.isGovAndAdminAddress(adminAddresses[index])
      ).to.be.true;
    }
    for (let index = 0; index < govAddresses.length; index++) {
      // eslint-disable-next-line no-unused-expressions
      expect(await governanceContract.isGovAndAdminAddress(govAddresses[index]))
        .to.be.true;
    }
  });

  it("Should set default min utxos to 3", async function () {
    expect(await governanceContract.minUTXOs()).to.equal(3);
  });

  it("Should update default min if admin", async function () {
    const tx = await governanceContract.updateMinUTXOs(5);
    await tx.wait();
    expect(await governanceContract.minUTXOs()).to.equal(5);
  });

  it("Should not update default min if not admin", async function () {
    await expect(governanceContract.connect(nonAdminAddress1).updateMinUTXOs(5))
      .to.be.reverted;
    expect(await governanceContract.minUTXOs()).to.equal(3);
  });

  it("Should set default status to disabled", async function () {
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
    expect(await governanceContract.minUTXOs()).to.equal(3);
  });

  it("Should query status even if non admin", async function () {
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.connect(nonAdminAddress1).enabled()).to.be
      .false;
  });

  it("Should not update with the same number", async function () {
    await expect(governanceContract.updateMinUTXOs(3)).to.be.reverted;
  });

  async function getProposalID(
    address: any,
    minerAddressToAdd: string,
    utxosToAdd: { index: BigNumberish; txId: string }[]
  ) {
    let pIDCreated = 0;
    // governanceContract.connect(address);
    const proposalIDTX = await governanceContract
      .connect(address)
      .proposeMiner(minerAddressToAdd, utxosToAdd, true);
    const res = await proposalIDTX.wait();

    const events = res.events;

    events?.forEach((i: { args: any[] }) => {
      i.args?.forEach((j: number) => {
        pIDCreated = j;
      });
    });
    return pIDCreated;
  }

  async function createNewMiner(
    utxosToBeAdded: { index: BigNumberish; txId: string }[]
  ) {
    pID = await getProposalID(proposerAddress, minerAddress, utxosToBeAdded);
    let tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress1).endVotingPeriod(pID);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress1).executeVote(pID);
    await tx.wait();
  }

  it("Should propose new miner", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    const proposal = await governanceContract.getMinerProposalDetails(pID);

    expect(proposal.minerAddress).to.equal(minerAddress);
    expect(proposal.proposer).to.equal(await proposerAddress.getAddress());
  });

  it("Should not propose same miner and utxo", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    await governanceContract.getMinerProposalDetails(pID);
    await expect(getProposalID(proposerAddress, minerAddress, utxos)).to.be
      .reverted;
  });

  it("Should not be able to propose if not admin", async () => {
    await expect(getProposalID(nonAdminAddress1, minerAddress, utxos)).to.be
      .reverted;
  });

  it("Should be able to vote for/against/abstain", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);

    let tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();

    const proposal = await governanceContract.getMinerProposalDetails(pID);

    // console.log(proposal);

    expect(proposal.againstVotes).to.equal(1);
    expect(proposal.forVotes).to.equal(2);
    expect(proposal.abstainVotes).to.equal(1);
  });

  it("Should not be able to vote twice", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    const tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    await expect(governanceContract.connect(adminAddress1).vote(pID, 1)).to.be
      .reverted;
  });

  it("Should not be able to vote if proposal ID dont exist", async () => {
    await expect(
      governanceContract
        .connect(adminAddress1)
        .vote(ethers.BigNumber.from(ethers.utils.randomBytes(32)), 1)
    ).to.be.reverted;
  });

  it("Should not be able to vote if not admin", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    await expect(governanceContract.connect(nonAdminAddress1).vote(pID, 1)).to
      .be.reverted;
  });

  it("Should auto execute to add miner for majority for vote", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    let tx = await governanceContract.connect(adminAddress1).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 1);
    await tx.wait();
    await expect(governanceContract.connect(adminAddress3).vote(pID, 1)).to.be
      .reverted;

    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
  });

  it("Should auto execute to add miner for majority against vote", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    let tx = await governanceContract.connect(adminAddress1).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 2);
    await tx.wait();
    await expect(governanceContract.connect(adminAddress3).vote(pID, 1)).to.be
      .reverted;

    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
  });

  it("Should not add already added miner", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);

    let tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 1);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    tx = await governanceContract.connect(adminAddress1).endVotingPeriod(pID);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress1).executeVote(pID);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    await expect(
      governanceContract
        .connect(adminAddress3)
        .proposeMiner(minerAddress, utxos, true)
    ).to.be.reverted;
  });

  it("Should voting proposal be successful for majority votes", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);

    let tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 1);
    await tx.wait();
    const proposalBeforeVerdict =
      await governanceContract.getMinerProposalDetails(pID);
    // console.log(proposalBeforeVerdict);
    /*
    Status:
    0 -> OnGoing
    1 -> Cancalled
    2 -> VerdictPending
    3 -> ProposalSucceded
    4 -> ProposalVotedOut
    */
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    expect(proposalBeforeVerdict.status).to.equal(0);
    tx = await governanceContract.connect(adminAddress1).endVotingPeriod(pID);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress1).executeVote(pID);
    await tx.wait();
    const proposalAfterVerdict =
      await governanceContract.getMinerProposalDetails(pID);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    expect(proposalAfterVerdict.status).to.equal(3);

    // console.log(proposalAfterVerdict);
  });

  it("Should voting proposal failed for less than majority votes", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);

    let tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 1);
    await tx.wait();
    const proposalBeforeVerdict =
      await governanceContract.getMinerProposalDetails(pID);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    expect(proposalBeforeVerdict.status).to.equal(0);
    tx = await governanceContract.connect(adminAddress1).endVotingPeriod(pID);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress1).executeVote(pID);
    await tx.wait();
    const proposalAfterVerdict =
      await governanceContract.getMinerProposalDetails(pID);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    expect(proposalAfterVerdict.status).to.equal(4);
  });

  it("Should not vote after voting period", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);

    const tx = await governanceContract.connect(adminAddress1).vote(pID, 1);
    await tx.wait();
    let proposal = await governanceContract.getMinerProposalDetails(pID);
    expect(proposal.forVotes).to.equal(2);
    const twoWeeksOver = 1209611;
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    await ethers.provider.send("evm_increaseTime", [twoWeeksOver]);
    await ethers.provider.send("evm_mine", []);

    const blockNumAfter = await ethers.provider.getBlockNumber();
    const blockAfter = await ethers.provider.getBlock(blockNumAfter);
    const timestampAfter = blockAfter.timestamp;
    console.log("Timestamp before", timestampBefore);
    console.log("Timestamp after", timestampAfter);

    await expect(governanceContract.connect(adminAddress3).vote(pID, 1)).to.be
      .reverted;
    proposal = await governanceContract.getMinerProposalDetails(pID);
    expect(proposal.forVotes).to.equal(2);
  });

  it("Should return all proposals", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    pID2 = await getProposalID(proposerAddress2, minerAddress2, utxos2);
    // console.log(pID);
    // console.log(pID2);

    const proposal = await governanceContract.getMinerProposalDetails(pID);
    const proposal2 = await governanceContract.getMinerProposalDetails(pID2);
    expect(proposal.minerAddress).to.equal(minerAddress);
    expect(proposal.proposer).to.equal(await proposerAddress.getAddress());
    expect(proposal2.minerAddress).to.equal(minerAddress2);
    expect(proposal2.proposer).to.equal(await proposerAddress2.getAddress());
  });

  it("Should update to enable if min utxos reduced from total utxos", async () => {
    await createNewMiner(utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
    const tx = await governanceContract.updateMinUTXOs(2);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.true;
  });

  it("Should update to disable if min utxos increased from total utxos", async () => {
    await createNewMiner(utxos);
    let tx = await governanceContract.updateMinUTXOs(2);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.true;
    tx = await governanceContract.updateMinUTXOs(5);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
  });

  it("Should update to disable if min utxos increased from total utxos", async () => {
    const tx = await governanceContract.updateMinUTXOs(2);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
    await createNewMiner(utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.true;
  });

  it("Should update to disable if total utxos reduced from min when removing address", async () => {
    await createNewMiner(utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
    let tx = await governanceContract.updateMinUTXOs(2);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.true;
    tx = await governanceContract
      .connect(adminAddress1)
      .removeAddress(minerAddress);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
  });

  it("Should update to disable if total utxos reduced from min when removing utxos", async () => {
    await createNewMiner(utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
    let tx = await governanceContract.updateMinUTXOs(2);
    await tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.true;
    tx = await governanceContract.connect(adminAddress1).removeUTXOs(utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.enabled()).to.be.false;
  });

  it("Should return valid utxos", async () => {
    await createNewMiner(utxos);
    const utxosFromSC = await governanceContract.getUTXOs(minerAddress);
    // console.log(utxos);
    const utxosObj = utxosFromSC.map((el: any[]) => ({
      index: el[0].toNumber(),
      txId: el[1],
    }));
    // console.log(utxosObj);

    expect(utxosObj).to.deep.equalInAnyOrder(utxos);
  });

  // it("Should reset voting start time", async () => {
  //   pID = await getProposalID(proposerAddress, minerAddress, utxos);
  //   let proposal = await governanceContract.getMinerProposalDetails(pID);
  //   const initialStartTime = proposal.startTime.toNumber();
  //   const tx = await governanceContract
  //     .connect(adminAddress1)
  //     .resetStartTime(pID);
  //   await tx.wait();
  //   await new Promise((resolve) => setTimeout(resolve, 2000));
  //   proposal = await governanceContract.getMinerProposalDetails(pID);
  //   expect(initialStartTime).to.be.lessThan(proposal.startTime.toNumber());
  // });

  it("Should remove miner address for admin", async () => {
    await createNewMiner(utxos);
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    await governanceContract.getUTXOs(minerAddress);

    const tx = await governanceContract
      .connect(adminAddress1)
      .removeAddress(minerAddress);

    tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.false;
    await expect(governanceContract.getUTXOs(minerAddress)).to.be.reverted;
  });

  it("Should not remove miner address for non admin", async () => {
    await createNewMiner(utxos);
    await expect(
      governanceContract.connect(nonAdminAddress1).removeAddress(minerAddress)
    ).to.be.reverted;
  });

  it("Should remove miner utxos for admin", async () => {
    await createNewMiner(utxos);

    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    const utxoFromSC = await governanceContract.getUTXOs(minerAddress);
    expect(utxoFromSC.length).to.equal(2);

    const tx = await governanceContract
      .connect(adminAddress1)
      .removeUTXOs(utxos);

    tx.wait();
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    const updatedUTXO = await governanceContract.getUTXOs(minerAddress);
    expect(updatedUTXO.length).to.equal(0);
  });

  it("Should not remove miner utxos for non admin", async () => {
    await createNewMiner(utxos);

    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    const utxoFromSC = await governanceContract.getUTXOs(minerAddress);
    expect(utxoFromSC.length).to.equal(2);
    await expect(
      governanceContract.connect(nonAdminAddress1).removeUTXOs(utxos)
    ).to.be.reverted;
  });

  it("Should query miner status", async () => {
    await createNewMiner(utxos);

    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.isMiner(minerAddress)).to.be.true;
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.usable(minerAddress, utxos[0])).to.be.true;
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.usable(minerAddress, utxos2[0])).to.be
      .false;
  });

  it("Should update utxo with address", async () => {
    await createNewMiner(utxos);
    let utxosFromSC = await governanceContract.getUTXOs(minerAddress);
    let utxosObj = utxosFromSC.map((el: any[]) => ({
      index: el[0].toNumber(),
      txId: el[1],
    }));
    expect(utxosObj).to.deep.equalInAnyOrder(utxos);
    await governanceContract.updateWithAddress(
      minerAddress,
      utxos[0],
      utxos2[0]
    );
    utxosFromSC = await governanceContract.getUTXOs(minerAddress);
    utxosObj = utxosFromSC.map((el: any[]) => ({
      index: el[0].toNumber(),
      txId: el[1],
    }));
    expect(utxosObj).to.deep.equalInAnyOrder([utxos2[0], utxos[1]]);
  });

  it("Should update utxo without address", async () => {
    await createNewMiner(utxos);
    let utxosFromSC = await governanceContract.getUTXOs(minerAddress);
    let utxosObj = utxosFromSC.map((el: any[]) => ({
      index: el[0].toNumber(),
      txId: el[1],
    }));
    expect(utxosObj).to.deep.equalInAnyOrder(utxos);
    await governanceContract.update(utxos[0], utxos2[0]);
    utxosFromSC = await governanceContract.getUTXOs(minerAddress);
    utxosObj = utxosFromSC.map((el: any[]) => ({
      index: el[0].toNumber(),
      txId: el[1],
    }));
    expect(utxosObj).to.deep.equalInAnyOrder([utxos2[0], utxos[1]]);
  });

  it("Should not update utxo with address for not admin", async () => {
    await createNewMiner(utxos);
    await expect(
      governanceContract
        .connect(nonAdminAddress1)
        .updateWithAddress(minerAddress, utxos[0], utxos2[0])
    ).to.be.reverted;
  });

  it("Should not update utxo without address for not admin", async () => {
    await createNewMiner(utxos);
    await expect(
      governanceContract.connect(nonAdminAddress1).update(utxos[0], utxos2[0])
    ).to.be.reverted;
  });

  it("Should check utxos are equal", async () => {
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.checkTwoUTXOEquality(utxos[0], utxos[0])).to
      .be.true;
    // eslint-disable-next-line no-unused-expressions
    expect(await governanceContract.checkTwoUTXOEquality(utxos[0], utxos[1])).to
      .be.false;
  });

  it("Should cancel proposal", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);

    let proposal = await governanceContract.getMinerProposalDetails(pID);
    expect(proposal.status).to.equal(0);
    const tx = await governanceContract.cancelVote(pID);
    tx.wait();
    proposal = await governanceContract.getMinerProposalDetails(pID);
    expect(proposal.status).to.equal(1);
  });

  it("Should not cancel proposal for non admin", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    const proposal = await governanceContract.getMinerProposalDetails(pID);
    expect(proposal.status).to.equal(0);
    await expect(governanceContract.connect(nonAdminAddress1).cancelVote(pID))
      .to.be.reverted;
  });

  it("Should delete proposal after verdict reached", async () => {
    await createNewMiner(utxos);
    await governanceContract.getMinerProposalDetails(pID);

    const tx = await governanceContract.deleteProposal(pID);
    tx.wait();
    await expect(governanceContract.getMinerProposalDetails(pID)).to.be
      .reverted;
  });

  it("Should not delete proposal before verdict reached", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    await expect(governanceContract.deleteProposal(pID)).to.be.reverted;
  });

  it("Should not delete proposal for verdict pending", async () => {
    pID = await getProposalID(proposerAddress, minerAddress, utxos);
    let tx = await governanceContract.connect(adminAddress1).vote(pID, 0);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress2).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress3).vote(pID, 2);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress4).vote(pID, 1);
    await tx.wait();
    tx = await governanceContract.connect(adminAddress1).endVotingPeriod(pID);
    await tx.wait();
    await expect(governanceContract.deleteProposal(pID)).to.be.reverted;
  });

  it("Should not delete proposal for non admin", async () => {
    await createNewMiner(utxos);
    await governanceContract.getMinerProposalDetails(pID);
    await expect(
      governanceContract.connect(nonAdminAddress1).deleteProposal(pID)
    ).to.be.reverted;
  });
});
