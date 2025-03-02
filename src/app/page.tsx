"use client"

import Image from "next/image";
import styles from "./page.module.css";
import Button from "@/components/button/button";
import { useState } from "react";

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

  const [identity, setIdentity] = useState("");

  // a function which instakes a string and sets the identity to it, and then scrolls to the #identitySpecific div
  const setIdentityAndScroll = (identity: string) => {
    setIdentity(identity);
    const element = document.getElementById("identitySpecific");
    element?.scrollIntoView({ behavior: "smooth" });
  };

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
          <h1>Here&apos;s what Cxmpute does for you:</h1>
          <p>I am a...</p>
            <div className={styles.whoIsCxmputeForCards}>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputePurple }}
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
              <button className={styles.whoIsCxmputeForCard__button}
                style={{ "--select-bg-color": cxmputePurple } as React.CSSProperties}
                onClick={() => setIdentityAndScroll("developer")}
              >
                That&apos;s me!
              </button>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputeGreen }}
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
                style={{ "--select-bg-color": cxmputeGreen } as React.CSSProperties}
                onClick={() => setIdentityAndScroll("mlEngineer")}
              >
                That&apos;s me!
              </button>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputePink }}
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
                style={{ "--select-bg-color": cxmputePink } as React.CSSProperties}
                onClick={() => setIdentityAndScroll("individualComputeProvider")}
              >
                That&apos;s me!
              </button>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage}
              style={{ backgroundColor: cxmputeYellow }}
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
                style={{ "--select-bg-color": cxmputeYellow } as React.CSSProperties}
                onClick={() => setIdentityAndScroll("enterpriseComputeProvider")}
              >
                That&apos;s me!
              </button>
            </div>
            </div>
        </div>
        <div className={styles.identitySpecific} id="identitySpecific">
          {identity === "" && (
            <>
            </>
          )}
          {identity === "developer" && (
            <div className={`${styles.whoIsCxmputeForCard} ${styles.idenitytSpecificContainer}`}
              style={{ 
                  width: "100%", 
                  backgroundColor: cxmputePurple, 
                  margin: "40px", 
                  maxWidth: "1300px",
                  minHeight: "60vh"
                 }}
            >
                <div className={styles.ISLeft}>
                  <h3>Cxmpute for</h3>
                  <h1>Developers</h1>
                  <p>Easy access to powerful machines that will otherwise cost you an arm and a leg.</p>
                  <a href="/docs" target="_blank">
                  <Button text="Explore the full feature list" backgroundColor={cxmputeSlate}/>
                  </a>
                  <a href="/dashboard" target="_blank">
                  <Button text="Get started now" backgroundColor={cxmputeSlate}/>
                  </a>
                  <span>Or keep scrolling to learn more about Cxmpute :)</span>
                </div>
                <div className={styles.ISRight}>
                  <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"VIRTUAL MACHINES"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                  >
                    <div className={styles.ISTop}>
                    <button className={styles.idenitytSpecificInput__button__shadow}
                      style={{
                        height: "50px",
                        width: "50px",
                        marginBottom: "10px",
                        "--specific-feature-color": '#e9b50b' 
                      } as React.CSSProperties}
                    >
                      <Image
                        src="/code.svg"
                        alt="search icon"
                        fill
                        style={{ objectFit: "contain" }}
                      />
                    </button>
                    <p>Cxmpute offers VMs optimized for specific hardware configurations</p>
                    </div>

                    <div className={styles.ISBottom}>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      Read the docs
                    </button>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      See code examples
                    </button>
                    </div>
                  </div>
                  <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"SERVERLESS COMPUTE"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                  >
                    <div className={styles.ISTop}>
                    <button className={styles.idenitytSpecificInput__button__shadow}
                      style={{
                        height: "50px",
                        width: "50px",
                        marginBottom: "10px",
                        "--specific-feature-color": '#e9b50b' 
                      } as React.CSSProperties}
                    >
                      <Image
                        src="/code.svg"
                        alt="search icon"
                        fill
                        style={{ objectFit: "contain" }}
                      />
                    </button>
                    <p>Cxmpute’s Serverless service provides event-driven compute without the need to manage traditional servers.</p>
                    </div>

                    <div className={styles.ISBottom}>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      Read the docs
                    </button>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      See code examples
                    </button>
                    </div>
                  </div>
                  <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"AI INFERENCE"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                  >
                    <div className={styles.ISTop}>
                    <button className={styles.idenitytSpecificInput__button__shadow}
                      style={{
                        height: "50px",
                        width: "50px",
                        marginBottom: "10px",
                        "--specific-feature-color": '#e9b50b' 
                      } as React.CSSProperties}
                    >
                      <Image
                        src="/code.svg"
                        alt="search icon"
                        fill
                        style={{ objectFit: "contain" }}
                      />
                    </button>
                    <p>On-demand API endpoint for AI inference with a big library of SOTA AI models.</p>
                    </div>

                    <div className={styles.ISBottom}>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      Read the docs
                    </button>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      See code examples
                    </button>
                    </div>
                  </div>
                  <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"AI AGENTS"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                  >
                    <div className={styles.ISTop}>
                    <button className={styles.idenitytSpecificInput__button__shadow}
                      style={{
                        height: "50px",
                        width: "50px",
                        marginBottom: "10px",
                        "--specific-feature-color": '#e9b50b' 
                      } as React.CSSProperties}
                    >
                      <Image
                        src="/code.svg"
                        alt="search icon"
                        fill
                        style={{ objectFit: "contain" }}
                      />
                    </button>
                    <p>AI-Agents-as-a-service. Interact with agents orchestrate workflows, and execute complex tasks via GUI or API.</p>
                    </div>

                    <div className={styles.ISBottom}>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      Read the docs
                    </button>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      See code examples
                    </button>
                    </div>
                  </div>
                  <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"CODESPACES"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                  >
                    <div className={styles.ISTop}>
                    <button className={styles.idenitytSpecificInput__button__shadow}
                      style={{
                        height: "50px",
                        width: "50px",
                        marginBottom: "10px",
                        "--specific-feature-color": '#e9b50b' 
                      } as React.CSSProperties}
                    >
                      <Image
                        src="/code.svg"
                        alt="search icon"
                        fill
                        style={{ objectFit: "contain" }}
                      />
                    </button>
                    <p>Code Spaces provides a familiar but cloud-based development environment for coding, testing, and deploying applications. </p>
                    </div>

                    <div className={styles.ISBottom}>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      Read the docs
                    </button>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      See code examples
                    </button>
                    </div>
                  </div>
                  <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"PYTHON NOTEBOOKS"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                  >
                    <div className={styles.ISTop}>
                    <button className={styles.idenitytSpecificInput__button__shadow}
                      style={{
                        height: "50px",
                        width: "50px",
                        marginBottom: "10px",
                        "--specific-feature-color": '#e9b50b' 
                      } as React.CSSProperties}
                    >
                      <Image
                        src="/code.svg"
                        alt="search icon"
                        fill
                        style={{ objectFit: "contain" }}
                      />
                    </button>
                    <p>PyNotebooks allow users to run Python-based data science and machine learning workflows in an interactive environment. Access larger accelerators and environments than the competition.</p>
                    </div>

                    <div className={styles.ISBottom}>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      Read the docs
                    </button>
                    <button className={styles.idenitytSpecificInput__button__shadow}>
                      See code examples
                    </button>
                    </div>
                  </div>
                </div>
            </div>

          )}
          {identity === "mlEngineer" && (
            <div className={`${styles.whoIsCxmputeForCard} ${styles.idenitytSpecificContainer}`}
                style={{ 
                    width: "100%", 
                    backgroundColor: cxmputeGreen, 
                    margin: "40px", 
                    maxWidth: "1300px",
                    minHeight: "60vh"
                  }}
              >
                  <div className={styles.ISLeft}>
                    <h3>Cxmpute for</h3>
                    <h1>ML Engineers</h1>
                    <p>Easy access to powerful machines that will otherwise cost you an arm and a leg.</p>
                    <a href="/docs" target="_blank">
                    <Button text="Explore the full feature list" backgroundColor={cxmputeSlate}/>
                    </a>
                    <a href="/dashboard" target="_blank">
                    <Button text="Get started now" backgroundColor={cxmputeSlate}/>
                    </a>
                    <span>Or keep scrolling to learn more about Cxmpute :)</span>
                  </div>
                  <div className={styles.ISRight}>
                  <div className={styles.idenitytSpecificInput__container}
                      style={{ "--specific-feature": '"PYTHON NOTEBOOKS"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                    >
                      <div className={styles.ISTop}>
                      <button className={styles.idenitytSpecificInput__button__shadow}
                        style={{
                          height: "50px",
                          width: "50px",
                          marginBottom: "10px",
                          "--specific-feature-color": '#e9b50b' 
                        } as React.CSSProperties}
                      >
                        <Image
                          src="/code.svg"
                          alt="search icon"
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      </button>
                      <p>PyNotebooks allow users to run Python-based data science and machine learning workflows in an interactive environment. Access larger accelerators and environments than the competition.</p>
                      </div>

                      <div className={styles.ISBottom}>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        Read the docs
                      </button>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        See code examples
                      </button>
                      </div>
                    </div>
                    <div className={styles.idenitytSpecificInput__container}
                      style={{ "--specific-feature": '"VIRTUAL MACHINES"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                    >
                      <div className={styles.ISTop}>
                      <button className={styles.idenitytSpecificInput__button__shadow}
                        style={{
                          height: "50px",
                          width: "50px",
                          marginBottom: "10px",
                          "--specific-feature-color": '#e9b50b' 
                        } as React.CSSProperties}
                      >
                        <Image
                          src="/code.svg"
                          alt="search icon"
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      </button>
                      <p>Cxmpute offers VMs optimized for specific hardware configurations</p>
                      </div>

                      <div className={styles.ISBottom}>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        Read the docs
                      </button>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        See code examples
                      </button>
                      </div>
                    </div>
                    <div className={styles.idenitytSpecificInput__container}
                      style={{ "--specific-feature": '"SERVERLESS COMPUTE"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                    >
                      <div className={styles.ISTop}>
                      <button className={styles.idenitytSpecificInput__button__shadow}
                        style={{
                          height: "50px",
                          width: "50px",
                          marginBottom: "10px",
                          "--specific-feature-color": '#e9b50b' 
                        } as React.CSSProperties}
                      >
                        <Image
                          src="/code.svg"
                          alt="search icon"
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      </button>
                      <p>Cxmpute’s Serverless service provides event-driven compute without the need to manage traditional servers.</p>
                      </div>

                      <div className={styles.ISBottom}>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        Read the docs
                      </button>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        See code examples
                      </button>
                      </div>
                    </div>
                    <div className={styles.idenitytSpecificInput__container}
                      style={{ "--specific-feature": '"AI INFERENCE"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                    >
                      <div className={styles.ISTop}>
                      <button className={styles.idenitytSpecificInput__button__shadow}
                        style={{
                          height: "50px",
                          width: "50px",
                          marginBottom: "10px",
                          "--specific-feature-color": '#e9b50b' 
                        } as React.CSSProperties}
                      >
                        <Image
                          src="/code.svg"
                          alt="search icon"
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      </button>
                      <p>On-demand API endpoint for AI inference with a big library of SOTA AI models.</p>
                      </div>

                      <div className={styles.ISBottom}>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        Read the docs
                      </button>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        See code examples
                      </button>
                      </div>
                    </div>
                    <div className={styles.idenitytSpecificInput__container}
                      style={{ "--specific-feature": '"AI AGENTS"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                    >
                      <div className={styles.ISTop}>
                      <button className={styles.idenitytSpecificInput__button__shadow}
                        style={{
                          height: "50px",
                          width: "50px",
                          marginBottom: "10px",
                          "--specific-feature-color": '#e9b50b' 
                        } as React.CSSProperties}
                      >
                        <Image
                          src="/code.svg"
                          alt="search icon"
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      </button>
                      <p>AI-Agents-as-a-service. Interact with agents orchestrate workflows, and execute complex tasks via GUI or API.</p>
                      </div>

                      <div className={styles.ISBottom}>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        Read the docs
                      </button>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        See code examples
                      </button>
                      </div>
                    </div>
                    <div className={styles.idenitytSpecificInput__container}
                      style={{ "--specific-feature": '"CODESPACES"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                    >
                      <div className={styles.ISTop}>
                      <button className={styles.idenitytSpecificInput__button__shadow}
                        style={{
                          height: "50px",
                          width: "50px",
                          marginBottom: "10px",
                          "--specific-feature-color": '#e9b50b' 
                        } as React.CSSProperties}
                      >
                        <Image
                          src="/code.svg"
                          alt="search icon"
                          fill
                          style={{ objectFit: "contain" }}
                        />
                      </button>
                      <p>Code Spaces provides a familiar but cloud-based development environment for coding, testing, and deploying applications. </p>
                      </div>

                      <div className={styles.ISBottom}>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        Read the docs
                      </button>
                      <button className={styles.idenitytSpecificInput__button__shadow}>
                        See code examples
                      </button>
                      </div>
                    </div>
                  </div>
              </div>
          )}
          {identity === "individualComputeProvider" && (
                    <div className={`${styles.whoIsCxmputeForCard} ${styles.idenitytSpecificContainer}`}
                        style={{ 
                            width: "100%", 
                            backgroundColor: cxmputePink, 
                            margin: "40px", 
                            maxWidth: "1300px",
                            minHeight: "60vh"
                          }}
                      >
                          <div className={styles.ISLeft}>
                            <h3>Cxmpute for</h3>
                            <h1>Individuals</h1>
                            <p>Turn your idle computer into a passive income generator—earn rewards effortlessly.</p>
                            <a href="/download" target="_blank">
                            <Button text="Get started in 5 minutes" backgroundColor={cxmputeGreen}/>
                            </a>
                            <span>Or keep scrolling to learn more about Cxmpute :)</span>
                          </div>
                          <div className={styles.ISRight}>
                          <div className={styles.idenitytSpecificInput__container}
                              style={{ "--specific-feature": '"STEP 1"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                            >
                                <h1>Create an account in the dashboard</h1>
                          </div>
                          <div className={styles.idenitytSpecificInput__container}
                              style={{ "--specific-feature": '"STEP 2"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                            >
                                <h1>Download the Cxmpute Provider App</h1>
                          </div>
                          <div className={styles.idenitytSpecificInput__container}
                              style={{ "--specific-feature": '"STEP 3"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                            >
                                <h1>Follow the instructions in the app to complete the onboarding steps.</h1>
                          </div>
                          <div className={styles.idenitytSpecificInput__container}
                              style={{ "--specific-feature": '"STEP 4"', "--specific-feature-color": '#e9b50b' } as React.CSSProperties}
                            >
                                <h1>Turn on your Cxmpute provider node and start earning!</h1>
                          </div>
                          </div>
                      </div>
          )}
          {identity === "enterpriseComputeProvider" && (
            <div className={`${styles.whoIsCxmputeForCard} ${styles.idenitytSpecificContainer}`}
              style={{ 
                  width: "100%", 
                  backgroundColor: cxmputeYellow, 
                  margin: "40px", 
                  maxWidth: "1300px",
                  minHeight: "60vh"
                }}
            >
                <div className={styles.ISLeft}>
                  <h3>Cxmpute for</h3>
                  <h1>Enterprise Providers</h1>
                  <p>Whether you run a boutique data center or a vast compute network, Cxmpute empowers you to optimize resource utilization, scale seamlessly, and access new revenue streams.</p>
                  <a href="/download" target="_blank">
                  <Button text="Get started in 5 minutes" backgroundColor={cxmputeGreen}/>
                  </a>
                  <a href="/contact" target="_blank">
                  <Button text="Or contact us to book a call" backgroundColor={cxmputeGreen}/>
                  </a>
                  <span>Or keep scrolling to learn more about Cxmpute :)</span>
                </div>
                <div className={styles.ISRight}>
                <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"STEP 1"', "--specific-feature-color": cxmputePurple } as React.CSSProperties}
                  >
                      <h1>Create an account in the dashboard</h1>
                </div>
                <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"STEP 2"', "--specific-feature-color": cxmputePurple } as React.CSSProperties}
                  >
                      <h1>Download the Cxmpute Provider App</h1>
                </div>
                <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"STEP 3"', "--specific-feature-color": cxmputePurple } as React.CSSProperties}
                  >
                      <h1>Follow the instructions in the app to complete the onboarding steps.</h1>
                </div>
                <div className={styles.idenitytSpecificInput__container}
                    style={{ "--specific-feature": '"STEP 4"', "--specific-feature-color": cxmputePurple } as React.CSSProperties}
                  >
                      <h1>Turn on your Cxmpute provider node and start earning!</h1>
                </div>
                </div>
            </div>
          )}
        </div>


      </div>
    </div>

  );
}
