// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IQtumGov.sol";
import "./interfaces/ISyncable.sol";

contract POAGovernance is AccessControl, ISyncable {
    bytes32 public constant MINER_ROLE = keccak256("MINER");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");

    // 2 weeks in seconds = 1209600
    uint128 private votingPeriod = 1209600;
    IQtumGov private _qtumGovContract;

    struct UTXO {
        uint256 index;
        string txId;
    }

    // bytes32 -> hash of txID+index
    mapping(address => UTXO[]) private miners;
    uint256 whitelistedUTXOs;
    uint256 public minUTXOs;

    address[] private allMiners;
    enum VoteType {
        Against,
        For,
        Abstain
    }

    enum Status {
        OnGoing,
        Cancalled,
        VerdictPending,
        ProposalSucceded,
        ProposalVotedOut
    }

    struct MinerProposalDetail {
        address proposer;
        uint256 startTime;
        Status status;
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
        mapping(address => bool) hasVoted;
        address minerAddress;
        UTXO[] utxos;
    }

    // key => Proposal ID
    mapping(uint256 => MinerProposalDetail) private _minerProposals;
    mapping(uint256 => address) private _utxoMapping;

    event AddMinerProposal(uint256 minerProposalID);

    uint256 private _totalAdminOrGovs;
    bool featureEnabled;

    event CastMinerVote(
        uint256 indexed minerProposalID,
        address voter,
        VoteType voteType,
        uint256 timestamp
    );

    event VotingPeriodOver(uint256 minerProposalID);

    event MinerVoteSucceeded(
        uint256 indexed minerProposalID,
        address addedMinerAddress,
        uint256 timestamp
    );

    event MinerVoteFailed(
        uint256 indexed minerProposalID,
        address rejectedMinerAddress,
        uint256 timestamp
    );

    modifier checkIfMiner(address addressToCheck) {
        require(hasRole(MINER_ROLE, addressToCheck), "Not a miner");
        _;
    }

    modifier checkIfNotMiner(address _address) {
        require(!hasRole(MINER_ROLE, _address), "Already a miner");
        _;
    }

    modifier checkIfOwner() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not a owner");
        _;
    }

    modifier checkIfAdminOrGov() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender),
            "Not a admin or gov acoount"
        );
        _;
    }

    modifier checkIfAdminGovOr0Address() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) ||
                hasRole(GOV_ROLE, msg.sender) ||
                msg.sender == address(0),
            "Not a admin or gov or 0 account"
        );
        _;
    }

    modifier checkPriviligedAccount() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) ||
                hasRole(GOV_ROLE, msg.sender) ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not a admin or gov acoount"
        );
        _;
    }

    modifier checkIfAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not an admin");
        _;
    }

    function checkIfMinerProposalIdExist(uint256 minerProposalID)
        public
        view
        returns (bool)
    {
        return _minerProposals[minerProposalID].startTime != 0;
    }

    function checkIfMinerProposalIdDontExist(uint256 minerProposalID)
        internal
        view
    {
        require(
            _minerProposals[minerProposalID].startTime == 0,
            "Miner Proposal already exist"
        );
    }

    function isGovAndAdminAddress(address addressToCheck)
        external
        view
        returns (bool)
    {
        return
            hasRole(ADMIN_ROLE, addressToCheck) ||
            hasRole(GOV_ROLE, addressToCheck);
    }

    constructor(address _qtumContractAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _qtumGovContract = IQtumGov(_qtumContractAddress);
        address[] memory adminAddresses = _qtumGovContract.getAddressesList(0);
        uint256 numberOfAdminAddresses = adminAddresses.length;
        for (uint256 index = 0; index < numberOfAdminAddresses; index++) {
            grantRole(ADMIN_ROLE, adminAddresses[index]);
        }
        address[] memory govAddresses = _qtumGovContract.getAddressesList(1);
        uint256 numberOfGovAddresses = govAddresses.length;
        for (uint256 index = 0; index < numberOfGovAddresses; index++) {
            grantRole(GOV_ROLE, govAddresses[index]);
        }
        _totalAdminOrGovs = (numberOfAdminAddresses + numberOfGovAddresses);
        _setupRole(DEFAULT_ADMIN_ROLE, _qtumContractAddress);
        _setRoleAdmin(MINER_ROLE, ADMIN_ROLE);
        minUTXOs=3;
    }

    function isMiner(address addressToCheck) public view returns (bool) {
        return hasRole(MINER_ROLE, addressToCheck);
    }

    function updateMinUTXOs(uint256 newMinUTXOs) external checkIfAdmin {
        require(newMinUTXOs != minUTXOs, "New minimum same number");
        uint256 prevMinUTXOs = minUTXOs;   
        minUTXOs = newMinUTXOs;
        if(newMinUTXOs > prevMinUTXOs){
            checkFeatureNeedDisabled();
        }
        else{
            checkFeatureNeedEnabled();
        }

    }

    function checkHasAdminRole() external view returns(bool) {
        return hasRole(ADMIN_ROLE, msg.sender);
    }

    function checkHasGovRole() external view returns(bool) {
        return hasRole(GOV_ROLE, msg.sender);
    }

    // Returns:
    // True -> Feature enabled
    // False -> Feature disabled
    function enabled() public view returns(bool) {
        return featureEnabled;
    }

     function checkFeatureNeedEnabled() internal {
        if(!featureEnabled){
            if(whitelistedUTXOs >= minUTXOs){
                featureEnabled = true;
            }
        }
    }

    modifier checkQtumContractAddress() {
        require(
            msg.sender == address(_qtumGovContract),
            "Not qtum contract address"
        );
        _;
    }

    function checkFeatureNeedDisabled() internal {
        if(featureEnabled){
            if(whitelistedUTXOs < minUTXOs){
                featureEnabled = false;
            }
        }
    }

    function addAdminAddress(address newAdmin)
        public
        checkQtumContractAddress
    {
        grantRole(ADMIN_ROLE, newAdmin);
        _totalAdminOrGovs += 1;
    }

    function removeAdminAddress(address adminToBeRemoved)
        public
        checkQtumContractAddress
    {
        revokeRole(ADMIN_ROLE, adminToBeRemoved);
        _totalAdminOrGovs -= 1;
    }

    function addGovAddress(address newGov)
        public
        checkQtumContractAddress
    {
        grantRole(GOV_ROLE, newGov);
        _totalAdminOrGovs += 1;
    }

    function removeGovAddress(address govToBeRemoved)
        public
        checkQtumContractAddress
    {
        revokeRole(GOV_ROLE, govToBeRemoved);
        _totalAdminOrGovs -= 1;
    }

    function hashMinerProposal(address minerAddress, UTXO[] memory utxos)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encode(minerAddress, utxos)));
    }

    function proposeMiner(
        address _minerAddress,
        UTXO[] memory _newUTXOs,
        bool forVote
    ) public checkIfAdmin checkIfNotMiner(_minerAddress) {
        uint256 minerProposalID = hashMinerProposal(_minerAddress, _newUTXOs);
        checkIfMinerProposalIdDontExist(minerProposalID);
        MinerProposalDetail storage newProposalDetail = _minerProposals[
            minerProposalID
        ];
        newProposalDetail.proposer = msg.sender;
        newProposalDetail.startTime = block.timestamp;
        newProposalDetail.status = Status.OnGoing;
        newProposalDetail.againstVotes = 0;
        newProposalDetail.forVotes = forVote ? 1 : 0;
        newProposalDetail.abstainVotes = forVote ? 0 : 1;
        newProposalDetail.hasVoted[msg.sender] = true;
        newProposalDetail.minerAddress = _minerAddress;
        // newProposalDetail.utxos = _newUTXOs;
        uint256 totalUTXOs = _newUTXOs.length;
        for (uint256 index = 0; index < totalUTXOs; index++) {
            newProposalDetail.utxos.push(_newUTXOs[index]);
        }
        emit AddMinerProposal(minerProposalID);
    }

    /**
     * @dev CHeck total vote for, votes againstr, abstain is greater than more than half voters
        @return bool true -> over 59% voter have voted
     */
    function checkOverHalfVoted(uint256 proposalID) public view returns (bool) {
        return
            _minerProposals[proposalID].forVotes +
                _minerProposals[proposalID].againstVotes +
                _minerProposals[proposalID].abstainVotes >
            _totalAdminOrGovs / 2;
    }

    function getMinerProposalDetails(uint256 minerProposalID)
        public
        view
        returns (
            address proposer,
            uint256 startTime,
            Status status,
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes,
            address minerAddress
        )
    {
        require(
            checkIfMinerProposalIdExist(minerProposalID),
            "Miner Proposal do not exist"
        );
        return (
            _minerProposals[minerProposalID].proposer,
            _minerProposals[minerProposalID].startTime,
            _minerProposals[minerProposalID].status,
            _minerProposals[minerProposalID].againstVotes,
            _minerProposals[minerProposalID].forVotes,
            _minerProposals[minerProposalID].abstainVotes,
            _minerProposals[minerProposalID].minerAddress
        );
    }

    // function resetStartTime(uint256 minerProposalID)
    //     public
    //     checkPriviligedAccount
    // {
    //     require(
    //         checkIfMinerProposalIdExist(minerProposalID),
    //         "Proposal do not exist"
    //     );
    //     require(
    //         !checkOverHalfVoted(minerProposalID),
    //         "Half of the voters voted already"
    //     );
    //     require(
    //         _minerProposals[minerProposalID].status == Status.OnGoing,
    //         "Voting proposal no longer active"
    //     );
    //     _minerProposals[minerProposalID].startTime = block.timestamp;
    // }

    /**
     * @dev Update the voting period - NOT SUITED FOR PRODUCTION
     
       @notice probably update voting period according to global hyperparamter and allow to set the voting period with a voting mechanism and make this function obsolete
     */
    // function updateVotingPeriod(uint128 updatedTime)
    //     public
    //     checkPriviligedAccount
    // {
    //     require(updatedTime != 0, "Voting period can't be 0");
    //     votingPeriod = updatedTime;
    // }

    /**
     * @dev Vote for, against for a proposal or abstain from a proposal
        voteCasted expected values:
        0 => Abstain
        1 => Vote for
        2 => Vote against
     */
    function vote(uint256 minerProposalID, uint8 voteCasted)
        external
        checkIfAdminOrGov
    {
        require(voteCasted < 3, "Not a valid vote");
        require(
            checkIfMinerProposalIdExist(minerProposalID),
            "Proposal ID do not exist"
        );
        require(
            !_minerProposals[minerProposalID].hasVoted[msg.sender],
            "Already voted"
        );
        require(
            (_minerProposals[minerProposalID].startTime + votingPeriod) >
                block.timestamp,
            "Voting is over"
        );
        require(
            _minerProposals[minerProposalID].status == Status.OnGoing,
            "Voting proposal no longer active"
        );
        VoteType voteType;
        if (voteCasted == 0) {
            _minerProposals[minerProposalID].abstainVotes += 1;
            voteType = VoteType.Abstain;
        } else if (voteCasted == 1) {
            _minerProposals[minerProposalID].forVotes += 1;
            voteType = VoteType.For;
        } else {
            _minerProposals[minerProposalID].againstVotes += 1;
            voteType = VoteType.Against;
        }
        _minerProposals[minerProposalID].hasVoted[msg.sender] = true;
        emit CastMinerVote(
            minerProposalID,
            msg.sender,
            voteType,
            block.timestamp
        );
        uint256 halfVotes = _totalAdminOrGovs / 2;
        if (
            _minerProposals[minerProposalID].forVotes > halfVotes ||
            _minerProposals[minerProposalID].againstVotes > halfVotes
        ) {
            _executeVote(minerProposalID);
        }
    }

    /**
     * @dev Check if voting period is over
     */
    function endVotingPeriod(uint256 minerProposalID)
        public
        checkPriviligedAccount
    {
        require(
            checkIfMinerProposalIdExist(minerProposalID),
            "Proposal ID not valid"
        );
        if (
            _minerProposals[minerProposalID].startTime + votingPeriod >
            block.timestamp
        ) {
            _minerProposals[minerProposalID].status = Status.VerdictPending;
        }
        emit VotingPeriodOver(minerProposalID);
    }

    // This could be optional
    function cancelVote(uint256 minerProposalID) public checkIfAdmin {
        require(
            checkIfMinerProposalIdExist(minerProposalID),
            "Proposal ID not valid"
        );
        require(!checkOverHalfVoted(minerProposalID), "More than half voted");
        require(
            _minerProposals[minerProposalID].status == Status.OnGoing ||
                _minerProposals[minerProposalID].status ==
                Status.VerdictPending,
            "Voting proposal no longer active"
        );
        _minerProposals[minerProposalID].status = Status.Cancalled;
    }

    /**
     * @dev Delete proposals that have reached verdict to get some extra gas and save space
     */
    function deleteProposal(uint256 minerProposalID) public checkIfOwner {
        require(
            checkIfMinerProposalIdExist(minerProposalID),
            "Proposal ID not valid"
        );
        require(
            _minerProposals[minerProposalID].status ==
                Status.ProposalSucceded ||
                _minerProposals[minerProposalID].status ==
                Status.ProposalVotedOut,
            "Proposal still have no verdict"
        );
        delete _minerProposals[minerProposalID];
    }

    function hashUTXO(UTXO memory utxo) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(utxo)));
    }

    function _executeAddMiner(address minerAddressToAdd, UTXO[] memory utxos)
        internal
        checkIfNotMiner(minerAddressToAdd)
    {
        grantRole(MINER_ROLE, minerAddressToAdd);
        allMiners.push(minerAddressToAdd);
        uint256 totalUTXOs = utxos.length;
        for (uint256 index = 0; index < totalUTXOs; index++) {
            miners[minerAddressToAdd].push(utxos[index]);
            _utxoMapping[hashUTXO(utxos[index])] = minerAddressToAdd;
        }
        whitelistedUTXOs += totalUTXOs;
        checkFeatureNeedEnabled();
    }

    /**
    * @dev Execute result of the vote
    Simple majority voting
    * @return bool : Reuturn if the propsoal is successful or not
    */
    function executeVote(uint256 minerProposalID)
        public
        checkPriviligedAccount
        returns (bool)
    {
        require(
            checkIfMinerProposalIdExist(minerProposalID),
            "Proposal ID not valid"
        );
        require(
            _minerProposals[minerProposalID].status == Status.VerdictPending,
            "Voting not over"
        );
        return _executeVote(minerProposalID);
    }

    function _executeVote(uint256 minerProposalID) internal returns (bool) {
        if (
            _minerProposals[minerProposalID].forVotes >
            _minerProposals[minerProposalID].againstVotes +
                _minerProposals[minerProposalID].abstainVotes
        ) {
            _minerProposals[minerProposalID].status = Status.ProposalSucceded;
            _executeAddMiner(
                _minerProposals[minerProposalID].minerAddress,
                _minerProposals[minerProposalID].utxos
            );
            emit MinerVoteSucceeded(
                minerProposalID,
                _minerProposals[minerProposalID].minerAddress,
                block.timestamp
            );
            return true;
        }
        _minerProposals[minerProposalID].status = Status.ProposalVotedOut;
        emit MinerVoteFailed(
            minerProposalID,
            _minerProposals[minerProposalID].minerAddress,
            block.timestamp
        );
        return false;
    }

    function removeAddress(address minerAddressToRevoke)
        external
        checkIfAdminOrGov
        checkIfMiner(minerAddressToRevoke)
    {
        revokeRole(MINER_ROLE, minerAddressToRevoke);
        uint256 totalMiners = allMiners.length;
        uint256 totalUTXOs = miners[minerAddressToRevoke].length;
        for (uint256 index = 0; index < totalUTXOs; index++) {
            delete _utxoMapping[hashUTXO(miners[minerAddressToRevoke][index])];
        }
        whitelistedUTXOs -= totalUTXOs;
        checkFeatureNeedDisabled();
        delete miners[minerAddressToRevoke];
        for (uint256 index = 0; index < totalMiners; index++) {
            if (allMiners[index] == minerAddressToRevoke) {
                allMiners[index] = allMiners[totalMiners - 1];
                allMiners.pop();
                break;
            }
        }
    }

    function checkTwoUTXOEquality(UTXO memory utxo1, UTXO memory utxo2)
        public
        pure
        returns (bool)
    {
        return (keccak256(abi.encode(utxo1.index, utxo1.txId)) ==
            keccak256(abi.encode(utxo2.index, utxo2.txId)));
    }

    function removeUTXOs(UTXO[] memory utxos) public checkIfAdminOrGov {
        uint256 totalUtxos = utxos.length;
        uint256 utxosFound;
        for (uint256 index = 0; index < totalUtxos; index++) {
            uint256 utxoToRemove = hashUTXO(utxos[index]);
            address minerWithTheUTXO = _utxoMapping[utxoToRemove];
            UTXO[] memory utxosOfOneMiner = miners[minerWithTheUTXO];
            uint256 totalUtxosOfOneMiner = utxosOfOneMiner.length;
            for (uint256 j = 0; j < totalUtxosOfOneMiner; j++) {
                if (hashUTXO(utxosOfOneMiner[j]) == utxoToRemove) {
                    miners[minerWithTheUTXO][j] = miners[minerWithTheUTXO][
                        totalUtxosOfOneMiner - 1
                    ];
                    utxosFound+=1;
                    miners[minerWithTheUTXO].pop();
                    break;
                }
            }
        }
        whitelistedUTXOs -= utxosFound;
        checkFeatureNeedDisabled();
    }

    function update(UTXO memory utxoToReplace, UTXO memory newUTXO)
        public
        checkIfAdminGovOr0Address
    {
        address minerAddress = _utxoMapping[hashUTXO(utxoToReplace)];
        UTXO[] memory utxosToCheck = miners[minerAddress];
        uint256 totalUtxosOfOneMiner = utxosToCheck.length;
        for (uint256 i = 0; i < totalUtxosOfOneMiner; i++) {
            if (checkTwoUTXOEquality(utxosToCheck[i], utxoToReplace)) {
                miners[minerAddress][i] = newUTXO;
                break;
            }
        }
    }

    function updateWithAddress(
        address minerAddress,
        UTXO memory utxoToReplace,
        UTXO memory newUTXO
    ) public checkIfAdminGovOr0Address checkIfMiner(minerAddress) {
        UTXO[] memory utxosToCheck = miners[minerAddress];

        uint256 totalUtxosOfOneMiner = utxosToCheck.length;

        for (uint256 i = 0; i < totalUtxosOfOneMiner; i++) {
            if (checkTwoUTXOEquality(utxosToCheck[i], utxoToReplace)) {
                miners[minerAddress][i] = newUTXO;
                break;
            }
        }
    }

    /**
    * @dev Execute result of the vode
    Simple majority voting
    * @return bool : Reuturn if the the miner address has the utxo eligible to be miner
    */
    function usable(address minerAddress, UTXO memory utxo)
        public
        view
        returns (bool)
    {
        if (!hasRole(MINER_ROLE, minerAddress)) {
            return false;
        }
        UTXO[] memory utxosToCheck = miners[minerAddress];

        uint256 totalUtxosOfOneMiner = utxosToCheck.length;

        for (uint256 i = 0; i < totalUtxosOfOneMiner; i++) {
            if (checkTwoUTXOEquality(utxosToCheck[i], utxo)) {
                return true;
            }
        }
        return false;
    }

    function getUTXOs(address minerAddress)
        public
        view
        returns (UTXO[] memory)
    {
        require(isMiner(minerAddress), "Not a miner");
        return miners[minerAddress];
    }
}
