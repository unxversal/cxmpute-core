"use client";

import Button from '../button/button';
import styles from './ProviderDashboard.module.css';

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

export default function ProviderDashboard({ subject }: { subject: Subject }) {

    return (
        <div className={styles.userDashboard}>
            <div className={styles.hero}>
                <div className={styles.left}>
                    <h3>{subject.email}</h3>
                    <h1>Provider Dashboard</h1>
                    <h2>Welcome to cxmpute.cloud! Get started below:</h2>
                    <div className={styles.buttonContainer}>
                        <a href="/docs/provider" target="_blank" rel="noopener noreferrer">
                            <Button text="Documentation" backgroundColor="var(--cxmpute-purple)" />
                        </a>
                        <a >
                            {/*  Includes AK refreshment management */}
                            <Button text="Manage Account" backgroundColor="var(--cxmpute-orange)" />
                        </a>
                        <a >
                            <Button text="Learn how to maximize your earnings" backgroundColor="var(--cxmpute-yellow)" />
                        </a>
                    </div>
                </div>
                <div className={styles.right}>
                    <div className={styles.topButtonsContainer}>
                        <Button text="Switch to user dashboard" backgroundColor="var(--cxmpute-slate)" />
                        <Button text="Switch to trading dashboard" backgroundColor="var(--cxmpute-green)" />
                    </div>
                    <div className={styles.rightBottom}>
                        <h2>Total Earnings</h2>
                        <h1 className={styles.creditsNumber}>00</h1>
                        {/* TODO: Add withdraw functionality after epoch */}
                        {/* <Button text="Withrdraw Credits" backgroundColor="var(--cxmpute-yellow)" /> */}
                    </div>
                </div>
            </div>
            <div className={styles.bottom}>
                <div className={styles.provisionsContainer}>
                    <h1 className={styles.cardContainerTitle}>My Provisions</h1>
                    <div className={styles.cardContainer}>
                        
                        <div 
                            className={styles.card}
                        >
                            <h2>Sample Provision</h2>
                            <p>Location</p>
                            <a className={styles.cardButtonContainer} href="/docs/text-to-speech" target="_blank" rel="noopener noreferrer">
                                <Button text="Delete provision" backgroundColor="var(--cxmpute-red)" />
                            </a>
                        </div>
                    </div>
                </div>
                <div className={styles.graphContainer}>

                </div>
            </div>
        </div>
    );
}