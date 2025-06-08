import { 
  FileText, 
  Users, 
  Cpu, 
  Gift, 
  Info, 
  Volume2, 
  MessageSquare, 
  Search, 
  Globe, 
  Wrench,
  Brain,
  LucideIcon
} from "lucide-react";
import docsContent from './docs-content.json';

export interface Doc {
    slug: string;
    title: string;
    description: string;
    content: string; // markdown
    icon: LucideIcon; // lucide icon component
    category?: string;
}

export const docs: Doc[] = [
  {
    slug: '',
    title: 'Documentation Home',
    description: 'Welcome to Cxmpute documentation - your guide to distributed AI services',
    content: docsContent.index,
    icon: FileText,
    category: 'Getting Started'
  },
  {
    slug: 'user',
    title: 'User Guide',
    description: 'Complete API reference and getting started guide for using Cxmpute services',
    content: docsContent.user,
    icon: Users,
    category: 'Getting Started'
  },
  {
    slug: 'provider',
    title: 'Provider Guide',
    description: 'How to become a compute provider and start earning rewards',
    content: docsContent.provider,
    icon: Cpu,
    category: 'Getting Started'
  },
  {
    slug: 'about',
    title: 'About Cxmpute',
    description: 'Platform overview, architecture, and technical details',
    content: docsContent.about,
    icon: Info,
    category: 'Platform'
  },
  {
    slug: 'rewards',
    title: 'Rewards System',
    description: 'Learn about earning rewards, referrals, and the points system',
    content: docsContent.rewards,
    icon: Gift,
    category: 'Platform'
  },
  {
    slug: 'text-to-text',
    title: 'Text-to-Text (LLM)',
    description: 'Chat completions and text generation with large language models',
    content: docsContent['text-to-text'],
    icon: MessageSquare,
    category: 'AI Services'
  },
  {
    slug: 'embeddings',
    title: 'Text Embeddings',
    description: 'Vector embeddings for semantic search and RAG applications',
    content: docsContent.embeddings,
    icon: Search,
    category: 'AI Services'
  },
  {
    slug: 'text-to-speech',
    title: 'Text-to-Speech',
    description: 'Natural voice synthesis and audio generation from text',
    content: docsContent['text-to-speech'],
    icon: Volume2,
    category: 'AI Services'
  },
  {
    slug: 'scraping',
    title: 'Web Scraping',
    description: 'Intelligent content extraction and web data collection',
    content: docsContent.scraping,
    icon: Globe,
    category: 'AI Services'
  },
  {
    slug: 'tool-use-json',
    title: 'Tool Use & JSON',
    description: 'Structured outputs, function calling, and advanced features',
    content: docsContent['tool-use-json'],
    icon: Wrench,
    category: 'Advanced'
  },
  {
    slug: 'advanced-llms',
    title: 'Advanced LLMs',
    description: 'Advanced features for large language models and specialized capabilities',
    content: docsContent['advanced-llms'],
    icon: Brain,
    category: 'Advanced'
  }
];

// Helper function to get doc by slug
export const getDocBySlug = (slug: string): Doc | undefined => {
  return docs.find(doc => doc.slug === slug);
};

// Helper function to get docs by category
export const getDocsByCategory = (): Record<string, Doc[]> => {
  return docs.reduce((acc, doc) => {
    const category = doc.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, Doc[]>);
};