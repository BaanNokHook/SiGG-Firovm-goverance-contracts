import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { MobileValidator } from "../typechain-types";

describe("Mobile validator test suite", function () {
  async function deployFixture() {
    const exampleAddresses = await ethers.getSigners();
    const adminAddressesSigners = exampleAddresses.slice(0, 6);
    const adminAddresses = adminAddressesSigners.map((entry) => entry.address);
    const govAddressesSigner = exampleAddresses.slice(6, 7);
    const govAddresses = govAddressesSigner.map((entry) => entry.address);
    const otherAddressesSigner = exampleAddresses.slice(8, 11);
    const otherAddressesSet1 = otherAddressesSigner.map(
      (entry) => entry.address
    );
    const otherAddressesSet2 = exampleAddresses
      .slice(11, 12)
      .map((entry) => entry.address);
    const owner = exampleAddresses[0];
    const nonOwner = exampleAddresses[9];

    const QtumGov = await ethers.getContractFactory("QtumGov");
    const qtumGov = await QtumGov.deploy(adminAddresses, govAddresses);

    const MobileValidator = await ethers.getContractFactory("MobileValidator");
    const mobileValidator = await MobileValidator.deploy(qtumGov.address, {
      gasLimit: 5000000,
    });
    const POAGov = await ethers.getContractFactory("POAGovernance");
    const poaGov = await POAGov.deploy(qtumGov.address);
    await qtumGov.setContracts(mobileValidator.address, poaGov.address);

    return {
      owner,
      nonOwner,
      adminAddresses,
      adminAddressesSigners,
      govAddresses,
      govAddressesSigner,
      qtumGov,
      poaGov,
      mobileValidator,
      otherAddressesSet1,
      otherAddressesSigner,
      otherAddressesSet2,
    };
  }

  describe("Deployment test suite", function () {
    it("Should deploy", async function () {
      const { qtumGov, mobileValidator } = await loadFixture(deployFixture);

      expect(qtumGov.address).to.not.equal(null);
      expect(mobileValidator.address).to.not.equal(null);
    });

    it("Should add new admin address", async function () {
      const { qtumGov, adminAddressesSigners, otherAddressesSet1 } =
        await loadFixture(deployFixture);

      expect((await qtumGov.getAddressesList(0)).length).to.be.equal(6);
      const addressToAdd = otherAddressesSet1[0];

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .addAddressProposal(addressToAdd, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .addAddressProposal(addressToAdd, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .addAddressProposal(addressToAdd, 0);
      await tx.wait();

      expect((await qtumGov.getAddressesList(0)).length).to.be.equal(7);
    });

    it("Should add new gov address", async function () {
      const { qtumGov, adminAddressesSigners, otherAddressesSet1 } =
        await loadFixture(deployFixture);

      expect((await qtumGov.getAddressesList(1)).length).to.be.equal(1);
      const addressToAdd = otherAddressesSet1[0];

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .addAddressProposal(addressToAdd, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .addAddressProposal(addressToAdd, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .addAddressProposal(addressToAdd, 1);
      await tx.wait();

      expect((await qtumGov.getAddressesList(1)).length).to.be.equal(2);
    });

    it("Should remove admin address", async function () {
      const { qtumGov, adminAddressesSigners } = await loadFixture(
        deployFixture
      );

      expect((await qtumGov.getAddressesList(0)).length).to.be.equal(6);
      const addressToRemove = adminAddressesSigners[3].address;

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .removeAddressProposal(addressToRemove, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .removeAddressProposal(addressToRemove, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .removeAddressProposal(addressToRemove, 0);
      await tx.wait();

      expect((await qtumGov.getAddressesList(0)).length).to.be.equal(5);
    });

    it("Should remove gov address", async function () {
      const { qtumGov, adminAddressesSigners, govAddresses } =
        await loadFixture(deployFixture);

      expect((await qtumGov.getAddressesList(1)).length).to.be.equal(1);
      const addressToRemove = govAddresses[0];

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .removeAddressProposal(addressToRemove, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .removeAddressProposal(addressToRemove, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .removeAddressProposal(addressToRemove, 1);
      await tx.wait();

      expect((await qtumGov.getAddressesList(1)).length).to.be.equal(0);
    });

    it("Should sync admin adding new admin address", async function () {
      const {
        qtumGov,
        poaGov,
        mobileValidator,
        adminAddressesSigners,
        otherAddressesSigner,
      } = await loadFixture(deployFixture);

      expect(
        await mobileValidator
          .connect(otherAddressesSigner[0])
          .checkHasAdminRole()
      ).to.be.false;
      expect(await poaGov.connect(otherAddressesSigner[0]).checkHasAdminRole())
        .to.be.false;
      const addressToAdd = otherAddressesSigner[0].address;

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .addAddressProposal(addressToAdd, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .addAddressProposal(addressToAdd, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .addAddressProposal(addressToAdd, 0);
      await tx.wait();

      expect(
        await mobileValidator
          .connect(otherAddressesSigner[0])
          .checkHasAdminRole()
      ).to.be.true;
      expect(await poaGov.connect(otherAddressesSigner[0]).checkHasAdminRole())
        .to.be.true;
    });

    it("Should sync gov adding new gov address", async function () {
      const {
        qtumGov,
        poaGov,
        mobileValidator,
        adminAddressesSigners,
        otherAddressesSigner,
      } = await loadFixture(deployFixture);

      expect(
        await mobileValidator.connect(otherAddressesSigner[0]).checkHasGovRole()
      ).to.be.false;
      expect(await poaGov.connect(otherAddressesSigner[0]).checkHasGovRole()).to
        .be.false;
      const addressToAdd = otherAddressesSigner[0].address;

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .addAddressProposal(addressToAdd, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .addAddressProposal(addressToAdd, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .addAddressProposal(addressToAdd, 1);
      await tx.wait();

      expect(
        await mobileValidator.connect(otherAddressesSigner[0]).checkHasGovRole()
      ).to.be.true;
      expect(await poaGov.connect(otherAddressesSigner[0]).checkHasGovRole()).to
        .be.true;
    });

    it("Should sync admin address removing admin address", async function () {
      const { qtumGov, poaGov, mobileValidator, adminAddressesSigners } =
        await loadFixture(deployFixture);

      expect(
        await mobileValidator
          .connect(adminAddressesSigners[3])
          .checkHasAdminRole()
      ).to.be.true;
      expect(await poaGov.connect(adminAddressesSigners[3]).checkHasAdminRole())
        .to.be.true;
      const addressToRemove = adminAddressesSigners[3].address;

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .removeAddressProposal(addressToRemove, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .removeAddressProposal(addressToRemove, 0);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .removeAddressProposal(addressToRemove, 0);
      await tx.wait();

      expect(
        await mobileValidator
          .connect(adminAddressesSigners[3])
          .checkHasAdminRole()
      ).to.be.false;
      expect(await poaGov.connect(adminAddressesSigners[3]).checkHasAdminRole())
        .to.be.false;
    });

    it("Should sync gov address removing gov address", async function () {
      const {
        qtumGov,
        poaGov,
        mobileValidator,
        adminAddressesSigners,
        govAddressesSigner,
      } = await loadFixture(deployFixture);
      expect(
        await mobileValidator.connect(govAddressesSigner[0]).checkHasGovRole()
      ).to.be.true;
      expect(await poaGov.connect(govAddressesSigner[0]).checkHasGovRole()).to
        .be.true;

      const addressToRemove = govAddressesSigner[0].address;

      let tx = await qtumGov
        .connect(adminAddressesSigners[0])
        .removeAddressProposal(addressToRemove, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[1])
        .removeAddressProposal(addressToRemove, 1);
      await tx.wait();
      tx = await qtumGov
        .connect(adminAddressesSigners[2])
        .removeAddressProposal(addressToRemove, 1);
      await tx.wait();

      expect(
        await mobileValidator.connect(govAddressesSigner[0]).checkHasGovRole()
      ).to.be.false;
      expect(await poaGov.connect(govAddressesSigner[0]).checkHasGovRole()).to
        .be.false;
    });

    it("Should contain admin addresses for qtum gov contract", async () => {
      const { adminAddresses, qtumGov } = await loadFixture(deployFixture);
      expect(await qtumGov.getAddressesList(0)).to.have.members(adminAddresses);
    });

    it("Should contain gov addresses for qtum gov contract", async () => {
      const { govAddresses, qtumGov } = await loadFixture(deployFixture);
      expect(await qtumGov.getAddressesList(1)).to.have.members(govAddresses);
    });
  });

  describe("Mobile Validator test suite", function () {
    const exampleProposedValidatorID = ethers.utils.formatBytes32String("11");
    const secondExampleProposedValidatorID =
      ethers.utils.formatBytes32String("111");
    const exampleProposedPublicKeyInHex =
      "0x036fcc37ea5e9e09fec6c83e5fbd7a745e3eee81d16ebd861c9e66f55518c19798";
    const exampleProposedPublicKey = ethers.utils.arrayify(
      exampleProposedPublicKeyInHex
    );

    async function getProposalID(
      caller: Signer,
      mobileValidator: MobileValidator,
      proposedValidatorID: any
    ) {
      await mobileValidator
        .connect(caller)
        .proposeValidator(proposedValidatorID, exampleProposedPublicKey, true);
      const paramEncode = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes"],
        [proposedValidatorID, exampleProposedPublicKey]
      );
      return BigInt(ethers.utils.keccak256(paramEncode));
    }

    async function proposeNewValidator() {
      const { owner, nonOwner, adminAddressesSigners, mobileValidator } =
        await loadFixture(deployFixture);

      const proposalID = await getProposalID(
        owner,
        mobileValidator,
        exampleProposedValidatorID
      );
      return {
        owner,
        nonOwner,
        adminAddressesSigners,
        mobileValidator,
        proposalID,
      };
    }

    async function addValidatorByAutoVoting() {
      const {
        owner,
        nonOwner,
        adminAddressesSigners,
        proposalID,
        mobileValidator,
      } = await loadFixture(proposeNewValidator);
      expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
        .be.false;

      let tx = await mobileValidator
        .connect(adminAddressesSigners[2])
        .vote(proposalID, 1);
      await tx.wait();
      tx = await mobileValidator
        .connect(adminAddressesSigners[3])
        .vote(proposalID, 1);
      await tx.wait();
      tx = await mobileValidator
        .connect(adminAddressesSigners[4])
        .vote(proposalID, 1);
      await tx.wait();

      return {
        owner,
        nonOwner,
        adminAddressesSigners,
        proposalID,
        mobileValidator,
      };
    }

    describe("Functionality", function () {
      async function mineBlocks(blockNumber: number) {
        while (blockNumber > 0) {
          blockNumber--;
          await ethers.provider.send("evm_mine", []);
        }
      }

      it("Should set default min validator numbers to 1000", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        expect(await mobileValidator.minMobileValidators()).to.be.equal(1000);
      });

      it("Should update min validator numbers by admin", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        const newMinValidators = 1111;
        let tx = await mobileValidator.changeMinMobileValidator(
          newMinValidators
        );
        tx.wait();
        expect(await mobileValidator.minMobileValidators()).to.be.equal(
          newMinValidators
        );
      });

      it("Should not set min validator number if not admin", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(deployFixture);
        await expect(
          mobileValidator.connect(nonOwner).changeMinMobileValidator(1111)
        ).to.be.reverted;
      });

      // ValidatorFeatureStatus
      // Enabled -> 0
      // Prepared -> 1
      // Disabled -> 2
      it("Should set default status disabled", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        expect(await mobileValidator.status()).to.be.equal(2);
      });

      it("Should update status to prepared by admin", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
      });

      it("Should not update status to prepared if not admin", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(deployFixture);
        await expect(mobileValidator.connect(nonOwner).changeToPrepared()).to.be
          .reverted;
      });

      it("Should update status to enabled after 960 blocks", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        const updatedBlock = 961;
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();

        const blockNumBefore = await ethers.provider.getBlockNumber();

        await mineBlocks(updatedBlock);

        const blockNumAfter = await ethers.provider.getBlockNumber();

        expect(await mobileValidator.status()).to.be.equal(0);
      });

      it("Should not update status to enabled after 960 blocks if not admin", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(deployFixture);
        const updatedBlock = 961;
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();

        const blockNumBefore = await ethers.provider.getBlockNumber();

        await mineBlocks(updatedBlock);

        const blockNumAfter = await ethers.provider.getBlockNumber();

        // console.log("Block number before:", blockNumBefore);
        // console.log("Block number after:", blockNumAfter);

        await expect(mobileValidator.connect(nonOwner).changeToEnabled()).to.be
          .reverted;
      });

      it("Should not update status to enabled if not 960 blocks passed", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
      });

      it("Should not update status to prepared if already prepared", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        await expect(mobileValidator.changeToPrepared()).to.be.reverted;
      });

      it("Should not update status to enabled if already enabled", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        const updatedBlock = 961;
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();

        const blockNumBefore = await ethers.provider.getBlockNumber();

        await mineBlocks(updatedBlock);

        const blockNumAfter = await ethers.provider.getBlockNumber();

        // console.log("Block number before:", blockNumBefore);
        // console.log("Block number after:", blockNumAfter);

        await expect(mobileValidator.changeToEnabled()).to.be.reverted;
      });

      it("Should update status from enabled to disabled by admin", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        const updatedBlock = 961;
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        await mineBlocks(updatedBlock);

        expect(await mobileValidator.status()).to.be.equal(0);
        tx = await mobileValidator.changeFromEnabledToDisable();
        tx.wait();
        expect(await mobileValidator.status()).to.be.equal(2);
      });

      it("Should not update status from enabled to disabled if no admin", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(deployFixture);

        const updatedBlock = 961;
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        await mineBlocks(updatedBlock);

        expect(await mobileValidator.status()).to.be.equal(0);
        await expect(
          mobileValidator.connect(nonOwner).changeFromEnabledToDisable()
        ).to.be.reverted;
        expect(await mobileValidator.status()).to.be.equal(0);
      });

      it("Should update status from prepared to disabled by admin", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);

        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);

        tx = await mobileValidator.changeFromPreparedToDisable();
        tx.wait();
        expect(await mobileValidator.status()).to.be.equal(2);
      });

      it("Should not update status from prepared to disabled if not admin", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(deployFixture);

        let tx = await mobileValidator.changeToPrepared();
        tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);

        await expect(
          mobileValidator.connect(nonOwner).changeFromPreparedToDisable()
        ).to.be.reverted;
        expect(await mobileValidator.status()).to.be.equal(1);
      });

      it("Should not update min validator with the same min number of validator", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);
        await expect(mobileValidator.changeMinMobileValidator(1000)).to.be
          .reverted;
      });

      it("Should create a proposal ID", async () => {
        const { proposalID } = await loadFixture(proposeNewValidator);

        expect(proposalID).to.not.equal(0);
      });

      it("Should match validator ID and public key", async () => {
        const { proposalID, mobileValidator } = await loadFixture(
          proposeNewValidator
        );
        const proposal = await mobileValidator.getProposedValidator(proposalID);

        expect(proposal.validatorID).to.be.equal(exampleProposedValidatorID);
        expect(ethers.utils.hexlify(proposal.publicKey)).to.be.equal(
          exampleProposedPublicKeyInHex
        );
      });

      it("Should not propose the same validator ID", async () => {
        const { mobileValidator } = await loadFixture(proposeNewValidator);
        await expect(
          mobileValidator.proposeValidator(
            exampleProposedValidatorID,
            exampleProposedPublicKey,
            true
          )
        ).to.be.reverted;
      });

      it("Should not propose if non owner address", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(
          proposeNewValidator
        );
        await expect(
          mobileValidator
            .connect(nonOwner)
            .proposeValidator(
              secondExampleProposedValidatorID,
              exampleProposedPublicKey,
              true
            )
        ).to.be.reverted;
      });

      it("Should propose a second proposal if different id", async () => {
        const { owner, mobileValidator } = await loadFixture(
          proposeNewValidator
        );
        const secondProposalID = await getProposalID(
          owner,
          mobileValidator,
          secondExampleProposedValidatorID
        );

        const secondProposal = await mobileValidator.getProposedValidator(
          secondProposalID
        );

        expect(secondProposal.validatorID).to.be.equal(
          secondExampleProposedValidatorID
        );
        expect(ethers.utils.hexlify(secondProposal.publicKey)).to.be.equal(
          exampleProposedPublicKeyInHex
        );
      });

      // 0 => Abstain
      // 1 => Vote for
      // 2 => Vote against
      it("Should be able to vote for/against/abstain", async () => {
        const { proposalID, adminAddressesSigners, mobileValidator } =
          await loadFixture(proposeNewValidator);
        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 0);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[4])
          .vote(proposalID, 2);
        await tx.wait();
        const proposalDetails =
          await mobileValidator.getValidatorProposalDetails(proposalID);
        expect(proposalDetails.againstVotes).to.equal(1);
        expect(proposalDetails.forVotes).to.equal(2);
        expect(proposalDetails.abstainVotes).to.equal(1);
      });

      it("Should not be able to vote twice", async () => {
        const { proposalID, adminAddressesSigners, mobileValidator } =
          await loadFixture(proposeNewValidator);
        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 0);
        await tx.wait();
        await expect(
          mobileValidator.connect(adminAddressesSigners[2]).vote(proposalID, 1)
        ).to.be.reverted;
      });

      it("Should not be able to vote if proposal ID do not exist", async () => {
        const { adminAddressesSigners, mobileValidator } = await loadFixture(
          proposeNewValidator
        );
        await expect(
          mobileValidator
            .connect(adminAddressesSigners[0])
            .vote(ethers.BigNumber.from(ethers.utils.randomBytes(32)), 1)
        ).to.be.reverted;
      });

      it("Should not be able to vote if not admin", async () => {
        const { nonOwner, proposalID, mobileValidator } = await loadFixture(
          proposeNewValidator
        );

        await expect(mobileValidator.connect(nonOwner).vote(proposalID, 1)).to
          .be.reverted;
      });

      // Status:
      // 0 -> OnGoing
      // 1 -> Cancelled
      // 2 -> VerdictPending
      // 3 -> ProposalSucceeded
      // 4 -> ProposalVotedOut
      it("Should auto execute to add validator for majority for vote", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[4])
          .vote(proposalID, 1);
        await tx.wait();

        await expect(
          mobileValidator.connect(adminAddressesSigners[5]).vote(proposalID, 1)
        ).to.be.reverted;

        const proposalDetails =
          await mobileValidator.getValidatorProposalDetails(proposalID);
        expect(proposalDetails.votingstatus).to.equal(3);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;
      });

      it("Should auto execute to add validator for majority against vote", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;
        let tx = await mobileValidator
          .connect(adminAddressesSigners[1])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[4])
          .vote(proposalID, 2);
        await tx.wait();

        await expect(
          mobileValidator.connect(adminAddressesSigners[5]).vote(proposalID, 2)
        ).to.be.reverted;

        const proposalDetails =
          await mobileValidator.getValidatorProposalDetails(proposalID);
        expect(proposalDetails.votingstatus).to.equal(4);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;
      });

      it("Should not propose already added validator", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[4])
          .vote(proposalID, 1);
        await tx.wait();

        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;
        await expect(
          mobileValidator.proposeValidator(
            exampleProposedValidatorID,
            exampleProposedPublicKey,
            true
          )
        ).to.be.reverted;
      });

      it("Should voting proposal be successful for majority votes", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 1);
        await tx.wait();

        let proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(0);

        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .endVotingPeriod(proposalID);
        await tx.wait();

        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .executeVote(proposalID);
        await tx.wait();

        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(3);
      });

      it("Should voting proposal failed for less than majority votes", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 2);
        await tx.wait();

        let proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(0);

        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .endVotingPeriod(proposalID);
        await tx.wait();

        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .executeVote(proposalID);
        await tx.wait();

        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(4);
      });

      it("Should not vote after voting period", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 2);
        await tx.wait();

        let proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(0);

        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .endVotingPeriod(proposalID);
        await tx.wait();
        proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(2);

        await expect(
          mobileValidator.connect(adminAddressesSigners[4]).vote(proposalID, 1)
        ).to.be.reverted;

        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .executeVote(proposalID);
        await tx.wait();

        await expect(
          mobileValidator.connect(adminAddressesSigners[5]).vote(proposalID, 1)
        ).to.be.reverted;
      });

      it("Should prepare validator feature if update min validator to same as active validator", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeMinMobileValidator(1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
      });

      it("Should enable validator feature if update min validator to same as active validator and 960 block passed", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeMinMobileValidator(1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
        const updatedBlock = 961;
        await mineBlocks(updatedBlock);
        expect(await mobileValidator.status()).to.be.equal(0);
      });

      it("Should disable validator feature if update min validator to less than active validator", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeMinMobileValidator(1);
        await tx.wait();

        tx = await mobileValidator.changeMinMobileValidator(2);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(2);
      });

      it("Should prepare validator feature if active validator is increased", async () => {
        const { owner, adminAddressesSigners, mobileValidator } =
          await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeMinMobileValidator(2);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(2);
        const secondProposalID = await getProposalID(
          owner,
          mobileValidator,
          secondExampleProposedValidatorID
        );
        tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(secondProposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(secondProposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[4])
          .vote(secondProposalID, 1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
      });

      it("Should enable validator feature if active validator is increased and 960 block passed", async () => {
        const { owner, adminAddressesSigners, mobileValidator } =
          await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.status()).to.be.equal(2);
        let tx = await mobileValidator.changeMinMobileValidator(2);
        await tx.wait();
        const secondProposalID = await getProposalID(
          owner,
          mobileValidator,
          secondExampleProposedValidatorID
        );
        tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(secondProposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(secondProposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[4])
          .vote(secondProposalID, 1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
        const updatedBlock = 961;
        await mineBlocks(updatedBlock);
        expect(await mobileValidator.status()).to.be.equal(0);
      });

      it("Should disable feature if ban validator, decrease from min validator", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        let tx = await mobileValidator.changeMinMobileValidator(1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
        tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .true;
        expect(await mobileValidator.status()).to.be.equal(2);
      });

      it("Should prepare feature if unban validator, increase from min validator", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        let tx = await mobileValidator.changeMinMobileValidator(1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
        tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .true;
        expect(await mobileValidator.status()).to.be.equal(2);
        tx = await mobileValidator.unbanValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
      });

      it("Should enable feature if unban validator, increase from min validator and 960 block passed", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        let tx = await mobileValidator.changeMinMobileValidator(1);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
        tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .true;
        expect(await mobileValidator.status()).to.be.equal(2);
        tx = await mobileValidator.unbanValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.status()).to.be.equal(1);
        const updatedBlock = 961;
        await mineBlocks(updatedBlock);
        expect(await mobileValidator.status()).to.be.equal(0);
      });

      it("Should ban validator", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        let tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();

        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .true;
      });

      it("Should unban validator", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        let tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        tx = await mobileValidator.unbanValidator(exampleProposedValidatorID);
        await tx.wait();

        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .false;
      });

      it("Should not ban if already banned", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        let tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        await expect(mobileValidator.banValidator(exampleProposedValidatorID))
          .to.be.reverted;
      });

      it("Should not unban if already unbanned", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        let tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        tx = await mobileValidator.unbanValidator(exampleProposedValidatorID);
        await tx.wait();
        await expect(mobileValidator.unbanValidator(exampleProposedValidatorID))
          .to.be.reverted;
      });

      it("Can not ban or unban if not admin", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(
          addValidatorByAutoVoting
        );
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        await expect(
          mobileValidator
            .connect(nonOwner)
            .banValidator(exampleProposedValidatorID)
        ).to.be.reverted;

        let tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .true;

        await expect(
          mobileValidator
            .connect(nonOwner)
            .unbanValidator(exampleProposedValidatorID)
        ).to.be.reverted;
      });

      it("Can not ban or unban if validator ID do not exist", async () => {
        const { nonOwner, mobileValidator } = await loadFixture(
          addValidatorByAutoVoting
        );
        await expect(
          mobileValidator
            .connect(nonOwner)
            .banValidator(secondExampleProposedValidatorID)
        ).to.be.reverted;
        await expect(
          mobileValidator
            .connect(nonOwner)
            .unbanValidator(secondExampleProposedValidatorID)
        ).to.be.reverted;
      });

      it("Should get public key if unbanned validator ID", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);

        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        const pubKey = await mobileValidator.getValidatorPubKey(
          exampleProposedValidatorID
        );
        expect(ethers.utils.hexlify(pubKey)).to.equal(
          exampleProposedPublicKeyInHex
        );
      });

      it("Should not get public key if validator ID do not exist", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        await expect(
          mobileValidator.getValidatorPubKey(secondExampleProposedValidatorID)
        ).to.be.reverted;
      });

      it("Should not get public key if banned validator ID", async () => {
        const { mobileValidator } = await loadFixture(addValidatorByAutoVoting);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        let tx = await mobileValidator.banValidator(exampleProposedValidatorID);
        await tx.wait();
        expect(await mobileValidator.isBanned(exampleProposedValidatorID)).to.be
          .true;

        await expect(
          mobileValidator.getValidatorPubKey(exampleProposedValidatorID)
        ).to.be.reverted;
      });

      // it('something', async () => {
      //   // const { adminAddressesSigners, proposalID, mobileValidator } = await loadFixture(proposeNewValidator);
      //   expect(true);
      // });
    });

    describe("Events", function () {
      it("Should emit BanValidator", async () => {
        const { adminAddressesSigners, mobileValidator } = await loadFixture(
          addValidatorByAutoVoting
        );
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        await expect(
          mobileValidator
            .connect(adminAddressesSigners[1])
            .banValidator(exampleProposedValidatorID)
        )
          .to.emit(mobileValidator, "BanValidator")
          .withArgs(
            exampleProposedValidatorID,
            adminAddressesSigners[1].address,
            anyValue
          );
      });

      it("Should emit UnbanValidator", async () => {
        const { adminAddressesSigners, mobileValidator } = await loadFixture(
          addValidatorByAutoVoting
        );
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.true;

        await mobileValidator
          .connect(adminAddressesSigners[1])
          .banValidator(exampleProposedValidatorID);
        await expect(
          mobileValidator
            .connect(adminAddressesSigners[1])
            .unbanValidator(exampleProposedValidatorID)
        )
          .to.emit(mobileValidator, "UnbanValidator")
          .withArgs(
            exampleProposedValidatorID,
            adminAddressesSigners[1].address,
            anyValue
          );
      });
      it("Should emit CastProposalVote", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        await expect(
          mobileValidator.connect(adminAddressesSigners[1]).vote(proposalID, 1)
        )
          .to.emit(mobileValidator, "CastProposalVote")
          .withArgs(proposalID, adminAddressesSigners[1].address, 1, anyValue);
      });

      it("Should emit VotingPeriodOver", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 2);
        await tx.wait();

        let proposalDetails = await mobileValidator.getValidatorProposalDetails(
          proposalID
        );
        expect(proposalDetails.votingstatus).to.equal(0);

        await expect(
          mobileValidator
            .connect(adminAddressesSigners[1])
            .endVotingPeriod(proposalID)
        )
          .to.emit(mobileValidator, "VotingPeriodOver")
          .withArgs(proposalID);
      });

      it("Should emit ProposalVoteSucceeded", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 1);
        await tx.wait();

        await expect(
          mobileValidator.connect(adminAddressesSigners[4]).vote(proposalID, 1)
        )
          .to.emit(mobileValidator, "ProposalVoteSucceeded")
          .withArgs(proposalID, exampleProposedValidatorID, anyValue);
      });

      it("Should emit ProposalVoteFailed", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;
        let tx = await mobileValidator
          .connect(adminAddressesSigners[1])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 2);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 2);
        await tx.wait();

        await expect(
          mobileValidator.connect(adminAddressesSigners[4]).vote(proposalID, 2)
        )
          .to.emit(mobileValidator, "ProposalVoteFailed")
          .withArgs(proposalID, exampleProposedValidatorID, anyValue);
      });

      it("Should emit AddValidator", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);
        expect(await mobileValidator.isValidator(exampleProposedValidatorID)).to
          .be.false;

        let tx = await mobileValidator
          .connect(adminAddressesSigners[2])
          .vote(proposalID, 1);
        await tx.wait();
        tx = await mobileValidator
          .connect(adminAddressesSigners[3])
          .vote(proposalID, 1);
        await tx.wait();

        await expect(
          mobileValidator.connect(adminAddressesSigners[4]).vote(proposalID, 1)
        )
          .to.emit(mobileValidator, "AddValidator")
          .withArgs(exampleProposedValidatorID, exampleProposedPublicKey);
      });

      it("Should emit UpdateTimeStamp", async () => {
        const { adminAddressesSigners, proposalID, mobileValidator } =
          await loadFixture(proposeNewValidator);

        const newTimePeriod = 1100000;
        await expect(
          mobileValidator
            .connect(adminAddressesSigners[1])
            .updateVotingPeriod(newTimePeriod)
        )
          .to.emit(mobileValidator, "UpdateTimeStamp")
          .withArgs(1209600, newTimePeriod, adminAddressesSigners[1].address);
      });

      it("Should emit AddValidatorProposal", async () => {
        const { mobileValidator } = await loadFixture(deployFixture);

        await expect(
          mobileValidator.proposeValidator(
            exampleProposedValidatorID,
            exampleProposedPublicKey,
            true
          )
        )
          .to.emit(mobileValidator, "AddValidatorProposal")
          .withArgs(anyValue);
      });
    });
  });
});
