"use client";

import Button from '../button/button';
import styles from './UserDashboard.module.css';

type Subject = {
    id: string;
    providerId: string;
    providerAk: string;
    userAks: string[];
    userAk: string;
    admin: boolean;
    email: string;
    traderId: string;
    traderAk: string;
    walletAddress?: string | undefined;
};

export default function UserDashboard({ subject }: { subject: Subject }) {

    return (
        <div className={styles.userDashboard}>
            <div className={styles.hero}>
                <div className={styles.left}>
                    <h3>{subject.email}</h3>
                    <h1>User Dashboard</h1>
                    <h2>Welcome to cxmpute.cloud! Get started below:</h2>
                    <div className={styles.buttonContainer}>
                        <a href="/d/user" target="_blank" rel="noopener noreferrer">
                            <Button text="Documentation" backgroundColor="var(--cxmpute-purple)" />
                        </a>
                        <a >
                            <Button text="Manage API Keys" backgroundColor="var(--cxmpute-orange)" />
                        </a>
                        <a >
                            <Button text="Manage Account" backgroundColor="var(--cxmpute-red)" />
                        </a>
                    </div>
                </div>
                <div className={styles.right}>
                    <div className={styles.topButtonsContainer}>
                        <Button text="Switch to provider dashboard" backgroundColor="var(--cxmpute-slate)" />
                        <Button text="Switch to trading dashboard" backgroundColor="var(--cxmpute-green)" />
                    </div>
                    <div className={styles.rightBottom}>
                        <h2>Credits</h2>
                        <h1 className={styles.creditsNumber}>00</h1>
                        <Button text="Load Credits" backgroundColor="var(--cxmpute-yellow)" />
                    </div>
                </div>
            </div>
            <div className={styles.bottom}>
                <div className={styles.cardContainer}>
                    <div 
                        className={styles.card}
                        style={{ backgroundColor: "var(--cxmpute-green)" }}
                    >
                        <h2>Text-to-Speech</h2>
                        <p>Generate human-like speech with multiple voice options.</p>
                        <a className={styles.cardButtonContainer} href="/d/text-to-speech" target="_blank" rel="noopener noreferrer">
                            <Button text="Learn More" backgroundColor="var(--cxmpute-slate)" />
                        </a>
                    </div>
                    <div 
                        className={styles.card}
                        style={{ backgroundColor: "var(--cxmpute-yellow)" }}
                    >
                        <h2>Text-to-Text</h2>
                        <p>Utilize SOTA open-source text generation models for cheaper, faster results. Multilinguality (over 100+ languages) supported.</p>
                        <a className={styles.cardButtonContainer} href="/d/text-to-text" target="_blank" rel="noopener noreferrer">
                            <Button text="Learn More" backgroundColor="var(--cxmpute-slate)" />
                        </a>
                    </div>
                    <div 
                        className={styles.card}
                        style={{ backgroundColor: "var(--cxmpute-purple)" }}
                    >
                        <h2>Embeddings</h2>
                        <p>Generate embeddings from a wide choice of models, varying in size, speed, and quality.</p>
                        <a className={styles.cardButtonContainer} href="/d/embeddings" target="_blank" rel="noopener noreferrer">
                            <Button text="Learn More" backgroundColor="var(--cxmpute-slate)" />
                        </a>
                    </div>
                    <div 
                        className={styles.card}
                        style={{ backgroundColor: "var(--cxmpute-red)" }}
                    >
                        <h2>Scraping</h2>
                        <p>Access our global network of residential proxies and scrape data from any website.</p>
                        <a className={styles.cardButtonContainer} href="/d/scraping" target="_blank" rel="noopener noreferrer">
                            <Button text="Learn More" backgroundColor="var(--cxmpute-slate)" />
                        </a>
                    </div>
                    <div 
                        className={styles.card}
                        style={{ backgroundColor: "var(--cxmpute-orange)" }}
                    >
                        <h2>Tool Use + JSON</h2>
                        <p>Use the latest and most capable models with tool use, function calling abilities, and JSON schema support.</p>
                        <a className={styles.cardButtonContainer} href="/d/tool-use" target="_blank" rel="noopener noreferrer">
                            <Button text="Learn More" backgroundColor="var(--cxmpute-slate)" />
                        </a>
                    </div>
                    <div 
                        className={styles.card}
                        style={{ backgroundColor: "var(--cxmpute-orange)" }}
                    >
                        <h2>Multimodal</h2>
                        <p>Generate human-like speech with multiple voices with SOTA models.</p>
                        <a className={styles.cardButtonContainer} href="/d/multimodal" target="_blank" rel="noopener noreferrer">
                            <Button text="Learn More" backgroundColor="var(--cxmpute-slate)" />
                        </a>
                    </div>
                </div>
                <div className={styles.graphContainer}>

                </div>
            </div>
        </div>
    );
}