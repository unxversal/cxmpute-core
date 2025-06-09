"use client"

import Image from "next/image";
import styles from "./LandingPage.module.css";
import Button from "@/components/button/button";
import { useState } from "react";
import Map from "@/components/map/map";
import NotificationBanner from "@/components/ui/NotificationBanner/NotificationBanner";
import { models } from "@/lib/references";
import Link from "next/link";
import { 
  Users, 
  Building2, 
  User, 
  MessageSquare, 
  Eye, 
  Volume2, 
  Search, 
  Code, 
  Calculator, 
  Globe, 
  Monitor, 
  DollarSign, 
  Zap, 
  CheckCircle, 
  Gift, 
  Map as MapIcon, 
  Settings,
  Copy
} from "lucide-react";

const cxmputeGreen = "#20a191";
const cxmputePink = "#fe91e8";
const cxmputeYellow = "#f8cb46";
const cxmputePurple = "#91a8eb";
const cxmputeRed = "#d64989";
const cxmputeSlate = "#d4d4cb";
const cxmputeOrange = "#f76707";

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState<string>('text');

  // Get models by category
  const getModelsByCategory = (category: string) => {
    if (category === 'scraping') {
      return [{ Name: 'Web Scraping Service', Creator: 'Cxmpute' }]; // Mock for scraping
    }
    // Show all models for these categories, not just 3
    return models.filter(model => model.Category.toLowerCase() === category.toLowerCase());
  };

  // Get category color mapping
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'text': return cxmputePurple;
      case 'vision': return cxmputeYellow;
      case 'audio': return cxmputePink;
      case 'embeddings': return cxmputeOrange;
      case 'code': return cxmputeGreen;
      case 'math': return cxmputeRed;
      case 'scraping': return cxmputeSlate;
      default: return cxmputeSlate;
    }
  };

  // Function to darken a hex color for borders
  const darkenColor = (hex: string, amount: number = 0.3) => {
    // Remove # if present
    const color = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    
    // Darken each component
    const newR = Math.round(r * (1 - amount));
    const newG = Math.round(g * (1 - amount));
    const newB = Math.round(b * (1 - amount));
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  // Sample code for different categories
  const getSampleCode = (category: string) => {
    const modelName = getModelsByCategory(category)[0]?.Name || 'model-name';
    
    switch (category) {
      case 'text':
        return `curl -X POST https://api.cxmpute.cloud/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [
      {"role": "user", "content": "Write a haiku about AI"}
    ],
    "temperature": 0.8
  }'`;
      case 'vision':
        return `curl -X POST https://api.cxmpute.cloud/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What's in this image?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
      ]
    }]
  }'`;
      case 'embeddings':
        return `curl -X POST https://api.cxmpute.cloud/v1/embeddings \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "input": "Your text to embed"
  }'`;
      case 'audio':
        return `curl -X POST https://api.cxmpute.cloud/v1/tts \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hello, this is a test of text to speech.",
    "voice": "af_bella"
  }' \\
  --output speech.wav`;
      case 'code':
        return `curl -X POST https://api.cxmpute.cloud/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [
      {"role": "user", "content": "Write a Python function to sort a list"}
    ]
  }'`;
      case 'scraping':
        return `curl -X POST https://api.cxmpute.cloud/v1/scrape \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "urls": ["https://example.com"],
    "format": "markdown"
  }'`;
      default:
        return `curl -X POST https://api.cxmpute.cloud/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "X-User-Id: YOUR_USER_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'`;
    }
  };



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
        <div className={styles.hero}>
            <div className={styles.heroLeft}>
            <h3>Welcome to the Cxmpute network!</h3>
            <h1>Use or provide computing power, storage, and more.</h1>
            <p>Cxmpute connects providers of computing hardware with users who leverage a range of computing services.</p>
            <div className={styles.heroButtons}>
              <a href="/docs/provider" target="_blank">
              <Button text="Start earning as a provider" backgroundColor={cxmputeYellow}/>
              </a>
              <a href="/docs" target="_blank">
              <Button text="Start using Cxmpute services" backgroundColor={cxmputePink}/>
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
        <div className={styles.whoIsCxmputeFor}>
          <h3>Who is Cxmpute for?</h3>
          <h1>Here&apos;s what Cxmpute does for you:</h1>
            <div className={styles.whoIsCxmputeForCards}>
            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage} style={{ backgroundColor: cxmputePurple }}>
                <Users size={48} />
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Companies + Developers</span>
              <p className={styles.whoIsCxmputeForCard__content}>Access AI Inference and compute services powered by a globally distributed network.</p>
              <a href="/docs">
                <Button text="Get Started" backgroundColor={cxmputePurple} />
              </a>
            </div>

            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage} style={{ backgroundColor: cxmputeYellow }}>
                <Building2 size={48} />
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Datacenters</span>
              <p className={styles.whoIsCxmputeForCard__content}>Maximize the ROI of your infrastructure by offering your datacenter capacity to a global marketplace for decentralized compute.</p>
              <a href="/docs/provider">
                <Button text="Join Network" backgroundColor={cxmputeYellow} />
              </a>
            </div>

            <div className={styles.whoIsCxmputeForCard}>
              <div className={styles.whoIsCxmputeForCardImage} style={{ backgroundColor: cxmputePink }}>
                <User size={48} />
              </div>
              <span className={styles.whoIsCxmputeForCard__title}>Individuals</span>
              <p className={styles.whoIsCxmputeForCard__content}>Monetize your idle computer resources by contributing to a decentralized network—and get rewarded for your unused power.</p>
              <a href="/docs/provider">
                <Button text="Start Earning" backgroundColor={cxmputePink} />
              </a>
            </div>
          </div>
        </div>
        <div className={styles.manifesto}>
          <h3>Our Manifesto</h3>
          <h1>We are building a more open, fair, and accessible cloud</h1>
          <p>Empowering individuals and organizations to contribute to and benefit from a global computing network. We believe in democratizing access to technology and rewarding participation.</p>
          <div className={styles.manifestoActions}>
            <a href="/101">
              <Button text="Learn Our Story" backgroundColor={cxmputeGreen} />
            </a>
            <a href="/roadmap">
              <Button text="See Our Vision" backgroundColor={cxmputePurple} />
            </a>
              </div>
              </div>
        <div className={styles.partners}>
          <h3>Built on</h3>
          <div className={styles.partnersContainer}>
            <div className={styles.partnerLogo}>
              <Image src="/images/peaq.png" alt="Peaq logo" width={200} height={80} style={{ objectFit: "contain" }} />
            </div>
            </div>
        </div>
        <div className={styles.aiEndpoint}>
          <h3>All your AI needs, one endpoint</h3>
          <h1>Explore our comprehensive AI model collection</h1>
          
          <div className={styles.aiCategoriesContainer}>
            <div className={styles.aiCategoriesGrid}>
              <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'text' ? styles.selectedCategory : ''}`} 
                              style={{ 
                  backgroundColor: getCategoryColor('text'),
                  borderColor: selectedCategory === 'text' ? darkenColor(getCategoryColor('text')) : '#000'
                }}
                onClick={() => setSelectedCategory('text')}
              >
                <div className={styles.categoryIcon}>
                  <MessageSquare size={24} />
                </div>
                <h3>Text Models</h3>
                <p>Powerful language models for text generation, conversation, reasoning, and general AI tasks.</p>
                    </div>

              <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'vision' ? styles.selectedCategory : ''}`} 
                                      style={{ 
                  backgroundColor: getCategoryColor('vision'),
                  borderColor: selectedCategory === 'vision' ? darkenColor(getCategoryColor('vision')) : '#000'
                }}
                onClick={() => setSelectedCategory('vision')}
              >
                <div className={styles.categoryIcon}>
                  <Eye size={24} />
                    </div>
                <h3>Vision Models</h3>
                <p>Advanced vision-language models that can understand and analyze images, charts, and documents.</p>
                    </div>

              <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'audio' ? styles.selectedCategory : ''}`} 
                      style={{
                  backgroundColor: getCategoryColor('audio'),
                  borderColor: selectedCategory === 'audio' ? darkenColor(getCategoryColor('audio')) : '#000'
                }}
                onClick={() => setSelectedCategory('audio')}
              >
                <div className={styles.categoryIcon}>
                  <Volume2 size={24} />
                    </div>
                <h3>Text-to-Speech</h3>
                <p>Natural text-to-speech synthesis with multiple voice options and high-quality audio output.</p>
                    </div>

              <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'embeddings' ? styles.selectedCategory : ''}`} 
                      style={{
                  backgroundColor: getCategoryColor('embeddings'),
                  borderColor: selectedCategory === 'embeddings' ? darkenColor(getCategoryColor('embeddings')) : '#000'
                }}
                onClick={() => setSelectedCategory('embeddings')}
              >
                <div className={styles.categoryIcon}>
                  <Search size={24} />
                </div>
                <h3>Embeddings</h3>
                <p>Transform text into high-dimensional vectors for semantic search and RAG applications.</p>
            </div>

              <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'code' ? styles.selectedCategory : ''}`} 
                style={{ 
                  backgroundColor: getCategoryColor('code'),
                  borderColor: selectedCategory === 'code' ? darkenColor(getCategoryColor('code')) : '#000'
                }}
                onClick={() => setSelectedCategory('code')}
              >
                <div className={styles.categoryIcon}>
                  <Code size={24} />
                  </div>
                <h3>Code Models</h3>
                <p>Specialized coding models for code generation, debugging, and programming assistance.</p>
                      </div>

              <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'math' ? styles.selectedCategory : ''}`} 
                        style={{
                  backgroundColor: getCategoryColor('math'),
                  borderColor: selectedCategory === 'math' ? darkenColor(getCategoryColor('math')) : '#000'
                }}
                onClick={() => setSelectedCategory('math')}
              >
                <div className={styles.categoryIcon}>
                  <Calculator size={24} />
                      </div>
                <h3>Math Models</h3>
                <p>Mathematical reasoning models optimized for solving complex equations and quantitative problems.</p>
                      </div>

                            <div 
                className={`${styles.aiCategoryCard} ${selectedCategory === 'scraping' ? styles.selectedCategory : ''}`} 
                style={{ 
                  backgroundColor: getCategoryColor('scraping'),
                  borderColor: selectedCategory === 'scraping' ? darkenColor(getCategoryColor('scraping')) : '#000'
                }}
                onClick={() => setSelectedCategory('scraping')}
              >
                <div className={styles.categoryIcon}>
                  <Globe size={24} />
                </div>
                <h3>Web Scraping</h3>
                <p>Distributed web scraping service that extracts and processes content from web pages efficiently.</p>
              </div>

              <Link href="/models" className={styles.aiCategoryCard} style={{ backgroundColor: cxmputeGreen }}>
                <div className={styles.categoryIcon}>
                  <MessageSquare size={24} />
                </div>
                <h3>All Models</h3>
                <p>Explore our complete model gallery with all available AI models and services in one place.</p>
              </Link>
            </div>
          </div>

          <div className={styles.playgroundSection}>
            <div className={styles.playgroundContent}>
              <div className={styles.playgroundLeft}>
                <div className={styles.modelSelector}>
                  <label>Select Model:</label>
                  <select className={styles.modelDropdown}>
                    {getModelsByCategory(selectedCategory).map((model, idx) => (
                      <option key={idx} value={model.Name}>{model.Name}</option>
                    ))}
                  </select>
                  <button className={styles.copyModelBtn} onClick={() => navigator.clipboard.writeText(getModelsByCategory(selectedCategory)[0]?.Name || '')}>
                    <Copy size={16} />
                      </button>
                      </div>

                <div className={styles.lightCodeBlock}>
                  <div className={styles.lightCodeHeader}>
                    <span>Sample Request</span>
                    <button className={styles.lightCopyBtn}>
                      <Copy size={16} />
                      Copy
                      </button>
                  </div>
                  <pre className={styles.lightCodeContent}>
                    <code>{getSampleCode(selectedCategory)}</code>
                  </pre>
              </div>

                <div className={styles.playgroundActions}>
                  <a href="/dashboard">
                    <Button text="Get API Key" backgroundColor={cxmputeGreen} />
                  </a>
                </div>
                </div>

              <div className={styles.playgroundRight}>
                <h4>{selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} {selectedCategory === 'scraping' ? 'Service' : 'Models'}</h4>
                <p>{selectedCategory === 'scraping' 
                  ? 'Distributed web scraping service details and capabilities.' 
                  : 'Available models in this category with their creators and capabilities.'}</p>
                
                {/* <h4>Available {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} {selectedCategory === 'scraping' ? 'Service' : 'Models'}:</h4> */}

                <div className={styles.modelsList}>
                  {getModelsByCategory(selectedCategory).map((model, idx) => (
                    <div key={idx} className={styles.modelItem}>
                      <strong>{model.Name}</strong>
                      <span className={styles.modelMeta}>by {model.Creator}</span>
                </div>
                  ))}
                </div>

                <Link href={selectedCategory === 'scraping' ? '/docs/scraping' : `/models?category=${selectedCategory}`}>
                  <Button text={selectedCategory === 'scraping' ? 'Learn about web scraping' : `View all ${selectedCategory} models`} backgroundColor={cxmputePurple} />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.computeMonetization}>
          <h3>Compute Monetization</h3>
          <h1>Turn your idle hardware into income</h1>
          
          <div className={styles.computeMonetizationGrid}>
            <div className={styles.networkVisualization}>
              <div className={styles.lightAsciiArt}>
                <pre>{`
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ GPU-A   │────│ GPU-B   │────│ GPU-C   │
    │ [IDLE]  │    │ [ACTIVE]│    │ [IDLE]  │
    └─────────┘    └─────────┘    └─────────┘
         │              │              │
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ CPU-D   │────│ ROUTER  │────│ GPU-E   │
    │ [IDLE]  │    │ [CXMPTE]│    │ [ACTIVE]│
    └─────────┘    └─────────┘    └─────────┘
         │              │              │
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ GPU-F   │────│ CPU-G   │────│ GPU-H   │
    │ [ACTIVE]│    │ [IDLE]  │    │ [IDLE]  │
    └─────────┘    └─────────┘    └─────────┘
                `}</pre>
              </div>
            </div>

            <div className={styles.monetizationContent}>
              <div className={styles.monetizationFeatures}>
                <div className={styles.monetizationFeature}>
                  <Monitor size={24} />
                  <span>Supports a wide range of GPUs and Devices</span>
              </div>
                <div className={styles.monetizationFeature}>
                  <DollarSign size={24} />
                  <span>Monetize your idle machines</span>
              </div>
                <div className={styles.monetizationFeature}>
                  <Zap size={24} />
                  <span>Easy to get started (Get started in 10 secs)</span>
              </div>
              </div>
              <a href="/docs/provider">
                <Button text="Provide Cxmpute" backgroundColor={cxmputeYellow} />
              </a>
            </div>
          </div>
        </div>
        <div className={styles.globalNetwork}>
          <h3>Hardware-agnostic global network</h3>
          <h1>Benefits all involved parties</h1>
          
          <div className={styles.benefitsGrid}>
            <div className={styles.benefitsCard} style={{ backgroundColor: cxmputeGreen }}>
              <div className={styles.benefitsHeader}>
                <Users size={32} />
                <h3>User Benefits</h3>
              </div>
              <ul className={styles.benefitsList}>
                <li><CheckCircle size={16} /> Access to a wide range of SOTA models</li>
                <li><CheckCircle size={16} /> High throughput performance</li>
                <li><CheckCircle size={16} /> Cheaper than your cheapest cloud</li>
                <li><CheckCircle size={16} /> Privacy - take back control</li>
                <li><CheckCircle size={16} /> Pay as you go and subscription plans</li>
              </ul>
            </div>

            <div className={styles.benefitsCard} style={{ backgroundColor: cxmputeYellow }}>
              <div className={styles.benefitsHeader}>
                <Building2 size={32} />
                <h3>Provider Benefits</h3>
              </div>
              <ul className={styles.benefitsList}>
                <li><CheckCircle size={16} /> Passive income from idle resources</li>
                <li><CheckCircle size={16} /> Flexible participation options</li>
                <li><CheckCircle size={16} /> Global marketplace access</li>
                <li><CheckCircle size={16} /> Automated payments and rewards</li>
                <li><CheckCircle size={16} /> Community-driven network growth</li>
              </ul>
            </div>
          </div>
        </div>
        <div className={styles.latestNews}>
          <h3>Latest News</h3>
          <h1>Stay updated with Cxmpute</h1>
          
          <div className={styles.newsCards}>
            <div className={styles.newsCard}>
              <div className={styles.newsCardImage} style={{ backgroundColor: cxmputePink }}>
                <Gift size={48} />
              </div>
              <span className={styles.newsCard__title}>Rewards and testnet now live</span>
              <p className={styles.newsCard__content}>Join our testnet to earn rewards while helping us build the future of decentralized compute.</p>
              <a href="/rewards">
                <Button text="Join Testnet" backgroundColor={cxmputePink} />
                  </a>
                </div>

            <div className={styles.newsCard}>
              <div className={styles.newsCardImage} style={{ backgroundColor: cxmputePurple }}>
                <MapIcon size={48} />
              </div>
              <span className={styles.newsCard__title}>Roadmap</span>
              <p className={styles.newsCard__content}>See our vision for the future of decentralized computing and how we plan to get there.</p>
              <a href="/roadmap">
                <Button text="View Roadmap" backgroundColor={cxmputePurple} />
                  </a>
                </div>

            <div className={styles.newsCard}>
              <div className={styles.newsCardImage} style={{ backgroundColor: cxmputeOrange }}>
                <Settings size={48} />
              </div>
              <span className={styles.newsCard__title}>Services Overview</span>
              <p className={styles.newsCard__content}>Explore our comprehensive suite of AI and computing services in detail.</p>
              <a href="/services">
                <Button text="Explore Services" backgroundColor={cxmputeOrange} />
              </a>
            </div>
          </div>
        </div>
        <div className={styles.ctaMap}>
          <div className={styles.mapContainer}>
            <Map/>
            <div className={styles.mapTextOverlay}>
              <div className={styles.mapOverlayImage}>
                <Image src="/images/3.png" alt="Cxmpute Dolphin Logo" fill style={{ objectFit: "contain" }} />
              </div>
              <h1>What role will you play?</h1>
              <div className={styles.ctaButtons}>
                <a href="/docs">
                  <Button text="Build" backgroundColor={cxmputeGreen} />
                </a>
                <a href="/docs/provider">
                  <Button text="Provide" backgroundColor={cxmputeYellow} />
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
              <a href="/docs/provider" target="_blank">
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
