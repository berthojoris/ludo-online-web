import type { CharacterId, PlayerColor, PlayerCount } from '@/lib/ludo';
import type { User } from '@/types';

export type CopyState = 'idle' | 'link' | 'error';
export type ViewMode = 'lobby' | 'join';

export type RoomPlayerData = {
    id: number;
    name: string;
    seat_color: PlayerColor | null;
    character?: CharacterId | string | null;
    is_ready: boolean;
    is_host: boolean;
    is_computer?: boolean;
    name_confirmed: boolean;
};

export type RoomData = {
    code: string;
    host_advantage: boolean;
    max_players: PlayerCount;
    status: 'waiting' | 'started' | 'ended';
    players: RoomPlayerData[];
};

export type RoomPageProps = {
    auth?: { user: User | null };
    mode?: 'create' | 'lobby' | 'join';
    room?: RoomData | null;
    me?: RoomPlayerData | null;
    roomError?: string | null;
    attemptedCode?: string | null;
    canCreateRoom?: boolean;
};
