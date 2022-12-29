// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

interface IQtumGov {
   function getAddressesList(uint _type) external view returns (address[] memory);
}