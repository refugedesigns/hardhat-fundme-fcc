const { getNamedAccounts, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { expect } = require("chai")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("FundMe", function () {
      let fundMe
      let deployer
      let mockV3Aggregator
      const sendValue = ethers.utils.parseEther("1")
      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        fundMe = await ethers.getContract("FundMe", deployer)
        mockV3Aggregator = await ethers.getContract(
          "MockV3Aggregator",
          deployer
        )
      })

      describe("constructor", function () {
        it("should set the aggregator address correctly", async () => {
          const response = await fundMe.getPriceFeed()
          expect(response).to.equal(mockV3Aggregator.address)
        })
      })

      describe("fund", function () {
        it("fails if you don't send enouth ETH", async () => {
          await expect(fundMe.fund()).to.be.revertedWithCustomError(
            fundMe,
            "FundMe__NotEnoughETH"
          )
        })

        it("should update the amount funded data structure", async () => {
          await fundMe.fund({ value: sendValue })
          const response = await fundMe.getAddressToAmountFunded(deployer)
          expect(response.toString()).to.be.equal(sendValue.toString())
        })

        it("should add funders to Array", async () => {
          await fundMe.fund({ value: sendValue })
          const funder = await fundMe.getFunders(0)
          expect(funder).to.be.equal(deployer)
        })
      })

      describe("withdraw", function () {
        beforeEach(async () => {
          await fundMe.fund({ value: sendValue })
        })

        it("should withdraw all the balance in the contract", async () => {
          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait(1)
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const totalGasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          expect(endingFundMeBalance).to.be.equal(0)
          expect(
            startingFundMeBalance.add(startingDeployerBalance).toString()
          ).to.be.equal(endingDeployerBalance.add(totalGasCost).toString())
        })

        it("should allow to withdraw with multiple funders", async () => {
          const accounts = await ethers.getSigners()

          for (let i = 1; i < 6; i++) {
            const fundMeConnectedContract = await fundMe.connect(accounts[i])

            await fundMeConnectedContract.fund({ value: sendValue })
          }

          const startingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const startingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          const transactionResponse = await fundMe.withdraw()
          const transactionReceipt = await transactionResponse.wait(1)
          const { gasUsed, effectiveGasPrice } = transactionReceipt
          const totalGasCost = gasUsed.mul(effectiveGasPrice)

          const endingFundMeBalance = await fundMe.provider.getBalance(
            fundMe.address
          )
          const endingDeployerBalance = await fundMe.provider.getBalance(
            deployer
          )

          expect(endingFundMeBalance).to.be.equal(0)
          expect(
            startingFundMeBalance.add(startingDeployerBalance).toString()
          ).to.be.equal(endingDeployerBalance.add(totalGasCost).toString())

          await expect(fundMe.getFunders(0)).to.be.reverted

          for (let i = 1; i < 6; i++) {
            expect(
              await fundMe.getAddressToAmountFunded(accounts[i].address)
            ).to.be.equal(0)
          }
        })

        it("should only allow owner to withdraw", async () => {
          const accounts = await ethers.getSigners()
          const attacker = accounts[1]
          const attackerConnectedContract = await fundMe.connect(attacker)

          await expect(
            attackerConnectedContract.withdraw()
          ).to.be.revertedWithCustomError(fundMe, "FundMe__NotOwner")
        })
      })
    })
