export interface StartServerCommand {
  type: 'start-server';
  port: number;
  host: string;
}