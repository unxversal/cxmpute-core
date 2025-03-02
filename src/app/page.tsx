import Image from "next/image";
import styles from "./page.module.css";
import Button from "@/components/button/button";

const cxmputeGreen = "#20a191";
const cxmputePink = "#fe91e8";
const cxmputeYellow = "#f8cb46";
const cxmputePurple = "#91a8eb";
const cxmputeRed = "#d64989";
const cxmputeSand = "#d4d4cb";
const cxmputeSlate = "#d4d4cb";
const cxmputeBeige = "#f9f5f2";
const cxmputeBeigerBeige = "#fdede3";


export default function Home() {

  

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <Image src="/1.png" alt="cxmpute logo" height={70} width={70}/>
          <h1>CXMPUTE</h1>
        </div>
        <div className={styles.menu}>
          <ul>
            <li><a href="/download" target="_blank">
              <Button text="DOWNLOAD" backgroundColor={cxmputeYellow}/>
            </a></li>
            <li><a href="/docs" target="_blank">
              <Button text="DOCUMENTATION" backgroundColor={cxmputePurple}/>
            </a></li>
            <li><a href="/dashboard" target="_blank">
              <Button text=" DASHBOARD" backgroundColor={cxmputeGreen}/>
            </a></li>
          </ul>
        </div>
      </header>
      {/* Who is cxmpute for */}
      <div className={styles.content}>
        <div className={styles.hero}>
            <div className={styles.heroLeft}>
            <h3>Welcome to the Cxmpute network!</h3>
            <h1>Use or provide computing power, storage, and more.</h1>
            <p>Cxmpute connects providers of computing hardware with users who leverage a range of computing services.</p>
            <div className={styles.heroButtons}>
              <a href="/download" target="_blank">
              <Button text="Start earning as a provider" backgroundColor={cxmputeYellow}/>
              </a>
              <a href="/docs" target="_blank">
              <Button text="Start using Cxmpute services" backgroundColor={cxmputePink}/>
              </a>
            </div>
            <a href="/101" target="_blank">
              <Button text="Cxmpute in 90 seconds" backgroundColor={cxmputePurple}/>
            </a>
            </div>
          <div className={styles.heroRight}>
            <Image
              src="/dolphinhero.png"
              alt="dolphin image"
              fill
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
        <div className={styles.whoIsCxmputeFor}>
          <h3>Who is Cxmpute for?</h3>
          <h1>Here&apos;s what Cxmpute does for you</h1>
          <p>I am a...</p>
            <div className={styles.whoIsCxmputeForCards}>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputeGreen }}
              >
              <Image
                src="/code.svg"
                alt="code icon"
                fill
                style={{ objectFit: "contain" }}
              />
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Developer</span>
              <p className={styles.whoIsCxmputeForCard__content}>Access flexible, decentralized infrastructure to build, test, and deploy faster—without the limitations of traditional cloud services.</p>
              <button className={styles.whoIsCxmputeForCard__button}>
                That&apos;s me!
              </button>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputeYellow }}
              >
              <Image
                src="/brain-electricity.svg"
                alt="brain icon"
                fill
                style={{ objectFit: "contain" }}
              />
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>ML Engineer</span>
              <p className={styles.whoIsCxmputeForCard__content}>Train and run AI models at scale using cost-efficient in a familiar Jupyter Environment, with globally distributed compute resources designed for scale, performance, and reliability.</p>
              <button className={styles.whoIsCxmputeForCard__button}
                style={{ "--select-bg-color": cxmputeYellow } as React.CSSProperties}
              >
                That&apos;s me!
              </button>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputePurple }}
              >
              <div className={styles.imageWrapper}>
                <Image
                  src="/computer.png"
                  alt="computer image"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Individual Compute Provider</span>
              <p className={styles.whoIsCxmputeForCard__content}>Monetize your idle computer resources by contributing to a decentralized network—and get rewarded for your unused power.</p>
              <button className={styles.whoIsCxmputeForCard__button}
                style={{ "--select-bg-color": cxmputePurple } as React.CSSProperties}
              >
                That&apos;s me!
              </button>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputeSand }}
              >
              <div className={styles.imageWrapper}>
                <Image
                  src="/server.png"
                  alt="server image"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Enterprise Compute Provider</span>
              <p className={styles.whoIsCxmputeForCard__content}>Maximize the ROI of your infrastructure by offering your datacenter capacity to a global marketplace for decentralized compute.</p>
              <button className={styles.whoIsCxmputeForCard__button}
                style={{ "--select-bg-color": cxmputeSand } as React.CSSProperties}
              >
                That&apos;s me!
              </button>
            </div>
            </div>
        </div>
        <div className={styles.identitySpecific} id="identitySpecific">

        </div>


      </div>
    </div>

  );
}
