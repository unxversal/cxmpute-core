"use client"

import Image from "next/image";
import Link from "next/link";
import styles from "./LandingPage.module.css";
import Button from "@/components/button/button";
import { useState } from "react";
import Map from "@/components/map/map";
import NotificationBanner from "@/components/ui/NotificationBanner/NotificationBanner";

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
  const [selectedModelType, setSelectedModelType] = useState("text");

  return (
    <div className={styles.page}>
      <div className={styles.backgroundPattern}></div>

      <header className={styles.header}>
        <div className={styles.logo}>
          <Image src="/images/1.png" alt="cxmpute logo" height={70} width={70}/>
          <h1>CXMPUTE</h1>
        </div>
        <div className={styles.menu}>
          <ul>
            <li><a href="/docs/provider" >
              <Button text="DOWNLOAD" backgroundColor={cxmputeYellow}/>
            </a></li>
            <li><a href="/docs" >
              <Button text="DOCUMENTATION" backgroundColor={cxmputePurple}/>
            </a></li>
            <li><a href="/dashboard" >
              <Button text=" DASHBOARD" backgroundColor={cxmputeGreen}/>
            </a></li>
          </ul>
        </div>
      </header>
      
      <NotificationBanner motif="homepage" />
      
      <div className={styles.content}>
        {/* Hero Section */}
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <h3>Welcome to the Cxmpute network!</h3>
            <h1>Use or provide computing power, storage, and more.</h1>
            <p>Cxmpute connects providers of computing hardware with users who leverage a range of computing services.</p>
            <div className={styles.heroButtons}>
              <a href="/docs/provider" target="_blank">
                <Button text="Start providing" backgroundColor={cxmputeYellow}/>
              </a>
              <a href="/docs" target="_blank">
                <Button text="Start using" backgroundColor={cxmputePink}/>
              </a>
            </div>
            <a href="/101">
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

        {/* Cxmpute for [parties] */}
        <div className={styles.whoIsCxmputeFor}>
          <h3>Cxmpute for</h3>
          <h1>Three key stakeholders</h1>
          <div className={styles.whoIsCxmputeForCards}>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage} style={{ backgroundColor: cxmputePurple }}>
                <Image src="/images/code.svg" alt="code icon" fill style={{ objectFit: "contain" }} />
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Companies & Developers</span>
              <p className={styles.whoIsCxmputeForCard__content}>Access flexible, decentralized infrastructure to build, test, and deploy faster—without the limitations of traditional cloud services.</p>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage} style={{ backgroundColor: cxmputeYellow }}>
                <div className={styles.imageWrapper}>
                  <Image src="/images/server.png" alt="datacenter image" fill style={{ objectFit: "contain" }} />
                </div>
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Datacenters</span>
              <p className={styles.whoIsCxmputeForCard__content}>Maximize the ROI of your infrastructure by offering your datacenter capacity to a global marketplace for decentralized compute.</p>
            </div>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage} style={{ backgroundColor: cxmputePink }}>
                <div className={styles.imageWrapper}>
                  <Image src="/images/computer.png" alt="computer image" fill style={{ objectFit: "contain" }} />
                </div>
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Individuals</span>
              <p className={styles.whoIsCxmputeForCard__content}>Monetize your idle computer resources by contributing to a decentralized network—and get rewarded for your unused power.</p>
            </div>
          </div>
        </div>

        {/* About - Manifesto */}
        <div className={styles.about}>
          <div className={styles.aboutContainer}>
            <h1>About Cxmpute</h1>
            <div className={styles.manifestoContent}>
              <p>Computing power should be accessible to everyone, not controlled by a few tech giants. That&apos;s why we&apos;re building a decentralized network where anyone can contribute their idle computing resources and earn rewards, while users get access to affordable, scalable AI and compute services.</p>
              <p>Our mission is to democratize computing by creating a global network that benefits all participants—from individual computer owners to large enterprises—while providing developers with powerful, cost-effective alternatives to traditional cloud services.</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className={styles.howItWorks}>
          <h1>How it works</h1>
          <div className={styles.howItWorksContainer}>
            <div className={styles.howItWorksSection}>
              <div className={styles.howItWorksCard} style={{ backgroundColor: cxmputeGreen }}>
                <h2>For Users</h2>
                <h3>One API, many models, cheaper than your cheapest cloud</h3>
                <p>Access dozens of AI models through our simple, OpenAI-compatible API. Pay only for what you use with transparent pricing that beats traditional cloud providers.</p>
                <div className={styles.howItWorksFeatures}>
                  <div className={styles.feature}>✨ Public beta rewards program</div>
                  <div className={styles.feature}>🔗 OpenAI-compatible API</div>
                  <div className={styles.feature}>💰 Transparent, competitive pricing</div>
                </div>
                <a href="/docs">
                  <Button text="Learn More" backgroundColor={cxmputeSlate}/>
                </a>
              </div>
            </div>
            <div className={styles.howItWorksSection}>
              <div className={styles.howItWorksCard} style={{ backgroundColor: cxmputePink }}>
                <h2>For Providers</h2>
                <h3>Passive income as simple as downloading an app</h3>
                <p>Turn your idle computer into a revenue stream. Download our app, complete the simple setup, and start earning rewards while you sleep.</p>
                <div className={styles.howItWorksFeatures}>
                  <div className={styles.feature}>💸 Earn passive income</div>
                  <div className={styles.feature}>🎁 Public beta rewards program</div>
                  <div className={styles.feature}>🛡️ Privacy-first approach</div>
                </div>
                <a href="/docs/provider">
                  <Button text="Learn More" backgroundColor={cxmputeSlate}/>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Partners */}
        <div className={styles.partners}>
          <div className={styles.partnersContainer}>
            <h1>Built on Peaq</h1>
            <div className={styles.partnerLogo}>
              <Image src="/images/peaq.png" alt="Peaq logo" fill style={{ objectFit: "contain" }} />
            </div>
            <p>Cxmpute is built on the Peaq network, leveraging cutting-edge blockchain technology for secure, decentralized compute orchestration.</p>
          </div>
        </div>

        {/* All your AI needs, one endpoint */}
        <div className={styles.aiEndpoint}>
          <div className={styles.aiEndpointContainer}>
            <h1>All your AI needs, one endpoint</h1>
            <p>Explore our comprehensive model catalog and test models in interactive playgrounds</p>
            
            <div className={styles.modelTypeSelector}>
              {["text", "vision", "thinking", "tool", "tts", "code", "multilingual", "embeddings"].map((type) => (
                <button
                  key={type}
                  className={`${styles.modelTypeButton} ${selectedModelType === type ? styles.active : ""}`}
                  onClick={() => setSelectedModelType(type)}
                  style={{ backgroundColor: selectedModelType === type ? cxmputeYellow : cxmputeSlate }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} Models
                </button>
              ))}
            </div>

            <div className={styles.playgroundContainer}>
              <div className={styles.playgroundLeft}>
                <div className={styles.playgroundDemo}>
                  {selectedModelType === "text" && (
                    <div className={styles.textPlayground}>
                      <div className={styles.playgroundHeader}>
                        <select className={styles.modelSelect}>
                          <option>llama3.1:8b</option>
                          <option>llama3.1:70b</option>
                          <option>gpt-4o-mini</option>
                        </select>
                        <button className={styles.copyButton}>Copy model string</button>
                        <button className={styles.refreshButton}>↻</button>
                      </div>
                      <div className={styles.chatInterface}>
                        <div className={styles.chatMessages}>
                          <div className={styles.userMessage}>Hello, how are you?</div>
                          <div className={styles.aiMessage}>Hello! I&apos;m doing well, thank you for asking. How can I help you today?</div>
                        </div>
                        <input className={styles.chatInput} placeholder="Type your message..." />
                      </div>
                    </div>
                  )}
                  
                  {selectedModelType === "tts" && (
                    <div className={styles.ttsPlayground}>
                      <div className={styles.playgroundHeader}>
                        <h3>Text-to-Speech Playground</h3>
                      </div>
                      <textarea className={styles.ttsInput} placeholder="Enter text to convert to speech..."></textarea>
                      <div className={styles.ttsControls}>
                        <select className={styles.voiceSelect}>
                          <option>af_bella</option>
                          <option>af_nicole</option>
                          <option>af_sarah</option>
                        </select>
                        <input type="range" className={styles.speedSlider} min="0.5" max="2" step="0.1" defaultValue="1" />
                        <span>Speed: 1.0x</span>
                      </div>
                      <button className={styles.generateButton}>Generate Speech</button>
                      <div className={styles.audioOutput}>
                        <div className={styles.audioPlaceholder}>Generated audio will appear here</div>
                      </div>
                    </div>
                  )}

                  {selectedModelType === "embeddings" && (
                    <div className={styles.embeddingsPlayground}>
                      <div className={styles.playgroundHeader}>
                        <select className={styles.modelSelect}>
                          <option>nomic-embed-text</option>
                          <option>all-MiniLM-L6-v2</option>
                        </select>
                      </div>
                      <textarea className={styles.embeddingInput} placeholder="Enter text to embed..."></textarea>
                      <div className={styles.vectorOutput}>
                        <div className={styles.vectorPlaceholder}>Vector output will appear here</div>
                      </div>
                    </div>
                  )}

                  {/* Placeholder for other model types */}
                  {!["text", "tts", "embeddings"].includes(selectedModelType) && (
                    <div className={styles.playgroundPlaceholder}>
                      <h3>{selectedModelType.charAt(0).toUpperCase() + selectedModelType.slice(1)} Models Playground</h3>
                      <p>Interactive playground for {selectedModelType} models coming soon!</p>
                    </div>
                  )}
                </div>
                
                <div className={styles.playgroundActions}>
                  <a href="/dashboard">
                    <Button text="Get API Key" backgroundColor={cxmputeGreen}/>
                  </a>
                  <a href="/docs">
                    <Button text="Sample Code" backgroundColor={cxmputePurple}/>
                  </a>
                </div>
              </div>

              <div className={styles.playgroundRight}>
                <div className={styles.modelDescription}>
                  <h3>{selectedModelType.charAt(0).toUpperCase() + selectedModelType.slice(1)} Models</h3>
                  {selectedModelType === "text" && (
                    <p>Access state-of-the-art language models for text generation, conversation, and reasoning tasks. From fast 8B parameter models to powerful 70B+ models.</p>
                  )}
                  {selectedModelType === "tts" && (
                    <p>Convert text to natural-sounding speech with various voice options and customizable speed settings.</p>
                  )}
                  {selectedModelType === "embeddings" && (
                    <p>Generate high-quality vector embeddings for semantic search, RAG applications, and similarity matching.</p>
                  )}
                  {!["text", "tts", "embeddings"].includes(selectedModelType) && (
                    <p>Specialized models for {selectedModelType} tasks with advanced capabilities and optimized performance.</p>
                  )}
                </div>
                
                <Link href="/models">
                  <Button text="See All Models" backgroundColor={cxmputeYellow}/>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Compute Monetization */}
        <div className={styles.computeMonetization}>
          <div className={styles.computeMonetizationContainer}>
            <div className={styles.monetizationLeft}>
              <Image src="/images/8.png" alt="Monetization" fill style={{ objectFit: "contain" }} />
            </div>
            <div className={styles.monetizationRight}>
              <h1>Compute Monetization</h1>
              <p>Transform your idle computing resources into a steady income stream. Whether you have a gaming PC, a server rack, or an entire data center, Cxmpute enables you to monetize your unused capacity.</p>
              <div className={styles.monetizationFeatures}>
                <div className={styles.monetizationFeature}>💰 Passive income generation</div>
                <div className={styles.monetizationFeature}>📊 Real-time earnings tracking</div>
                <div className={styles.monetizationFeature}>⚡ Instant rewards distribution</div>
                <div className={styles.monetizationFeature}>🔒 Secure and private</div>
              </div>
            </div>
          </div>
        </div>

        {/* Hardware-agnostic global network */}
        <div className={styles.globalNetwork}>
          <div className={styles.globalNetworkContainer}>
            <h1>Hardware-agnostic global network that benefits all involved parties</h1>
            <div className={styles.networkBenefits}>
              <div className={styles.networkBenefit}>
                <h3>For Developers</h3>
                <p>Access to diverse hardware configurations, competitive pricing, and global availability.</p>
                <a href="/docs">
                  <Button text="Learn more about developer benefits" backgroundColor={cxmputePurple}/>
                </a>
              </div>
              <div className={styles.networkBenefit}>
                <h3>For Providers</h3>
                <p>Monetize any hardware type, from consumer GPUs to enterprise data centers.</p>
                <a href="/docs/provider">
                  <Button text="Learn more about provider benefits" backgroundColor={cxmputeYellow}/>
                </a>
              </div>
              <div className={styles.networkBenefit}>
                <h3>For the Ecosystem</h3>
                <p>Democratized access to computing power and reduced environmental impact through better resource utilization.</p>
                <a href="/101">
                  <Button text="Learn more about ecosystem benefits" backgroundColor={cxmputeGreen}/>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Latest News */}
        <div className={styles.blog}>
          <div className={styles.blogContainer}>
            <h1 className={styles.blogTitle}>Latest News</h1>
            <div className={styles.blogCards}>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image src="/images/8.png" alt="Rewards" fill style={{ objectFit: "contain" }} />
                </div>
                <div className={styles.blogCardText}>
                  <h1>Rewards and Testnet Now Live</h1>
                  <p>Join our public beta and start earning rewards while testing the future of decentralized compute. Get started today and be part of the revolution.</p>
                  <a href="/dashboard" target="_blank">
                    <Button text="Join Testnet" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image src="/images/6.png" alt="Roadmap" fill style={{ objectFit: "contain" }} />
                </div>
                <div className={styles.blogCardText}>
                  <h1>Cxmpute Roadmap</h1>
                  <p>Our Future Vision and How We&apos;ll Get There. Our journey is guided by a clear blueprint that transforms vision into reality—one inspiring step at a time.</p>
                  <a href="/roadmap" target="_blank">
                    <Button text="View Roadmap" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
              <div className={styles.blogCard}>
                <div className={styles.blogCardImage}>
                  <Image src="/images/7.png" alt="Services" fill style={{ objectFit: "contain" }} />
                </div>
                <div className={styles.blogCardText}>
                  <h1>Cxmpute Services Overview</h1>
                  <p>Imagine a bustling digital marketplace where every piece of idle compute power is transformed into a vibrant service—this is the heart of Cxmpute.</p>
                  <a href="/services" target="_blank">
                    <Button text="Explore Services" backgroundColor={cxmputeYellow} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Join the community */}
        <div className={styles.community}>
          <div className={styles.communityContainer}>
            <h1>Join the Community</h1>
            <p>Connect with thousands of developers, providers, and enthusiasts building the future of decentralized compute.</p>
            <div className={styles.communityLinks}>
              <a href="https://discord.com/invite/CJGA7B2zKT" target="_blank">
                <Button text="Join Discord" backgroundColor={cxmputePurple}/>
              </a>
              <a href="https://x.com/cxmpute" target="_blank">
                <Button text="Follow on X" backgroundColor={cxmputeGreen}/>
              </a>
              <a href="https://github.com/unxversal" target="_blank">
                <Button text="GitHub" backgroundColor={cxmputeSlate}/>
              </a>
            </div>
          </div>
        </div>

        {/* Map section - What role will you play? */}
        <div className={styles.mapt}>
          <div className={styles.mapContainer}>
            <Map/>
            <div className={styles.mapTextOverlay}>
              <div className={styles.mapOverlayImage}>
                <Image src="/images/3.png" alt="Cxmpute Dolphin Logo" fill style={{ objectFit: "contain" }} />
              </div>
              <h1>What role will you play?</h1>
              <div className={styles.mapRoles}>
                <a href="/docs">
                  <Button text="Build" backgroundColor={cxmputePurple} />
                </a>
                <a href="/docs/provider">
                  <Button text="Provide" backgroundColor={cxmputeYellow} />
                </a>
                <a href="/dashboard">
                  <Button text="Trade" backgroundColor={cxmputeGreen} />
                </a>
              </div>
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
