module.exports = {
  networks: {
    janus: {
      host: "127.0.0.1",
      port: 23889,
      network_id: "*",
      gasPrice: "0x64",
      gas: "10000000",
      confirmations: 1,
      disableConfirmationListener: true,
    },
  },
  compilers: {
    solc: {
      version: "0.8.15",
    },
  },
};
