import Button from "@/components/button/button";
import styles from "./page.module.css";
import Link from "next/link";

export default function Maximizing() {
  return (
    <main className={styles.main}>
      <div className={styles.docWrapper}>
        <h1>Maximizing Your Earnings as a Cxmpute Provider</h1>
        <p>
          Ready to boost your earnings on the Cxmpute network? Whether you’re just starting out or already part of our growing community, here are some quick tips to help you maximize your rewards and make the most of your idle compute power.
        </p>
        <h2>Get Started Now</h2>
        <p>
          The first step is simple: install the Cxmpute provider app and get mining as soon as possible. The more you mine, the more rewards you earn. Don’t wait—every minute counts in turning idle cycles into real income.
        </p>
        <p>
          <em>Tip: The earlier you join, the more mining time you get, and that means more rewards in your pocket.</em>
        </p>
        <h2>Build Your Network and Reputation</h2>
        <p>
          Cxmpute isn’t just about individual contributions—it’s a community. Invite others to join and build your social network. As you participate longer, your reputation grows, which plays a crucial role in our ecosystem.
        </p>
        <p>
          <em>Tip: Think of your reputation as a multiplier. The more trusted you become, the higher your mining rate and rewards.</em>
        </p>
        <h2>Stake Your $CXPT Token</h2>
        <p>
          While completely optional, buying and staking the $CXPT token can further boost your reputation on the network. This extra step not only reinforces your commitment but also increases your overall rewards by enhancing your mining multiplier.
        </p>
        <p>
          <em>Tip: Consider staking $CXPT as an investment in your long-term earning potential. The higher your reputation, the greater your mining efficiency and rewards.</em>
        </p>
        <h2>Reputation: Your Key Multiplier</h2>
        <p>
          At the core of our network, reputation acts as a powerful multiplier for your mining rate. Every action—mining, inviting peers, and staking tokens—contributes to a higher reputation score, ensuring that your contributions are rewarded more generously.
        </p>
        <p>
          <em>Tip: Focus on consistent participation. The longer you stay active, the more your reputation grows, which translates directly into higher earnings.</em>
        </p>
        <p>
          By installing the app, engaging with your network, and strategically staking your $CXPT tokens, you’re not just mining—you’re building a robust presence in the Cxmpute ecosystem. Start today and watch your reputation multiply, powering your journey towards maximized earnings.
        </p>
        <p>Happy mining!</p>
        <Link href="/">
          <Button text="Back to Home" backgroundColor="#20a191" />
        </Link>
      </div>
    </main>
  );
}
