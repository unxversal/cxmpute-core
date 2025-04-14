export interface ApiKeyInfo {
    key: string;
    creditLimit: number;
    creditsLeft: number;
    permittedRoutes: string[]; // ex: ["/chat/completions", "/embeddings", ...]
}