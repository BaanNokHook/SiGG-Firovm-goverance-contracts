// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.15;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IQtumGov.sol";
import "./interfaces/ISyncable.sol";

contract MobileValidator is AccessControl,ISyncable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");

    bool private _isDisabled;

    enum ValidatorFeatureStatus {
        Enabled, 
        Prepared, 
        Disabled 
    }

    IQtumGov private _qtumGovContract;
    uint256 public minMobileValidators;
    uint256 public totalActiveMobileValidators;

    // @dev validator id => public key
    mapping(bytes32 => bytes) private _mobileValidator;

    mapping(bytes32 => bool) private _banStatus;

    // 2 weeks in seconds = 1209600
    uint128 private votingPeriod = 1209600;

    enum VoteType {
        Against,
        For,
        Abstain
    }

    enum Status {
        OnGoing,
        Cancelled,
        VerdictPending,
        ProposalSucceeded,
        ProposalVotedOut
    }

  
    uint256 public  waitingBlock;

    struct ValidatorProposalDetail {
        address proposer;
        uint256 startTime;
        Status status;
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
        mapping(address => bool) hasVoted;
        bytes32 proposedValidatorID;
        bytes proposedPublicKey;
    }

    mapping(uint256 => ValidatorProposalDetail) private _validatorProposals;
    uint256 private _totalAdminOrGovs;

    event CastProposalVote(
        uint256 indexed validatorProposalID,
        address voter,
        VoteType voteType,
        uint256 timestamp
    );

    event VotingPeriodOver(uint256 validatorProposalID);

    event ProposalVoteSucceeded(
        uint256 indexed validatorProposalID,
        bytes32 validatorID,
        uint256 timestamp
    );

    event ProposalVoteFailed(
        uint256 indexed validatorProposalID,
        bytes32 rejectedValidatorID,
        uint256 timestamp
    );

    event AddValidatorProposal(uint256 validatorProposalID);

    event BanValidator(
        bytes32 validatorId,
        address banerAdmin,
        uint256 timestamp
    );

    event UnbanValidator(
        bytes32 validatorId,
        address unbanerAdmin,
        uint256 timestamp
    );

    event UpdateTimeStamp(
        uint256 previousVotingPeriod,
        uint256 updatedVotingPeriod,
        address adminAddress
    );

    event AddValidator(bytes32 validatorId, bytes publicKey);

    modifier checkQtumContractAddress() {
        require(
            msg.sender == address(_qtumGovContract),
            "Not qtum contract address"
        );
        _;
    }

    modifier checkIfAdminOrGov() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender),
            "Not a admin or gov acoount"
        );
        _;
    }

    modifier checkIfAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not a admin acoount");
        _;
    }

    modifier checkIfValidatorDontExist(bytes32 _validatorID) {
        require(
            _mobileValidator[_validatorID].length == 0,
            "Validator already exist"
        );
        _;
    }

    modifier checkIfValidatorExist(bytes32 _validatorID) {
        require(
            _mobileValidator[_validatorID].length > 0,
            "Validator already exist"
        );
        _;
    }

    modifier checkIfNotBanned(bytes32 _validatorID) {
        require(!_banStatus[_validatorID], "Validator is already banned");
        _;
    }

    modifier checkIfBanned(bytes32 _validatorID) {
        require(_banStatus[_validatorID], "Validator is not banned");
        _;
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
        minMobileValidators = 1000;
        _isDisabled = true;
    }

    function checkHasAdminRole() external view returns(bool) {
        return hasRole(ADMIN_ROLE, msg.sender);
    }

    function checkHasGovRole() external view returns(bool) {
        return hasRole(GOV_ROLE, msg.sender);
    }

    function changeMinMobileValidator(uint256 newMinMobileValidator) external checkIfAdmin {
        require(minMobileValidators != newMinMobileValidator, "No new min number given");
        uint256 prevMinMobileValidator = minMobileValidators;   
        minMobileValidators = newMinMobileValidator;
        if(newMinMobileValidator > prevMinMobileValidator){
            checkValidatorFeatureNeedDisabled();
        }
        else{
            checkValidatorFeatureNeedEnabled();
        }
        
    }

    function isValidator(bytes32 validatorID) external view returns(bool){
        return _mobileValidator[validatorID].length > 0;
    }

    function status() public view returns(ValidatorFeatureStatus) {
        if (_isDisabled) {
            return ValidatorFeatureStatus.Disabled;
        } else {
            if(waitingBlock < block.number){
                return ValidatorFeatureStatus.Enabled;
            }
            else{
                return ValidatorFeatureStatus.Prepared;
            }
        }
    }

    function checkValidatorFeatureNeedEnabled() internal {
        if(_isDisabled){
            if(totalActiveMobileValidators >= minMobileValidators){
                _isDisabled = false;
                waitingBlock = block.number + 960;
            }
        }
    }

    function checkValidatorFeatureNeedDisabled() internal {
        if(!_isDisabled){
            if(totalActiveMobileValidators < minMobileValidators){
                _isDisabled = true;
            }
        }
    }

    function changeToPrepared() external checkIfAdmin {
        require(_isDisabled, "Not in disabled state");
        waitingBlock = block.number + 960;
        _isDisabled = false;
    }

    function changeToEnabled() external checkIfAdmin {
        require(!_isDisabled, "Not in prepared state");
        require(waitingBlock > block.number, "Already enabled");
        waitingBlock = block.number-1;
    }

    function changeFromPreparedToDisable() external checkIfAdmin {
        require(!_isDisabled, "Already disabled");
        require(waitingBlock >= block.number, "Not in prepared state");
        _isDisabled = true;
    }

     function changeFromEnabledToDisable() external checkIfAdmin {
        require(!_isDisabled, "Already disabled");
        require(waitingBlock < block.number, "Not in enabled state");
        _isDisabled = true;
    }

    function isBanned(bytes32 validatorID) external view returns(bool) {
        return _banStatus[validatorID];
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

    function hashValidatorProposal(
        bytes32 _validatorID,
        bytes memory _publicKey
    ) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(_validatorID, _publicKey)));
    }

    function checkIfValidatorProposalIdDontExist(uint256 _validatorProposalID)
        internal
        view
    {
        require(
            _validatorProposals[_validatorProposalID].startTime == 0,
            "Validator Proposal already exist"
        );
    }

    function checkIfValidatorProposalIdExist(uint256 _validatorProposalID)
        internal
        view
    {
        require(
            _validatorProposals[_validatorProposalID].startTime != 0,
            "Validator do not exist"
        );
    }

    function proposeValidator(
        bytes32 validatorID,
        bytes memory publicKey,
        bool forVote
    ) public checkIfAdmin checkIfValidatorDontExist(validatorID) {
        uint256 validatorProposalID = hashValidatorProposal(
            validatorID,
            publicKey
        );
        checkIfValidatorProposalIdDontExist(validatorProposalID);
        ValidatorProposalDetail storage newProposalDetail = _validatorProposals[
            validatorProposalID
        ];
        newProposalDetail.proposer = msg.sender;
        newProposalDetail.startTime = block.timestamp;
        newProposalDetail.status = Status.OnGoing;
        newProposalDetail.againstVotes = 0;
        newProposalDetail.forVotes = forVote ? 1 : 0;
        newProposalDetail.abstainVotes = forVote ? 0 : 1;
        newProposalDetail.hasVoted[msg.sender] = true;
        newProposalDetail.proposedValidatorID = validatorID;
        newProposalDetail.proposedPublicKey = publicKey;

        emit AddValidatorProposal(validatorProposalID);
    }

    /**
     * @dev CHeck total vote for, votes againstr, abstain is greater than more than half voters
        @return bool true -> over 59% voter have voted
     */
    function checkOverHalfVoted(uint256 proposalID) public view returns (bool) {
        return
            _validatorProposals[proposalID].forVotes +
                _validatorProposals[proposalID].againstVotes +
                _validatorProposals[proposalID].abstainVotes >
            _totalAdminOrGovs / 2;
    }

    function getProposedValidator(uint256 _validatorProposalID)
        public
        view
        returns (bytes32 validatorID, bytes memory publicKey)
    {
        checkIfValidatorProposalIdExist(_validatorProposalID);
        return (
            _validatorProposals[_validatorProposalID].proposedValidatorID,
            _validatorProposals[_validatorProposalID].proposedPublicKey
        );
    }

    function getValidatorProposalDetails(uint256 _validatorProposalID)
        public
        view
        returns (
            address proposer,
            uint256 startTime,
            Status votingstatus,
            uint256 againstVotes,
            uint256 forVotes,
            uint256 abstainVotes
        )
    {
        checkIfValidatorProposalIdExist(_validatorProposalID);
        return (
            _validatorProposals[_validatorProposalID].proposer,
            _validatorProposals[_validatorProposalID].startTime,
            _validatorProposals[_validatorProposalID].status,
            _validatorProposals[_validatorProposalID].againstVotes,
            _validatorProposals[_validatorProposalID].forVotes,
            _validatorProposals[_validatorProposalID].abstainVotes
        );
    }

// probaly should not deploy in procution or at least give an lower bound
    function updateVotingPeriod(uint128 updatedTime) public checkIfAdmin {
        require(updatedTime != 0, "Voting period can't be 0");
        uint256 prevVotingPeriod = votingPeriod;
        votingPeriod = updatedTime;
        emit UpdateTimeStamp(prevVotingPeriod, updatedTime, msg.sender);
    }

    function _executeAddValidator(
        bytes32 _validatorIDToAdd,
        bytes memory _publicKeyToAdd
    ) internal checkIfValidatorDontExist(_validatorIDToAdd) {
        _mobileValidator[_validatorIDToAdd] = _publicKeyToAdd;
        totalActiveMobileValidators++;
        checkValidatorFeatureNeedEnabled();
        emit AddValidator(_validatorIDToAdd, _publicKeyToAdd);
    }

    function _executeVote(uint256 _validatorProposalID)
        internal
        returns (bool)
    {
        if (
            _validatorProposals[_validatorProposalID].forVotes >
            _validatorProposals[_validatorProposalID].againstVotes +
                _validatorProposals[_validatorProposalID].abstainVotes
        ) {
            _validatorProposals[_validatorProposalID].status = Status
                .ProposalSucceeded;
            _executeAddValidator(
                _validatorProposals[_validatorProposalID].proposedValidatorID,
                _validatorProposals[_validatorProposalID].proposedPublicKey
            );
            emit ProposalVoteSucceeded(
                _validatorProposalID,
                _validatorProposals[_validatorProposalID].proposedValidatorID,
                block.timestamp
            );
            return true;
        }
        _validatorProposals[_validatorProposalID].status = Status
            .ProposalVotedOut;
        emit ProposalVoteFailed(
            _validatorProposalID,
            _validatorProposals[_validatorProposalID].proposedValidatorID,
            block.timestamp
        );
        return false;
    }

    /**
     * @dev Vote for, against for a proposal or abstain from a proposal
        voteCasted expected values:
        0 => Abstain
        1 => Vote for
        2 => Vote against
     */
    function vote(uint256 validatorProposalID, uint8 voteCasted)
        external
        checkIfAdminOrGov
    {
        require(voteCasted < 3, "Not a valid vote");
        checkIfValidatorProposalIdExist(validatorProposalID);
        require(
            !_validatorProposals[validatorProposalID].hasVoted[msg.sender],
            "Already voted"
        );
        require(
            (_validatorProposals[validatorProposalID].startTime +
                votingPeriod) > block.timestamp,
            "Voting is over"
        );
        require(
            _validatorProposals[validatorProposalID].status == Status.OnGoing,
            "Voting proposal no longer active"
        );
        VoteType voteType;
        if (voteCasted == 0) {
            _validatorProposals[validatorProposalID].abstainVotes += 1;
            voteType = VoteType.Abstain;
        } else if (voteCasted == 1) {
            _validatorProposals[validatorProposalID].forVotes += 1;
            voteType = VoteType.For;
        } else {
            _validatorProposals[validatorProposalID].againstVotes += 1;
            voteType = VoteType.Against;
        }
        _validatorProposals[validatorProposalID].hasVoted[msg.sender] = true;
        emit CastProposalVote(
            validatorProposalID,
            msg.sender,
            voteType,
            block.timestamp
        );
        uint256 halfVotes = _totalAdminOrGovs / 2;
        if (
            _validatorProposals[validatorProposalID].forVotes > halfVotes ||
            _validatorProposals[validatorProposalID].againstVotes > halfVotes
        ) {
            _executeVote(validatorProposalID);
        }
    }

    /**
     * @dev End voting period
     */
    function endVotingPeriod(uint256 validatorProposalID) public checkIfAdmin {
        checkIfValidatorProposalIdExist(validatorProposalID);
        if (
            _validatorProposals[validatorProposalID].startTime + votingPeriod >
            block.timestamp
        ) {
            _validatorProposals[validatorProposalID].status = Status
                .VerdictPending;
        }
        emit VotingPeriodOver(validatorProposalID);
    }

    // This could be optional
    function cancelVote(uint256 validatorProposalID) public checkIfAdmin {
        checkIfValidatorProposalIdExist(validatorProposalID);
        require(
            !checkOverHalfVoted(validatorProposalID),
            "More than half voted"
        );
        require(
            _validatorProposals[validatorProposalID].status == Status.OnGoing ||
                _validatorProposals[validatorProposalID].status ==
                Status.VerdictPending,
            "Voting proposal no longer active"
        );
        _validatorProposals[validatorProposalID].status = Status.Cancelled;
    }

    /**
     * @dev Delete proposals that have reached verdict to get some extra gas and save space
     */
    function deleteProposal(uint256 validatorProposalID) public checkIfAdmin {
        checkIfValidatorProposalIdExist(validatorProposalID);
        require(
            _validatorProposals[validatorProposalID].status ==
                Status.ProposalSucceeded ||
                _validatorProposals[validatorProposalID].status ==
                Status.ProposalVotedOut,
            "Proposal still have no verdict"
        );
        delete _validatorProposals[validatorProposalID];
    }

    /**
    * @dev Execute result of the vote in case voting period is over but majority not reached
    Simple majority voting
    * @return bool : Reuturn if the propsoal is successful or not
    */
    function executeVote(uint256 validatorProposalID)
        public
        checkIfAdmin
        returns (bool)
    {
        checkIfValidatorProposalIdExist(validatorProposalID);
        require(
            _validatorProposals[validatorProposalID].status ==
                Status.VerdictPending,
            "Voting not over"
        );
        return _executeVote(validatorProposalID);
    }

    function banValidator(bytes32 validatorID)
        public
        checkIfAdmin
        checkIfValidatorExist(validatorID)
        checkIfNotBanned(validatorID)
    {
        _banStatus[validatorID] = true;
        totalActiveMobileValidators--;
        checkValidatorFeatureNeedDisabled();
        emit BanValidator(validatorID, msg.sender, block.timestamp);
    }

    function unbanValidator(bytes32 validatorID)
        public
        checkIfAdmin
        checkIfValidatorExist(validatorID)
        checkIfBanned(validatorID)
    {
        _banStatus[validatorID] = false;
        totalActiveMobileValidators++;
        checkValidatorFeatureNeedEnabled();
        emit UnbanValidator(validatorID, msg.sender, block.timestamp);
    }

    function getValidatorPubKey(bytes32 validatorID)
        public
        view
        checkIfValidatorExist(validatorID)
        checkIfNotBanned(validatorID)
        returns (bytes memory)
    {
        return _mobileValidator[validatorID];
    }
}
