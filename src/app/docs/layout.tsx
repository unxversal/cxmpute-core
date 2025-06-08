"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDocsByCategory } from "@/lib/docs";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useState } from "react";
import styles from "./layout.module.css";

interface DocsLayoutProps {
  children: React.ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  const pathname = usePathname();
  const docsByCategory = getDocsByCategory();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(docsByCategory))
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getDocPath = (slug: string) => {
    return slug === '' ? '/docs' : `/docs/${slug}`;
  };

  return (
    <div className={styles.docsLayout}>
      {/* Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/docs" className={styles.docsTitle}>
            <FileText size={24} />
            <h2>Documentation</h2>
          </Link>
        </div>
        
        <nav className={styles.navigation}>
          {Object.entries(docsByCategory).map(([category, docs]) => (
            <div key={category} className={styles.categorySection}>
              <button
                className={styles.categoryHeader}
                onClick={() => toggleCategory(category)}
              >
                {expandedCategories.has(category) ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                <span>{category}</span>
              </button>
              
              {expandedCategories.has(category) && (
                <ul className={styles.docsList}>
                  {docs.map((doc) => {
                    const docPath = getDocPath(doc.slug);
                    const isActive = pathname === docPath;
                    const Icon = doc.icon;
                    
                    return (
                      <li key={doc.slug}>
                        <Link
                          href={docPath}
                          className={`${styles.docLink} ${isActive ? styles.active : ''}`}
                        >
                          <Icon size={16} />
                          <span>{doc.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
} 