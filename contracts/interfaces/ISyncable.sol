// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

interface ISyncable {
   function addAdminAddress(address) external;
   function removeAdminAddress(address) external;
   function addGovAddress(address) external;
   function removeGovAddress(address) external;
   
}