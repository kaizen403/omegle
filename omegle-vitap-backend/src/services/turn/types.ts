export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  expiresAt: number;
}

export interface TurnHealth {
  configured: boolean;
  host: string;
}
