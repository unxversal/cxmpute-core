import { getDocBySlug, docs } from "@/lib/docs";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "../docs.module.css";
import Link from "next/link";

interface DocPageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  return docs
    .filter(doc => doc.slug !== '') // Exclude the home page
    .map((doc) => ({
      slug: doc.slug,
    }));
}

export async function generateMetadata({ params }: DocPageProps) {
  const doc = getDocBySlug(params.slug);
  
  if (!doc) {
    return {
      title: 'Page Not Found | Cxmpute Docs',
      description: 'The requested documentation page could not be found.',
    };
  }

  return {
    title: `${doc.title} | Cxmpute Docs`,
    description: doc.description,
  };
}

export default function DocPage({ params }: DocPageProps) {
  const doc = getDocBySlug(params.slug);
  
  if (!doc) {
    notFound();
  }

  return (
    <div className={styles.docsPage}>
      <header className={styles.docHeader}>
        <h1>{doc.title}</h1>
        <p className={styles.docDescription}>{doc.description}</p>
      </header>

      <div className={styles.docContent}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a({ href, children, ...props }) {
              // Handle internal links
              if (href?.startsWith('/docs/')) {
                return (
                  <Link href={href} {...props}>
                    {children}
                  </Link>
                );
              }
              // External links open in new tab
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              );
            },
            h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
            h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
            h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
            h4: ({ children }) => <h4 className={styles.h4}>{children}</h4>,
            p: ({ children }) => <p className={styles.paragraph}>{children}</p>,
            ul: ({ children }) => <ul className={styles.list}>{children}</ul>,
            ol: ({ children }) => <ol className={styles.orderedList}>{children}</ol>,
            li: ({ children }) => <li className={styles.listItem}>{children}</li>,
            blockquote: ({ children }) => <blockquote className={styles.blockquote}>{children}</blockquote>,
            table: ({ children }) => <table className={styles.table}>{children}</table>,
            thead: ({ children }) => <thead className={styles.tableHead}>{children}</thead>,
            tbody: ({ children }) => <tbody className={styles.tableBody}>{children}</tbody>,
            tr: ({ children }) => <tr className={styles.tableRow}>{children}</tr>,
            th: ({ children }) => <th className={styles.tableHeader}>{children}</th>,
            td: ({ children }) => <td className={styles.tableCell}>{children}</td>,
            pre: ({ children }) => <pre className={styles.codeBlock}>{children}</pre>,
            code: ({ children }) => <code className={styles.inlineCode}>{children}</code>,
          }}
        >
          {doc.content}
        </ReactMarkdown>
      </div>
    </div>
  );
} 