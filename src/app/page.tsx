"use client"

import Image from "next/image";
import styles from "./page.module.css";
import Button from "@/components/button/button";
import { useState } from "react";
import FAQCard from "@/components/faqCard/faqCard";
import Map from "@/components/map/map";

const cxmputeGreen = "#20a191";
const cxmputePink = "#fe91e8";
const cxmputeYellow = "#f8cb46";
const cxmputePurple = "#91a8eb";
// const cxmputeRed = "#d64989";
// const cxmputeSand = "#d4d4cb";
const cxmputeSlate = "#d4d4cb";
// const cxmputeBeige = "#f9f5f2";
// const cxmputeBeigerBeige = "#fdede3";


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
          <Image src="/images/1.png" alt="cxmpute logo" height={70} width={70}/>
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
              src="/images/dolphinhero.png"
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
                src="/images/code.svg"
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
                src="/images/brain-electricity.svg"
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
                  src="/images/computer.png"
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
                  src="/images/server.png"
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
                  <a href="/services" target="_blank">
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
                        src="/images/code.svg"
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
                        src="/images/code.svg"
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
                        src="/images/code.svg"
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
                        src="/images/code.svg"
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
                        src="/images/code.svg"
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
                        src="/images/code.svg"
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
                    <a href="/services" target="_blank">
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
                          src="/images/code.svg"
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
                          src="/images/code.svg"
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
                          src="/images/code.svg"
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
                          src="/images/code.svg"
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
                          src="/images/code.svg"
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
                          src="/images/code.svg"
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
        <div className={styles.protected}>
          <div className={styles.protectedContainer}>
            <div className={styles.protectedImageContainer}>
              <div className={styles.imageWrapper2}>
                <Image
                  src="/images/shield.png"
                  alt="Cxmpute protects your privacy"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
            </div>
            <div className={styles.protectedTextContainer}>
              <h1>Cxmpute protects your privacy</h1>
              <p>At Cxmpute, our philosophy is to secure your computing resources from unauthorized use. It is impossible for Cxmpute to access your personal files or monitor your activity. Cxmpute is a network designed solely for contributing unused computing power, ensuring that your data remains private and your device stays protected while you help power the next generation of decentralized technology.</p>
            </div>
          </div>
        </div>
        <div className={styles.testimonials}>
          <h2>What do users say?</h2>
          <div className={styles.testimonialsContainer}>
            <div className={styles.testimonial}
              style={{ "--testimonial-color": cxmputeYellow } as React.CSSProperties}
            >
              <h1>&quot;★★★★★&quot;</h1>
              <p>
              &quot;I&apos;m thoroughly impressed with Cxmpute. The installation was incredibly straightforward—even for someone like me who isn’t particularly tech-savvy. Once it was set up, everything just worked. The intuitive interface makes managing my resources effortless, and the rewards start flowing in automatically.&quot;
              </p>
            </div>
            <div className={styles.testimonial}
              style={{ "--testimonial-color": cxmputeYellow } as React.CSSProperties}
            >
              <h1>&quot;Privacy First&quot;</h1>
              <p>
              &quot;What really sets Cxmpute apart is its uncompromising approach to privacy. I never worry about my personal data being exposed—Cxmpute only leverages unused computing power without peeking into my files or online activity. It’s like sharing your spare resources without opening your digital front door.&quot;
              </p>
            </div>
            <div className={styles.testimonial}
              style={{ "--testimonial-color": cxmputeYellow } as React.CSSProperties}
            >
              <h1>&quot;Seamless Performance&quot;</h1>
              <p>
              &quot;Contributing my idle computing resources through Cxmpute has been a game-changer. I get to earn passive income without any noticeable drop in system performance. The background operations are smooth and efficient, leaving my everyday tasks unaffected.&quot;
              </p>
            </div>
            <div className={styles.testimonial}
              style={{ "--testimonial-color": cxmputeYellow } as React.CSSProperties}
            >
              <h1>&quot;Modern and Transparent Dashboard&quot;</h1>
              <p>
              &quot;The Cxmpute dashboard is sleek and user-friendly, offering clear insights into resource usage and rewards. I appreciate the transparency in how rewards are calculated and the quick support whenever I’ve had questions. It makes participating in decentralized computing both fun and reassuring.&quot;
              </p>
            </div>
            <div className={styles.testimonial}
              style={{ "--testimonial-color": cxmputeYellow } as React.CSSProperties}
            >
              <h1>&quot;Empowering the Future of Computing&quot;</h1>
              <p>
              &quot;Cxmpute is revolutionizing how we think about idle resources. By enabling anyone to contribute to a decentralized network, it opens up new avenues for revenue and innovation without compromising security or speed. It’s an exciting step toward a more connected, efficient digital ecosystem.&quot;
              </p>
            </div>
          </div>
        </div>
        <div className={styles.architecture}>
          <div className={styles.architectureContainer}>
            <div className={styles.ALeft}>
              <h1>Cxmpute Network Architecture</h1>
            </div>
            <div className={styles.ARight}>
              <div className={styles.architectureLayer}
                style={{ "--architecture-layer-color": cxmputePurple } as React.CSSProperties}
              >
                <h1>Cxmpute Core</h1>
                <p>The main hub for users to access services, manage workloads, and deploy AI models. It offers a simple interface and powerful APIs, making it easy for anyone to leverage Cxmpute’s decentralized computing.</p>
              </div>
              <div className={styles.architectureLayer}
                style={{ "--architecture-layer-color": cxmputeGreen } as React.CSSProperties}
              >
                <h1>Financial Layer</h1>
                <p>Blockchain layers for automated payments and rewards distribution. Cxmpute&apos;s multi-chain architecture allows you to participate with your preferred blockchain.</p>
              </div>
              <div className={styles.architectureLayer}
                style={{ "--architecture-layer-color": cxmputeYellow } as React.CSSProperties}
              >
                <h1>Orchestration Network Layer</h1>
                <p>Manages requests and matches users with the best providers based on pricing, hardware, and availability. It ensures smooth operation of services like serverless compute, AI inference, and distributed training.</p>
              </div>
              <div className={styles.architectureLayer}
                style={{ "--architecture-layer-color": cxmputePink } as React.CSSProperties}
              >
                <h1>Provider Network Layer</h1>
                <p>The core of Cxmpute’s infrastructure. This global network provides scalable, secure computing power for AI inference, serverless apps, and distributed workloads. Providers earn rewards by sharing their resources.</p>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.token}>
          <div className={styles.tokenContainer}>
            <div className={styles.ARight}>
              <div className={styles.cxptToken}>
                <Image
                  src="/images/8.png"
                  alt="Cxmpute token"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
            </div>
            <div className={styles.ALeft}>
              <h1>$CXPT Token</h1>
              <p>The Cxmpute token is a utility token that lets providers optionally stake tokens to demonstrate reputation and enhance network security. It rewards users for participation and grants access to special features and services. The token is not live yet, but stay tuned for updates!</p>
            </div>
          </div>
        </div>
        <div className={styles.blog}>
          <div className={styles.blogContainer}>
            <h1 className={styles.blogTitle}>Read more: browse our latest news</h1>
            <div className={styles.blogCards}>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image
                    src="/images/8.png"
                    alt="Cxmpute blog"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className={styles.blogCardText}>
                  <h1>Cxmpute 101: What is Cxmpute?</h1>
                  <p>Before we dive into Cxmpute 101, let’s start with an analogy to understand idle compute power. Imagine your computer as a power plant with extra capacity sitting idle most of the...</p>
                  <a href="/101" target="_blank">
                    <Button text="Read more" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image
                    src="/images/6.png"
                    alt="Cxmpute blog"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className={styles.blogCardText}>
                  <h1>Cxmpute Roadmap</h1>
                  <p>Our Future Vision and How We&apos;ll Get There. Our journey is guided by a clear blueprint that transforms vision into reality—one inspiring step at a time.</p>
                  <a href="/roadmap" target="_blank">
                    <Button text="Read more" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image
                    src="/images/7.png"
                    alt="Cxmpute blog"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className={styles.blogCardText}>
                  <h1>Cxmpute Services Overview</h1>
                  <p>Imagine a bustling digital marketplace where every piece of idle compute power is transformed into a vibrant service—this is the heart of Cxmpute. Today, we’re taking you on a tour of our extensive suite of services that...</p>
                  <a href="/services" target="_blank">
                    <Button text="Read more" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image
                    src="/images/8.png"
                    alt="Cxmpute blog"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
                <div className={styles.blogCardText}>
                  <h1>How to maximize your earnings as a provider</h1>
                  <p>Ready to boost your earnings on the Cxmpute network? Whether you’re just starting out or already part of our growing community, here are some quick tips to help you maximize...</p>
                  <a href="/maximize" target="_blank">
                    <Button text="Read more" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
              
            </div>
          </div>
        </div>
        <div className={styles.faq}>
          <div className={styles.faqContainer}>
            <h1>Frequently Asked Questions</h1>
            <FAQCard
              question="Is my personal data truly safe with Cxmpute?"
              answer="Absolutely. Cxmpute is built on a philosophy of strict privacy. We only harness your unused computing power and never access your personal files or monitor your online activity, ensuring your data remains completely secure."
            />
            <FAQCard
              question="Will running Cxmpute slow down my device or affect my internet speed?"
              answer="Not necessarily—you control exactly how much of your device's computing power Cxmpute uses. If you want to maximize your rewards, you can configure it to tap into more resources when you're not using your computer. For example, if you're going to bed, you can allow Cxmpute to operate at full capacity overnight, maximizing rewards without interrupting your daily activities. Conversely, if you need to use your device during the day, you can adjust the settings so that Cxmpute uses only a portion of your available power. Importantly, mining sessions only begin when you explicitly turn them on—Cxmpute is never active without your permission. The flexibility of these settings can vary by device and category, with more powerful systems generally offering greater customization. For further details on eligible devices and recommended configurations, please refer to our Get Started page."
            />
            <FAQCard
              question="How complicated is the installation and setup process?"
              answer="We’ve made it extremely user-friendly. The setup is straightforward—even if you’re not tech-savvy—thanks to our intuitive interface and step-by-step instructions. You set it up once and then watch the rewards accumulate effortlessly."
            />
            <FAQCard
              question="How does Cxmpute ensure fair rewards for my unused computing power?"
              answer="Our reward mechanism is transparent and automated. All our code is open-source and available on our GitHub. Using a robust multi-chain architecture, Cxmpute calculates rewards based on your contributed idle capacity and distributes them fairly, so you always get your due share without any extra effort."
            />
            <FAQCard
              question="What if I run into technical issues or experience downtime?"
              answer="Our dedicated support team is here to help. Contact us via our Discord if you encounter any issues. The platform is built for high reliability and is continuously monitored to address any issues swiftly, ensuring minimal disruption to your experience."
            />
            <FAQCard
              question="Can I control when and how my resources are used?"
              answer="Yes, you remain in complete control. Cxmpute leverages only your idle computing power. This means you decide when to run it, and your primary activities and system performance remain unaffected."
            />
            <FAQCard
              question="What if I have concerns about long-term reliability and support?"
              answer="We’re committed to continuous improvement and customer satisfaction. Our platform is regularly updated, and our support team is always available to assist you—ensuring you enjoy a seamless, reliable experience with Cxmpute."
            />
          </div>
        </div>

        <div className={styles.mapt}>
          <div className={styles.mapContainer}>
            <Map/>
            <div className={styles.mapTextOverlay}>
              <div className={styles.mapOverlayImage}>
                <Image
                  src="/images/3.png"
                  alt="Cxmpute Dolphin Logo"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
              <h1>Start earning off your computing power</h1>
              <a href="/download" target="_blank">
                <Button text="Get started" backgroundColor={cxmputeYellow} />
              </a>
            </div>
          </div>
        </div>

      </div>
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerLeft}>
            <div className={styles.footerImage}>
              <Image
                src="/images/8.png"
                alt="Cxmpute Dolphin Logo"
                width={150}
                height={150}
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
          <div className={styles.footerRight}>
            <div className={styles.footerSocialLinks}>
              <a
                href="https://x.com/cxmpute"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerSocialLink}
              >
                <Image
                  src="/images/x.svg"
                  alt="Twitter"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain" }}
                />
              </a>
              <a
                href="https://discord.com/invite/CJGA7B2zKT"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerSocialLink}
              >
                <Image
                  src="/images/discord.svg"
                  alt="Discord"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain" }}
                />
              </a>
              <a
                href="https://www.youtube.com/@cxmputenetwork"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerSocialLink}
              >
                <Image
                  src="/images/youtube.svg"
                  alt="Youtube"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain" }}
                />
              </a>
              <a
                href="https://github.com/unxversal"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerSocialLink}
              >
                <Image
                  src="/images/github-circle.svg"
                  alt="Github"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain" }}
                />
              </a>
              <a
                href="https://www.reddit.com/r/cxmpute/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerSocialLink}
              >
                <Image
                  src="/images/reddit.png"
                  alt="Reddit"
                  width={25}
                  height={25}
                  style={{ objectFit: "contain" }}
                />
              </a>

            </div>
            <div className={styles.footerButtons}>
              <a href="/download" target="_blank">
                <Button text="Get started as a provider" backgroundColor={cxmputeYellow} />
              </a>
              <a href="/dashboard" target="_blank">
                <Button text="Get started as a user" backgroundColor={cxmputeYellow} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>

  );
}
