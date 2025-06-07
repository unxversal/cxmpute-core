/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { toUsdc } from "../../shared/constants";

describe("Treasury", function () {
  let treasury: any;
  let usdc: any;
  let weth: any;
  let owner: SignerWithAddress;
  let governance: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  async function deployTreasuryFixture() {
    const [owner, governance, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20Factory.deploy("USDC", "USDC", 6, 0);
    const weth = await MockERC20Factory.deploy("WETH", "WETH", 18, 0);

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    const treasury = await TreasuryFactory.deploy();

    // Setup initial state
    await (usdc as any).mint(owner.address, toUsdc("1000000"));
    await (weth as any).mint(owner.address, ethers.parseEther("1000"));

    return {
      treasury,
      usdc,
      weth,
      owner,
      governance,
      user1,
      user2
    };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployTreasuryFixture);
    treasury = fixture.treasury;
    usdc = fixture.usdc;
    weth = fixture.weth;
    owner = fixture.owner;
    governance = fixture.governance;
    user1 = fixture.user1;
    user2 = fixture.user2;
  });

  describe("Initialization", function () {
    it("Should set the correct owner", async function () {
      expect(await treasury.owner()).to.equal(owner.address);
    });

    it("Should have zero balance initially", async function () {
      expect(await treasury.getBalance(await usdc.getAddress())).to.equal(0);
    });
  });

  describe("Token Management", function () {
    it("Should whitelist tokens", async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      expect(await treasury.isWhitelisted(await usdc.getAddress())).to.be.true;
    });

    it("Should remove tokens from whitelist", async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      await treasury.whitelistToken(await usdc.getAddress(), false);
      expect(await treasury.isWhitelisted(await usdc.getAddress())).to.be.false;
    });

    it("Should only allow owner to whitelist tokens", async function () {
      await expect(
        treasury.connect(user1).whitelistToken(await usdc.getAddress(), true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should emit TokenWhitelisted event", async function () {
      await expect(treasury.whitelistToken(await usdc.getAddress(), true))
        .to.emit(treasury, "TokenWhitelisted")
        .withArgs(await usdc.getAddress(), true);
    });
  });

  describe("Fee Collection", function () {
    beforeEach(async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      await treasury.whitelistToken(await weth.getAddress(), true);
    });

    it("Should receive USDC fees", async function () {
      const amount = toUsdc("1000");
      await (usdc as any).transfer(await treasury.getAddress(), amount);
      
      expect(await treasury.getBalance(await usdc.getAddress())).to.equal(amount);
    });

    it("Should receive ETH fees", async function () {
      const amount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: amount
      });
      
      expect(await treasury.getBalance(ethers.ZeroAddress)).to.equal(amount);
    });

    it("Should track multiple token balances", async function () {
      const usdcAmount = toUsdc("1000");
      const wethAmount = ethers.parseEther("1");
      
      await (usdc as any).transfer(await treasury.getAddress(), usdcAmount);
      await (weth as any).transfer(await treasury.getAddress(), wethAmount);
      
      expect(await treasury.getBalance(await usdc.getAddress())).to.equal(usdcAmount);
      expect(await treasury.getBalance(await weth.getAddress())).to.equal(wethAmount);
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      await (usdc as any).transfer(await treasury.getAddress(), toUsdc("10000"));
    });

    it("Should allow owner to withdraw tokens", async function () {
      const amount = toUsdc("1000");
      const initialBalance = await usdc.balanceOf(owner.address);
      
      await treasury.withdraw(await usdc.getAddress(), amount, owner.address);
      
      expect(await usdc.balanceOf(owner.address)).to.equal(initialBalance + amount);
      expect(await treasury.getBalance(await usdc.getAddress())).to.equal(toUsdc("9000"));
    });

    it("Should allow owner to withdraw ETH", async function () {
      // Send ETH to treasury
      const ethAmount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await treasury.getAddress(),
        value: ethAmount
      });
      
      const withdrawAmount = ethers.parseEther("0.5");
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await treasury.withdraw(ethers.ZeroAddress, withdrawAmount, user1.address);
      
      expect(await ethers.provider.getBalance(user1.address)).to.equal(
        initialBalance + withdrawAmount
      );
    });

    it("Should only allow owner to withdraw", async function () {
      await expect(
        treasury.connect(user1).withdraw(await usdc.getAddress(), toUsdc("100"), user1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow withdrawing more than balance", async function () {
      await expect(
        treasury.withdraw(await usdc.getAddress(), toUsdc("20000"), owner.address)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should emit Withdrawal event", async function () {
      const amount = toUsdc("1000");
      await expect(treasury.withdraw(await usdc.getAddress(), amount, owner.address))
        .to.emit(treasury, "Withdrawal")
        .withArgs(await usdc.getAddress(), amount, owner.address);
    });
  });

  describe("Governance Integration", function () {
    it("Should transfer ownership to governance", async function () {
      await treasury.transferOwnership(governance.address);
      expect(await treasury.owner()).to.equal(governance.address);
    });

    it("Should allow governance to manage treasury", async function () {
      await treasury.transferOwnership(governance.address);
      
      await treasury.connect(governance).whitelistToken(await usdc.getAddress(), true);
      expect(await treasury.isWhitelisted(await usdc.getAddress())).to.be.true;
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      await (usdc as any).transfer(await treasury.getAddress(), toUsdc("10000"));
    });

    it("Should pause contract", async function () {
      await treasury.pause();
      expect(await treasury.paused()).to.be.true;
    });

    it("Should not allow operations when paused", async function () {
      await treasury.pause();
      
      await expect(
        treasury.withdraw(await usdc.getAddress(), toUsdc("100"), owner.address)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should unpause contract", async function () {
      await treasury.pause();
      await treasury.unpause();
      expect(await treasury.paused()).to.be.false;
    });
  });

  describe("Fee Distribution Scenarios", function () {
    it("Should handle large volume fee collection", async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      
      // Simulate high volume trading fees
      const dailyFees = toUsdc("10000");
      for (let i = 0; i < 7; i++) {
        await (usdc as any).transfer(await treasury.getAddress(), dailyFees);
      }
      
      expect(await treasury.getBalance(await usdc.getAddress())).to.equal(toUsdc("70000"));
    });

    it("Should support DAO revenue distribution", async function () {
      await treasury.whitelistToken(await usdc.getAddress(), true);
      await (usdc as any).transfer(await treasury.getAddress(), toUsdc("100000"));
      
      // Simulate DAO voting to distribute treasury funds
      const stakingReward = toUsdc("20000");
      const developmentFund = toUsdc("30000");
      const buybackAmount = toUsdc("50000");
      
      await treasury.withdraw(await usdc.getAddress(), stakingReward, user1.address);
      await treasury.withdraw(await usdc.getAddress(), developmentFund, user2.address);
      await treasury.withdraw(await usdc.getAddress(), buybackAmount, governance.address);
      
      expect(await usdc.balanceOf(user1.address)).to.equal(stakingReward);
      expect(await usdc.balanceOf(user2.address)).to.equal(developmentFund);
      expect(await usdc.balanceOf(governance.address)).to.equal(buybackAmount);
    });
  });
}); 