import Button from "@/components/button/button";
import styles from "./page.module.css";
import Link from "next/link";

export default function Roadmap() {
  return (
    <main className={styles.main}>
      <div className={styles.docWrapper}>
        <h1>Cxmpute Roadmap & Future Work</h1>
        <p>
          Before we dive into the exciting details of our roadmap, imagine this:
          building Cxmpute is like creating a futuristic metropolis where every idle
          computer is a vibrant power plant, lighting up a digital cityscape with untapped energy.
          Our journey is guided by a clear blueprint that transforms vision into reality—one inspiring
          step at a time.
        </p>
        <h2>Provider Onboarding: Rallying the Pioneers</h2>
        <p>
          Every great city needs its architects. In our case, we’re inviting individuals and enterprises alike
          to join as compute providers. Think of it as assembling a team of trailblazers, each contributing
          their spare compute power to build a robust, globally distributed network. By sharing your idle
          cycles, you’re not just earning rewards—you’re powering the future of decentralized computing.
        </p>
        <p>
          <Link href="/download">
            <Button text="Join as a Provider" backgroundColor="#20a191" />
          </Link>
        </p>
        <h2>User Engagement: Sparking a Lively Community</h2>
        <p>
          What’s a city without its bustling streets? We’re creating a vibrant, demand-driven ecosystem where
          developers, AI researchers, and enterprises come together to collaborate and innovate.
          Our goal is to make Cxmpute as accessible and valuable as a neighborhood café where ideas flow
          as freely as coffee.
        </p>
        <p>
          <Link href="/dashboard">
            <Button text="Get Involved as a User" backgroundColor="#fe91e8" />
          </Link>
        </p>
        <h2>Software Development: Crafting a Seamless Experience</h2>
        <p>
          Just like a well-designed city needs smooth roads and clear signs, our software development phase
          ensures that every interface, API, and tool works in harmony. We’re finalizing and optimizing our
          platform for high performance and seamless integration—so every journey on our network is as smooth
          as a scenic drive through a digital wonderland.
        </p>
        <h2>Closed Beta Launch: Testing the Blueprint</h2>
        <p>
          Every new metropolis goes through a trial run, and our closed beta is that crucial first public
          stroll. This stage is all about testing performance, security, and user experience. Feedback from
          our early explorers will serve as our compass, guiding improvements and setting the stage for the next big leap.
        </p>
        <h2>Public Mainnet Launch: Opening the Gates</h2>
        <p>
          The day is coming when our doors swing wide open. With the public mainnet launch, decentralized
          compute services will be available to everyone, marking the official start of a new era.
          It’s like the grand opening of a city where every resident—whether a provider or a user—can contribute
          to and benefit from the collective power of the network.
        </p>
        <h2>Future Expansion: Building Tomorrow, Today</h2>
        <p>
          Our roadmap doesn’t end with the mainnet launch. We’re already dreaming bigger: expanding service offerings,
          reinforcing security protocols, and forging strategic partnerships that propel Cxmpute into new realms of innovation.
          With community feedback at the heart of our journey, the future is a canvas waiting
          to be painted with bold, revolutionary ideas.
        </p>
        <p>
          Ready to be a part of this vibrant future? Whether you’re here to contribute or to harness the power of decentralized
          computing, join us as we build a smarter, more connected world—one idle cycle at a time.
        </p>
        <Link href="/">
          <Button text="Back to Home" backgroundColor="#20a191" />
        </Link>
      </div>
    </main>
  );
}
