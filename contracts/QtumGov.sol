// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "./interfaces/ISyncable.sol";

contract QtumGov{

	struct paramsInstance{
		uint blockHeight;
		address paramsAddress;
	}

	paramsInstance[] paramsHistory;
	address[] adminKeys;
	address[] govKeys; 
	uint private maxKeys=30;
	bool private _contractAddressesSet;

	address private _validatorContractAddress;
	address private _poaContractAddress;
	
	uint private proposalExpiryBlocks=21600;

	struct addressProposal{
		bool onVote;
		address[] votes;
		address proposal;
		uint proposalHeight;
	}

	struct uintProposal{
		bool onVote;
		address[] votes;
		uint proposal;
		uint proposalHeight;
	}

	struct proposals{
		mapping(uint=>addressProposal) keys;
		mapping(uint=>uintProposal) uints;
		mapping(uint=>addressProposal) removeKeys;
	}

	struct votesRequired{
		uint adminVotesForParams;
		uint govVotesForParams;
		uint adminVotesForManagement;
	}

	proposals currentProposals;
	votesRequired activeVotesRequired;

	constructor(address[] memory intialAdmins, address[] memory initialGovs){
		adminKeys = intialAdmins;
		govKeys = initialGovs;
		uint halfVote = intialAdmins.length/2;
		activeVotesRequired = votesRequired(halfVote, govKeys.length/2, halfVote);
	}

	function getProposalToAdd() external view returns(addressProposal memory) {
		return currentProposals.keys[0];
	}

	function setContracts(address __validatorContractAddress, address __poaContractAddress) public onlyAdmin {
		require(!_contractAddressesSet, "Can call once");
        _validatorContractAddress = __validatorContractAddress;
		_poaContractAddress = __poaContractAddress;
		_contractAddressesSet = true;
    }

	modifier checkIfContractsSet() {
        require(_validatorContractAddress != address(0), "Validator address not set");
        require(_poaContractAddress != address(0), "Validator address not set");
		_;
	}

	function isAdminKey(address _adminAddress) public view returns (bool isAdmin){
		uint i;
		for(i=0;i<adminKeys.length;i++){
			if(adminKeys[i]==_adminAddress)return true;
		}
		return false;
	} 

	function isGovKey(address _govAddress) public view returns (bool isGov){
		uint i;
		for(i=0;i<govKeys.length;i++){
			if(govKeys[i]==_govAddress)return true;
		}
		return false;
	} 

	modifier onlyAdmin{
		require(isAdminKey(msg.sender), "Not admin");
		_;
	}

	modifier onlyAdminOrGov{
		require(isAdminKey(msg.sender) || isGovKey(msg.sender), "Not admin or gov");
		_;
	}

	

	function addAddressProposal(address _proposalAddress, uint _type) external onlyAdminOrGov checkIfContractsSet{
		// type 0: adminKey
		// type 1: govKey
		// type 2: paramsAddress
		if(_type==0) require(getArrayNonNullLength(adminKeys) < maxKeys, "Too many admin keys"); // we have too many admin keys
		if(_type==1) require(getArrayNonNullLength(govKeys) < maxKeys, "Too many gov keys"); // we have too many gov keys
		require(_proposalAddress!=address(0), "Invalid address"); // invalid address
		require(_type<=2, "Invalid type"); // invalid type
		if((_type==0 || _type==1)){
			require(!(isAdminKey(_proposalAddress) && !isGovKey(_proposalAddress)), "don't add existing keys as proposals") ; // don't add existing keys as proposals
		} 
		if(!currentProposals.keys[_type].onVote){
			require(isAdminKey(msg.sender), "Only Admin can initiate vote"); // Only Admin can initiate vote
			currentProposals.keys[_type].onVote=true; // put proposal on vote, no changes until vote is setteled or removed
			currentProposals.keys[_type].proposal=_proposalAddress; // set new proposal for vote
			currentProposals.keys[_type].proposalHeight=block.number; // set new proposal initial height
			delete currentProposals.keys[_type].votes; // clear votes
			currentProposals.keys[_type].votes.push(msg.sender); // add sender vote
		}else{
			if(block.number-currentProposals.keys[_type].proposalHeight>proposalExpiryBlocks){
				clearAddressProposal(_type); //clear expired proposals
				return;
			}
			require(currentProposals.keys[_type].proposal==_proposalAddress, "Can only vote for current on vote address"); // can only vote for current on vote address
			require(!alreadyVoted(msg.sender, currentProposals.keys[_type].votes), "Cannot vote twice"); // cannot vote twice			
			currentProposals.keys[_type].votes.push(msg.sender); // add sender vote
		}
		if(_type==0 || _type==1){
			if(tallyAdminVotes(currentProposals.keys[_type].votes)>=activeVotesRequired.adminVotesForManagement){
				require(!isAdminKey(currentProposals.keys[_type].proposal) && !isGovKey(currentProposals.keys[_type].proposal), "Don't add existing keys") ; // don't add existing keys
				if(_type==0){
					adminKeys.push(currentProposals.keys[_type].proposal); // elected
					ISyncable(_validatorContractAddress).addAdminAddress(currentProposals.keys[_type].proposal);
					ISyncable(_poaContractAddress).addAdminAddress(currentProposals.keys[_type].proposal);
					activeVotesRequired.adminVotesForParams = adminKeys.length/2;
				}
				if(_type==1){
					govKeys.push(currentProposals.keys[_type].proposal); // elected
					ISyncable(_validatorContractAddress).addGovAddress(currentProposals.keys[_type].proposal);
					ISyncable(_poaContractAddress).addGovAddress(currentProposals.keys[_type].proposal);
				}
				clearAddressProposal(_type);
			}
		}
		if(_type==2){
			if(tallyAdminVotes(currentProposals.keys[_type].votes)>=activeVotesRequired.adminVotesForParams && tallyGovVotes(currentProposals.keys[_type].votes)>=activeVotesRequired.govVotesForParams){
				require(paramsHistory.length==0 || paramsHistory[paramsHistory.length-1].blockHeight!=block.number+1, "don't add activate params on a height having existing params"); // don't add activate params on a height having existing params
				paramsHistory.push(paramsInstance(block.number+1,currentProposals.keys[_type].proposal)); // save params activation block and address				
				clearAddressProposal(_type);
			}
		}
	}

	function removeAddressProposal(address _proposalAddress, uint _type) external onlyAdmin checkIfContractsSet{
		// type 0: adminKey
		// type 1: govKey
		require(_proposalAddress!=address(0), "Invalid address"); // invalid address
		require(_type<=1, "Invalid type") ; // invalid type
		if(_type==0){
		uint adminsCount=getArrayNonNullLength(adminKeys);
		require(adminsCount!=activeVotesRequired.adminVotesForParams && adminsCount!=activeVotesRequired.adminVotesForManagement, "Cannot reduce the number of admins below the required ones") ; // cannot reduce the number of admins below the required ones
		require(isAdminKey(_proposalAddress), "Don't remove non existent address") ; // don't remove non existent address
		}
		if(_type==1){
		require(getArrayNonNullLength(govKeys)!=activeVotesRequired.govVotesForParams, "Cannot reduce the number of govs below the required ones"); // cannot reduce the number of govs below the required ones
		require(isGovKey(_proposalAddress), "Don't remove non existent address"); // don't remove non existent address
		}
		if(!currentProposals.removeKeys[_type].onVote){
			currentProposals.removeKeys[_type].onVote=true; // put proposal on vote, no changes until vote is setteled or removed
			currentProposals.removeKeys[_type].proposal=_proposalAddress; // set new proposal for vote
			currentProposals.removeKeys[_type].proposalHeight=block.number; // set new proposal initial height
			delete currentProposals.removeKeys[_type].votes; // clear votes
			currentProposals.removeKeys[_type].votes.push(msg.sender); // add sender vote
		}else{
			if(block.number-currentProposals.removeKeys[_type].proposalHeight>proposalExpiryBlocks){
				clearAddressRemovalProposal(_type); //clear expired proposals
				return;
			}
			require(currentProposals.removeKeys[_type].proposal==_proposalAddress, "Can only vote for current on vote address"); // can only vote for current on vote address
			require(!alreadyVoted(msg.sender, currentProposals.removeKeys[_type].votes), "Cannot vote twice"); // cannot vote twice			
			currentProposals.removeKeys[_type].votes.push(msg.sender); // add sender vote
		}
		if(tallyAdminVotes(currentProposals.removeKeys[_type].votes)>=activeVotesRequired.adminVotesForManagement){
			if(_type==0 && isAdminKey(currentProposals.removeKeys[_type].proposal)){
				deleteAddress(_type, currentProposals.removeKeys[_type].proposal); // elected
				ISyncable(_validatorContractAddress).removeAdminAddress(currentProposals.removeKeys[_type].proposal);
				ISyncable(_poaContractAddress).removeAdminAddress(currentProposals.removeKeys[_type].proposal);
			    activeVotesRequired.adminVotesForParams = adminKeys.length/2;
			}			
			if(_type==1 && isGovKey(currentProposals.removeKeys[_type].proposal)){
				deleteAddress(_type, currentProposals.removeKeys[_type].proposal); // elected
				ISyncable(_validatorContractAddress).removeGovAddress(currentProposals.removeKeys[_type].proposal);
				ISyncable(_poaContractAddress).removeGovAddress(currentProposals.removeKeys[_type].proposal);
			    activeVotesRequired.govVotesForParams = govKeys.length/2;

			}
			uint i;
			for(i=0;i<3;i++){
				clearAddressProposal(i); // clear any pending address votes because voters list changed
			}
			clearAddressRemovalProposal(_type);
		}
	}

	function clearAddressProposal(uint _type) private{
		currentProposals.keys[_type].proposal=address(0); // clear current proposal address
		delete currentProposals.keys[_type].votes; // clear votes
		currentProposals.keys[_type].proposalHeight=0; // clear proposal height
		currentProposals.keys[_type].onVote=false; // open submission
	}

	function clearAddressRemovalProposal(uint _type) private{
		currentProposals.removeKeys[_type].proposal=address(0); // clear current proposal address
		delete currentProposals.removeKeys[_type].votes; // clear votes
		currentProposals.removeKeys[_type].proposalHeight=0; // clear proposal height
		currentProposals.removeKeys[_type].onVote=false; // open submission
	}

	function deleteAddress(uint _type, address _address) private{
		uint i;
		if(_type==0)
		for(i=0;i<adminKeys.length;i++){
			if(adminKeys[i]==_address){
				adminKeys[i] = adminKeys[adminKeys.length - 1];
				adminKeys.pop();
				break;
			}
		}
		if(_type==1)
		for(i=0;i<govKeys.length;i++){
			if(govKeys[i]==_address){
				govKeys[i] = govKeys[govKeys.length - 1];
				govKeys.pop();
				break;
			}
		}
	}

	function changeValueProposal(uint _proposalUint, uint _type) external onlyAdmin{
		// type 0: adminVotesForParams
		// type 1: govVotesForParams
		// type 2: adminVotesForManagement
		require(_type<=2, "Invalid type"); // invalid type
		if(_type==0 || _type==2) require( _proposalUint <= getArrayNonNullLength(adminKeys), "Required number cannot be greater than active admin keys count"); // required number cannot be greater than active admin keys count
		if(_type==1)require(_proposalUint <= getArrayNonNullLength(govKeys), "Required number cannot be greater than active gov keys count") ; // required number cannot be greater than active gov keys count
		if(_type==0)require(activeVotesRequired.adminVotesForParams!=_proposalUint, "Cannot put a proposal for the same active value"); // cannot put a proposal for the same active value
		if(_type==1)require(activeVotesRequired.govVotesForParams!=_proposalUint, "Cannot put a proposal for the same active value"); // cannot put a proposal for the same active value
		if(_type==2)require(activeVotesRequired.adminVotesForManagement!=_proposalUint, "Cannot put a proposal for the same active value"); // cannot put a proposal for the same active value
		if(!currentProposals.uints[_type].onVote){
			currentProposals.uints[_type].onVote=true; // put proposal on vote, no changes until vote is setteled or removed
			currentProposals.uints[_type].proposal=_proposalUint; // set new proposal for vote
			currentProposals.uints[_type].proposalHeight=block.number; // set new proposal initial height
			delete currentProposals.uints[_type].votes; // clear votes
			currentProposals.uints[_type].votes.push(msg.sender); // add sender vote
		}else{
			if(block.number-currentProposals.uints[_type].proposalHeight>proposalExpiryBlocks){
				clearChangeValueProposal(_type); //clear expired proposals
				return;
			}
			require(currentProposals.uints[_type].proposal==_proposalUint, "Can only vote for current on vote value"); // can only vote for current on vote value
			require(!alreadyVoted(msg.sender, currentProposals.uints[_type].votes), "Cannot vote twice"); // cannot vote twice			
			currentProposals.uints[_type].votes.push(msg.sender); // add sender vote
		}
		if(tallyAdminVotes(currentProposals.uints[_type].votes)>=activeVotesRequired.adminVotesForManagement){
			if(_type==0 || _type==1){
				clearAddressProposal(2); // clear any pending params address votes because of rule change
			}
			if(_type==0)activeVotesRequired.adminVotesForParams=currentProposals.uints[_type].proposal; // elected
			if(_type==2){
				clearAddressProposal(0); // clear any pending adminKey address votes because of rule change
				clearAddressProposal(1); // clear any pending govKey address votes because of rule change
			}
			if(_type==1)activeVotesRequired.govVotesForParams=currentProposals.uints[_type].proposal; // elected
			if(_type==2)activeVotesRequired.adminVotesForManagement=currentProposals.uints[_type].proposal; // elected
			clearChangeValueProposal(_type);
		}
	}

	function clearChangeValueProposal(uint _type) private{
		currentProposals.uints[_type].proposal=0; // clear current proposal address
		delete currentProposals.uints[_type].votes; // clear votes
		currentProposals.uints[_type].proposalHeight=0; // clear proposal height
		currentProposals.uints[_type].onVote=false; // open submission
	}

	

	function alreadyVoted(address _voterAddress, address[] memory votes) internal pure returns (bool voted){
		uint i;
		for(i=0;i<votes.length;i++){
			if(votes[i]==_voterAddress)return true;
		}
		return false;
	}

	function tallyAdminVotes(address[] memory votes) internal view returns (uint votesCount){
		uint i;
		uint count=0;
		for(i=0;i<votes.length;i++){
			if(votes[i]!=address(0) && isAdminKey(votes[i]))count++;
		}
		return count;
	}

	function tallyGovVotes(address[] memory votes) internal view returns (uint votesCount){
		uint i;
		uint count=0;
		for(i=0;i<votes.length;i++){
			if(votes[i]!=address(0) && isGovKey(votes[i]))count++;
		}
		return count;
	}

	function getArrayNonNullLength(address[] memory valsArr) internal pure returns (uint valsCount){
		uint i;
		uint count=0;
		for(i=0;i<valsArr.length;i++){
			if(valsArr[i]!=address(0))count++;
		}
		return count;
	}

	function getAddressesList(uint _type) external view returns (address[] memory vals){
		// type 0: adminKeys
		// type 1: govKeys
		require(_type<=1, "Invalid type"); // invalid type
		if(_type==0)return adminKeys;
		if(_type==1)return govKeys;
	}

	function getRequiredVotes(uint _type) external view returns (uint val){
		// type 0: adminVotesForParams
		// type 1: govVotesForParams
		// type 2: adminVotesForManagement
		require(_type<=2, "Invalid type"); // invalid type
		if(_type==0)return activeVotesRequired.adminVotesForParams;
		if(_type==1)return activeVotesRequired.govVotesForParams;
		if(_type==2)return activeVotesRequired.adminVotesForManagement;
	}

	function getCurrentOnVoteStatus(uint _type, uint _type2) external view returns (bool val){
		// type 0: addAddress
		// type 1: changeValue
		// type 2: removeAddress	

		// type2 0: adminKey
		// type2 1: govKey
		// type2 2: paramsAddress

		require(_type<=2 && _type2<=2, "Invalid type"); // invalid type
		if(_type==0)return currentProposals.keys[_type2].onVote;
		if(_type==1)return currentProposals.uints[_type2].onVote;
		if(_type==2)return currentProposals.removeKeys[_type2].onVote;
	}

	function getCurrentOnVoteVotes(uint _type, uint _type2) external view returns (address[] memory vals){
		// type 0: addAddress
		// type 1: changeValue
		// type 2: removeAddress

		// type2 0: adminKey
		// type2 1: govKey
		// type2 2: paramsAddress

		require(_type<=2 && _type2<=2, "Invalid type"); // invalid type
		if(_type==0)return currentProposals.keys[_type2].votes;
		if(_type==1)return currentProposals.uints[_type2].votes;
		if(_type==2)return currentProposals.removeKeys[_type2].votes;
	}

	function getCurrentOnVoteAddressProposal(uint _type, uint _type2) external view returns (address val){
		// type 0: addAddress
		// type 1: removeAddress

		// type2 0: adminKey
		// type2 1: govKey
		// type2 2: paramsAddress

		require(_type<=1 && _type2<=2, "Invalid type"); // invalid type
		if(_type==0)return currentProposals.keys[_type2].proposal;
		if(_type==1)return currentProposals.removeKeys[_type2].proposal;
	}

	function getCurrentOnVoteValueProposal(uint _type) external view returns (uint val){
		// type 0: adminVotesForParams
		// type 1: govVotesForParams
		// type 2: adminVotesForManagement

		require(_type<=2, "Invalid type"); // invalid type
		return currentProposals.uints[_type].proposal;
	}

	function getParamsForBlock(uint _reqBlockHeight) external view returns (address paramsAddress){
		if(paramsHistory.length==0)return address(0);
		uint i;
		for(i=paramsHistory.length-1;i>0;i--){
			if(paramsHistory[i].blockHeight<=_reqBlockHeight)return paramsHistory[i].paramsAddress;
		}
		if(paramsHistory[0].blockHeight<=_reqBlockHeight)return paramsHistory[0].paramsAddress;
		return address(0);
	}

	function getParamAddressAtIndex(uint _paramIndex) external  view returns (address paramsAddress){
		return paramsHistory[_paramIndex].paramsAddress;
	}

	function getParamHeightAtIndex(uint _paramIndex) external view returns (uint paramsHeight){
		return paramsHistory[_paramIndex].blockHeight;
	}

	function getParamCount() external view returns (uint paramsCount){
		return paramsHistory.length;
	}
}